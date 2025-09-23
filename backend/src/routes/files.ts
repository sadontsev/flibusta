import express, { Response, NextFunction } from 'express';
import { param, validationResult } from 'express-validator';
import path from 'path';
import fs from 'fs/promises';
import AdmZip from 'adm-zip';
import { execFile } from 'child_process';
import { promisify } from 'util';
// const sharp = require('sharp'); // Temporarily disabled for ARM64 compatibility
import { getRow } from '../database/connection';
import logger from '../utils/logger';
import { 
  createTypeSafeHandler
} from '../middleware/validation';
import { buildErrorResponse } from '../types/api';
import { ExtendedRequest } from '../types';

const router = express.Router();
const execFileAsync = promisify(execFile);

async function extractZipEntry(zipPath: string, internalPath: string): Promise<Buffer> {
  // Use system unzip to stream a single entry; avoids loading huge ZIP into memory
  // BusyBox unzip supports -p
  const { stdout } = await execFileAsync('unzip', ['-p', zipPath, internalPath], { encoding: 'buffer', maxBuffer: 1024 * 1024 * 50 });
  return stdout as unknown as Buffer;
}

// Helper: ensure directory exists
async function ensureDir(dirPath: string): Promise<void> {
  try { await fs.mkdir(dirPath, { recursive: true }); } catch {}
}

// Helper: detect image extension from magic bytes
function detectImageExt(buf: Buffer): 'jpg' | 'jpeg' | 'png' | 'gif' | 'webp' | null {
  if (!buf || buf.length < 12) return null;
  // JPEG
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'png';
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif';
  // WEBP (RIFF....WEBP)
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

function imageContentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

// Helper: check cache for any supported image extension
async function findCachedImage(baseDir: string, baseName: string): Promise<string | null> {
  const exts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  for (const ext of exts) {
    const p = path.join(baseDir, `${baseName}.${ext}`);
    try { await fs.access(p); return p; } catch {}
  }
  return null;
}

// Locate a book entry within the flibusta book zips
async function getBookZipEntry(bookId: number, requestedType?: string): Promise<{ zipPath: string; entryName: string; entryBuffer: Buffer; }> {
  // Determine requested type
  const requested = (requestedType || '').toLowerCase().trim();
  // Look up zip file from book_zip with preference logic
  const fileInfo = await getRow(`
      SELECT filename, start_id, end_id, usr
      FROM book_zip
      WHERE $1 BETWEEN start_id AND end_id
      ORDER BY
        (CASE WHEN $2 <> '' AND filename ILIKE ('f.' || $2 || '.%') THEN 1 ELSE 0 END) DESC,
        (CASE WHEN filename ILIKE 'f.fb2.%' THEN 1 ELSE 0 END) DESC,
        (CASE WHEN filename ILIKE 'f.epub.%' THEN 1 ELSE 0 END) DESC,
        (CASE WHEN filename ILIKE 'f.djvu.%' THEN 1 ELSE 0 END) DESC,
        usr ASC,
        filename ASC
      LIMIT 1
    `, [bookId, requested]);

  if (!fileInfo || !fileInfo.filename) {
    throw new Error('Book archive mapping not found');
  }

  const booksRoot = process.env.BOOKS_PATH || '/application/flibusta';
  const zipPath = path.join(booksRoot, String(fileInfo.filename));
  // Access file
  await fs.access(zipPath);

  // Read entries
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const toLower = (s: string) => (s || '').toLowerCase();

  // Try libfilename first
  let bookFilename: string | null = null;
  const lf = await getRow(`SELECT filename FROM libfilename WHERE bookid = $1 LIMIT 1`, [bookId]);
  if (lf && lf.filename) bookFilename = toLower(String(lf.filename));

  const entryNameMatches = (entryNameLower: string, fileNameLower: string) => {
    return entryNameLower.endsWith(`/${fileNameLower}`) || entryNameLower === fileNameLower || entryNameLower.includes(`/${fileNameLower}`);
  };

  let found: any = null;
  if (bookFilename) {
    found = entries.find(e => entryNameMatches(toLower(e.entryName), bookFilename!)) || null;
  }

  // Preferred extensions order using archive/requested type
  const archiveTypeMatch = /^f\.(\w+)\./i.exec(fileInfo.filename || '');
  const archiveType = archiveTypeMatch && archiveTypeMatch[1] ? archiveTypeMatch[1].toLowerCase() : '';
  const baseExts = ['fb2', 'epub', 'djvu', 'pdf', 'mobi', 'txt', 'rtf', 'html', 'htm'];
  const preferredExts = Array.from(new Set([archiveType, requested, ...baseExts].filter(Boolean)));
  if (!found) {
    for (const ext of preferredExts) {
      const candidate = `${bookId}.${ext}`;
      const f = entries.find(e => toLower(e.entryName).endsWith(`/${candidate}`) || toLower(e.entryName).endsWith(candidate));
      if (f) { found = f; break; }
    }
  }
  if (!found) {
    for (const ext of preferredExts) {
      const f = entries.find(e => toLower(e.entryName).endsWith(`.${ext}`));
      if (f) { found = f; break; }
    }
  }
  if (!found) {
    throw new Error('Book file not found in archive');
  }

  return { zipPath, entryName: found.entryName, entryBuffer: found.getData() };
}

// Extract cover from FB2 XML buffer using heuristics
function extractCoverFromFb2(fb2Buffer: Buffer): Buffer | null {
  try {
    const xml = fb2Buffer.toString('utf8');
    // Quick heuristic: find binary blocks likely to be cover
    // 1) Look for <binary id="...cover..."> first
    const coverIdMatch = xml.match(/<binary[^>]*id=["']([^"']*cover[^"']*)["'][^>]*>([\s\S]*?)<\/binary>/i);
    if (coverIdMatch && coverIdMatch[2]) {
      const b64 = coverIdMatch[2].replace(/\s+/g, '');
      try { return Buffer.from(b64, 'base64'); } catch {}
    }
    // 2) Any binary with image content-type
    const imgBinaryMatch = xml.match(/<binary[^>]*content-type=["']image\/(?:jpeg|jpg|png|gif|webp)["'][^>]*>([\s\S]*?)<\/binary>/i);
    if (imgBinaryMatch && imgBinaryMatch[1]) {
      const b64 = imgBinaryMatch[1].replace(/\s+/g, '');
      try { return Buffer.from(b64, 'base64'); } catch {}
    }
    // 3) Fallback: first binary containing jpg/png keyword in id
    const anyBinaryMatch = xml.match(/<binary[^>]*id=["'][^"']*(?:jpg|jpeg|png|cover)[^"']*["'][^>]*>([\s\S]*?)<\/binary>/i);
    if (anyBinaryMatch && anyBinaryMatch[1]) {
      const b64 = anyBinaryMatch[1].replace(/\s+/g, '');
      try { return Buffer.from(b64, 'base64'); } catch {}
    }
  } catch {}
  return null;
}

// Extract cover from EPUB buffer (zip) using container.xml/opf heuristics
function extractCoverFromEpub(epubBuffer: Buffer): Buffer | null {
  try {
    const zip = new AdmZip(epubBuffer);
    const entries = zip.getEntries();
    const getEntry = (name: string) => entries.find(e => e.entryName.toLowerCase() === name.toLowerCase());
    const readText = (e: any) => e ? e.getData().toString('utf8') : '';

    // Find OPF via META-INF/container.xml
    const container = getEntry('META-INF/container.xml');
    let opfPath = '';
    if (container) {
      const xml = readText(container);
      const m = xml.match(/full-path=["']([^"']+)["']/i);
      if (m) opfPath = m[1];
    }
    // Read OPF and try to locate cover
    if (opfPath) {
      const opf = getEntry(opfPath);
      if (opf) {
        const opfXml = readText(opf);
        // meta name="cover" content="id"
        const meta = opfXml.match(/<meta[^>]*name=["']cover["'][^>]*content=["']([^"']+)["'][^>]*>/i);
        let coverHref = '';
        if (meta) {
          const coverId = meta[1];
          const itemMatch = opfXml.match(new RegExp(`<item[^>]*id=["']${coverId}["'][^>]*href=["']([^"']+)["'][^>]*>`, 'i'));
          if (itemMatch) coverHref = itemMatch[1];
        }
        if (!coverHref) {
          // guide reference type="cover"
          const guideMatch = opfXml.match(/<reference[^>]*type=["']cover["'][^>]*href=["']([^"']+)["'][^>]*>/i);
          if (guideMatch) coverHref = guideMatch[1];
        }
        // Resolve path relative to OPF
        if (coverHref) {
          const baseDir = opfPath.split('/').slice(0, -1).join('/');
          const rel = baseDir ? `${baseDir}/${coverHref}` : coverHref;
          const norm = rel.replace(/\\/g, '/');
          const coverEntry = entries.find(e => e.entryName.toLowerCase() === norm.toLowerCase());
          if (coverEntry) return coverEntry.getData();
        }
      }
    }
    // Heuristic fallback: find common cover filenames
  const candidates = entries.filter(e => /cover\.(jpe?g|png|gif|webp)$/i.test(e.entryName) || /images\/cover/i.test(e.entryName));
  if (candidates.length > 0 && candidates[0]) return candidates[0]!.getData();
    // Fallback: largest image in EPUB
    const imageEntries = entries.filter(e => /(jpe?g|png|gif|webp)$/i.test(e.entryName));
    if (imageEntries.length) {
      imageEntries.sort((a, b) => b.header.size - a.header.size);
      if (imageEntries[0]) return imageEntries[0]!.getData();
    }
  } catch {}
  return null;
}

// Validation middleware
const validate = (req: ExtendedRequest, res: Response, next: NextFunction): Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(buildErrorResponse('Validation failed'));
  }
  next();
};

// Serve book file
router.get('/book/:bookId', [
  param('bookId').isInt({ min: 1 }).withMessage('Book ID must be a positive integer')
], validate, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response | void> => {
  const bookId = parseInt(req.params.bookId!);

    // Get book info
    const book = await getRow(`
      SELECT b.bookid, b.title, b.filetype, lf.filename,
             CONCAT(a.lastname, ' ', a.firstname) as author_name
      FROM libbook b
      JOIN libavtor av ON b.bookid = av.bookid
      JOIN libavtorname a ON av.avtorid = a.avtorid
      LEFT JOIN libfilename lf ON b.bookid = lf.bookid
      WHERE b.bookid = $1 AND b.deleted = '0'
      LIMIT 1
    `, [bookId]);

  if (!book) {
    return res.status(404).json(buildErrorResponse('Book not found'));
  }
  console.log('Book info:', { bookId, title: book.title, filetype: book.filetype, filename: book.filename });

    // Determine requested type (normalized)
    const requestedType = (book.filetype || '').toLowerCase().trim();

    // Get file info: prioritize matching requested type, otherwise fall back to fb2/epub/djvu
    console.log('Querying book_zip table for bookId with type preference:', bookId, requestedType);
    const fileInfo = await getRow(`
      SELECT filename, start_id, end_id, usr
      FROM book_zip
      WHERE $1 BETWEEN start_id AND end_id
      ORDER BY
        (CASE WHEN $2 <> '' AND filename ILIKE ('f.' || $2 || '.%') THEN 1 ELSE 0 END) DESC,
        (CASE WHEN filename ILIKE 'f.fb2.%' THEN 1 ELSE 0 END) DESC,
        (CASE WHEN filename ILIKE 'f.epub.%' THEN 1 ELSE 0 END) DESC,
        (CASE WHEN filename ILIKE 'f.djvu.%' THEN 1 ELSE 0 END) DESC,
        usr ASC,
        filename ASC
      LIMIT 1
    `, [bookId, requestedType]);

  if (!fileInfo) {
    return res.status(404).json(buildErrorResponse('Book file not found. This book may not be available for download or the file mapping is missing.'));
  }
  console.log('File info:', { filename: fileInfo.filename, start_id: fileInfo.start_id, end_id: fileInfo.end_id });

    const zipPath = path.join(process.env.BOOKS_PATH || '/application/flibusta', fileInfo.filename);
    console.log('ZIP path:', zipPath);
    
    try {
      await fs.access(zipPath);
      console.log('ZIP file exists');
    } catch (error) {
      console.error('ZIP file not found:', (error as Error).message);
      return res.status(404).json(buildErrorResponse(`Book archive not found: ${fileInfo.filename}`));
    }

    // Extract file from ZIP
  const zip = new AdmZip(zipPath);
  const zipEntries = zip.getEntries();
    console.log('ZIP entries count:', zipEntries.length);
    
    // Find the book file in the ZIP
  let bookEntry: any = null;

    // Normalize helper
    const toLower = (s: string) => (s || '').toLowerCase();
    const entryNameMatches = (entryNameLower: string, fileNameLower: string) => {
      // Allow entries within subfolders; check for exact filename match at end
      return entryNameLower.endsWith(`/${fileNameLower}`) || entryNameLower === fileNameLower || entryNameLower.includes(`/${fileNameLower}`);
    };

    // Try exact filename first if available
    if (book.filename) {
      const bookFileName = toLower(book.filename);
      bookEntry = zipEntries.find(entry => entryNameMatches(toLower(entry.entryName), bookFileName)) || null;
    }

    // Determine archive type from filename (e.g., f.fb2.*, f.epub.*)
    const archiveTypeMatch = /^f\.(\w+)\./i.exec(fileInfo.filename || '');
  const archiveType = archiveTypeMatch && archiveTypeMatch[1] ? archiveTypeMatch[1].toLowerCase() : '';
    const requested = requestedType;

    // Build preferred extensions order
    const baseExts = ['fb2', 'epub', 'djvu', 'pdf', 'mobi', 'txt', 'rtf', 'html', 'htm'];
    const preferredExts = Array.from(new Set([archiveType, requested, ...baseExts].filter(Boolean)));

    // Try exact bookId with preferred extensions
    if (!bookEntry) {
      for (const ext of preferredExts) {
        const candidate = `${bookId}.${ext}`;
        const found = zipEntries.find(entry => toLower(entry.entryName).endsWith(`/${candidate}`) || toLower(entry.entryName).endsWith(candidate));
        if (found) { bookEntry = found; break; }
      }
    }

    // As a last resort, try any file with preferred extensions
    if (!bookEntry) {
      for (const ext of preferredExts) {
        const found = zipEntries.find(entry => toLower(entry.entryName).endsWith(`.${ext}`));
        if (found) { bookEntry = found; break; }
      }
    }

    if (!bookEntry) {
      console.error('Book file not found in archive. Available entries:', zipEntries.map(e => e.entryName).slice(0, 10));
      return res.status(404).json(buildErrorResponse('Book file not found in archive'));
    }

  console.log('Found book entry:', bookEntry.entryName);

  // Derive extension from actual entry name for proper content-type
  const actualNameLower = toLower(bookEntry.entryName);
  const actualExtMatch = /\.([a-z0-9]+)$/.exec(actualNameLower);
  const actualExt = actualExtMatch ? actualExtMatch[1] : (requested || archiveType || 'fb2');

  // Set appropriate headers
  const fileName = `${book.author_name} - ${book.title}.${actualExt}`;
  res.setHeader('Content-Type', getContentType(actualExt));
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', bookEntry.header.size);

    // Send file
    res.send(bookEntry.getData());
    
    logger.info('Book file served successfully', { 
      bookId, 
      title: book.title, 
      fileType: book.filetype, 
      fileSize: bookEntry.header.size 
    });
}));

// Serve author image
router.get('/author/:authorId', [
  param('authorId').isInt({ min: 1 }).withMessage('Author ID must be a positive integer')
], validate, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response | void> => {
  const authorId = parseInt(req.params.authorId!);

    // Get author image info
    const authorImage = await getRow(`
      SELECT file FROM libapics WHERE avtorid = $1 LIMIT 1
    `, [authorId]);

  if (!authorImage) {
    return res.status(404).json(buildErrorResponse('Author image not found'));
  }
    // Ensure authors cache directory exists and check if cached image exists
    const authorsCacheRoot = process.env.AUTHORS_CACHE_PATH || '/app/cache/authors';
    await ensureDir(authorsCacheRoot);
    const cached = await findCachedImage(authorsCacheRoot, String(authorId));
    if (cached) { return res.sendFile(cached); }
    try {
      // Try to extract from ZIP archive
      const zipPath = path.join(process.env.CACHE_PATH || '/app/cache', 'lib.a.attached.zip');
      try {
        await fs.access(zipPath);
        // Extract exact path from archive using unzip -p to avoid >2GB zip memory issues
        const imageBuffer = await extractZipEntry(zipPath, authorImage.file);
        // Temporarily disable sharp processing for ARM64 compatibility
        // const processedImage = await sharp(imageBuffer)
        //   .resize(200, 200, { fit: 'cover' })
        //   .jpeg({ quality: 80 })
        //   .toBuffer();
        const processedImage = imageBuffer; // Serve original image for now

    // Save to cache with detected extension
    const ext = detectImageExt(processedImage) || 'jpg';
    const cachePath = path.join(authorsCacheRoot, `${authorId}.${ext}`);
    await fs.writeFile(cachePath, processedImage);

    // Set headers and send
  res.setHeader('Content-Type', imageContentType(ext));
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
  return res.send(processedImage);
      } catch (zipError) {
        return res.status(404).json(buildErrorResponse('Author image archive not found'));
      }
    } catch (e) {
      return res.status(404).json(buildErrorResponse('Author image archive not found'));
    }
}));

// Serve book cover
router.get('/cover/:bookId', [
  param('bookId').isInt({ min: 1 }).withMessage('Book ID must be a positive integer')
], validate, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response | void> => {
  const bookId = parseInt(req.params.bookId!);

    // Get book cover info
    const bookCover = await getRow(`
      SELECT file FROM libbpics WHERE bookid = $1 LIMIT 1
    `, [bookId]);

  // Ensure covers cache directory exists
  const coversCacheRoot = process.env.COVERS_CACHE_PATH || '/app/cache/covers';
  await ensureDir(coversCacheRoot);

  // Serve from cache if present (any supported extension)
  const cached = await findCachedImage(coversCacheRoot, String(bookId));
  if (cached) { return res.sendFile(cached); }

  if (bookCover) {
    // Try lib.b.attached.zip exact path
    const zipPath = path.join(process.env.CACHE_PATH || '/app/cache', 'lib.b.attached.zip');
    try {
      await fs.access(zipPath);
      const coverBuffer = await extractZipEntry(zipPath, bookCover.file);
      const ext = detectImageExt(coverBuffer) || 'jpg';
      const cachePath = path.join(coversCacheRoot, `${bookId}.${ext}`);
      await fs.writeFile(cachePath, coverBuffer);
      res.setHeader('Content-Type', imageContentType(ext));
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.send(coverBuffer);
    } catch (zipError) {
      // fall through to book-file extraction
    }
  }

  // Fallback: extract cover from the book file itself (fb2/epub)
  try {
    // Get book record for type hints
    const book = await getRow(`SELECT filetype FROM libbook WHERE bookid = $1 LIMIT 1`, [bookId]);
    const requestedType = (book?.filetype || '').toString();
    const { entryName, entryBuffer } = await getBookZipEntry(bookId, requestedType);
    const nameLower = entryName.toLowerCase();
    let buf: Buffer | null = null;
    if (nameLower.endsWith('.fb2') || nameLower.endsWith('.xml')) {
      buf = extractCoverFromFb2(entryBuffer);
    } else if (nameLower.endsWith('.epub')) {
      buf = extractCoverFromEpub(entryBuffer);
    }
    if (buf && buf.length > 32) {
      const ext = detectImageExt(buf) || 'jpg';
      const cachePath = path.join(coversCacheRoot, `${bookId}.${ext}`);
      await fs.writeFile(cachePath, buf);
      res.setHeader('Content-Type', imageContentType(ext));
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.send(buf);
    }
  } catch (fallbackErr) {
    // ignore; will 404 below
  }

  return res.status(404).json(buildErrorResponse('Book cover not found'));
}));

// Helper function to get content type
function getContentType(fileType: string): string {
  const contentTypes: Record<string, string> = {
    'fb2': 'application/x-fictionbook+xml',
    'epub': 'application/epub+zip',
    'pdf': 'application/pdf',
    'mobi': 'application/x-mobipocket-ebook',
    'txt': 'text/plain',
    'html': 'text/html',
    'htm': 'text/html',
    'rtf': 'application/rtf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'djvu': 'image/vnd.djvu',
    'djv': 'image/vnd.djvu'
  };

  return contentTypes[fileType.toLowerCase()] || 'application/octet-stream';
}

export default router;
