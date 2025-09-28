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
import { buildErrorResponse, buildSuccessResponse } from '../types/api';
import { ExtendedRequest } from '../types';
import ConversionService from '../services/ConversionService';

const router = express.Router();
const execFileAsync = promisify(execFile);

async function extractZipEntry(zipPath: string, internalPath: string): Promise<Buffer> {
  // Prefer system unzip to stream a single entry; avoids loading huge ZIP into memory
  // BusyBox unzip supports -p; fall back to AdmZip if unzip is missing or fails
  try {
    const { stdout } = await execFileAsync('unzip', ['-p', zipPath, internalPath], { encoding: 'buffer', maxBuffer: 1024 * 1024 * 100 });
    if (stdout && (stdout as any).length) {
      return stdout as unknown as Buffer;
    }
  } catch (e) {
    // will fallback below
  }
  // Fallback: read using AdmZip (loads central directory and target entry only)
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const target = entries.find(e => e.entryName === internalPath || e.entryName.endsWith('/' + internalPath));
  if (!target) throw new Error(`Entry not found in zip: ${internalPath}`);
  return target.getData();
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
export async function getBookZipEntry(bookId: number, requestedType?: string): Promise<{ zipPath: string; entryName: string; entryBuffer: Buffer; }> {
  // Determine requested type
  const requested = (requestedType || '').toLowerCase().trim();
  const booksRoot = process.env.BOOKS_PATH || '/application/flibusta';

  // Helper: pick a candidate zip from DB mapping if it exists and file is present
  async function tryDbMapping(): Promise<string | null> {
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
    if (!fileInfo || !fileInfo.filename) return null;
    const p = path.join(booksRoot, String(fileInfo.filename));
    try { await fs.access(p); return p; } catch { return null; }
  }

  // Helper: scan directory for any matching range zip if DB mapping is missing or file absent
  async function scanDirForZip(): Promise<string | null> {
    try {
      const files = await fs.readdir(booksRoot);
      // Parse files like f.fb2.821330-821363.zip
      type Candidate = { full: string; ext: string; start: number; end: number };
      const candidates: Candidate[] = [];
      for (const f of files) {
        // Support patterns:
        //  - f.<ext>.<start>-<end>.zip
        //  - f.<ext>-<start>-<end>.zip
        //  - d.<ext>-<start>-<end>.zip (less preferred but acceptable)
        const m = /^(?:[fd])\.(\w+)[\.-](\d+)-(\d+)\.zip$/i.exec(f);
        if (!m || m.length < 4 || !m[1] || !m[2] || !m[3]) continue;
        const ext = (m[1] as string).toLowerCase();
        const start = parseInt(m[2] as string, 10);
        const end = parseInt(m[3] as string, 10);
        if (Number.isFinite(start) && Number.isFinite(end) && start <= bookId && bookId <= end) {
          candidates.push({ full: path.join(booksRoot, f), ext, start, end });
        }
      }
      if (!candidates.length) return null;
      // Prefer requested, then fb2, then epub, then the shortest range (more likely precise)
      const prefOrder = (ext: string) => {
        if (requested && ext === requested) return 0;
        if (ext === 'fb2') return 1;
        if (ext === 'epub') return 2;
        return 3;
      };
      candidates.sort((a, b) => {
        const pa = prefOrder(a.ext) - prefOrder(b.ext);
        if (pa !== 0) return pa;
        const ra = (a.end - a.start) - (b.end - b.start);
        if (ra !== 0) return ra;
        return a.start - b.start;
      });
      return candidates[0]?.full || null;
    } catch { return null; }
  }

  // Resolve a zip path either from DB or by scanning the directory
  let zipPath = await tryDbMapping();
  if (!zipPath) {
    zipPath = await scanDirForZip();
  }
  if (!zipPath) {
    throw new Error('Book archive not available on disk');
  }

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
  // Best-guess archive type from filename (if any)
  const archiveTypeMatch = /^f\.(\w+)\./i.exec(path.basename(zipPath));
  const archiveType = archiveTypeMatch && archiveTypeMatch[1] ? archiveTypeMatch[1].toLowerCase() : '';
  const baseExts = ['fb2', 'epub', 'djvu', 'pdf', 'mobi', 'txt', 'rtf', 'html', 'htm'];
  const preferredExts = Array.from(new Set([archiveType, requested, ...baseExts].filter(Boolean)));
  // Strict: prefer exact basename match of bookId first
  if (!found) {
    for (const ext of preferredExts) {
      const candidate = `${bookId}.${ext}`;
      const f = entries.find(e => {
        const name = toLower(e.entryName).split('/').pop() || '';
        return name === candidate;
      });
      if (f) { found = f; break; }
    }
  }
  // Relaxed: allow subfolder + exact basename
  if (!found) {
    for (const ext of preferredExts) {
      const candidate = `${bookId}.${ext}`;
      const f = entries.find(e => toLower(e.entryName).endsWith('/' + candidate));
      if (f) { found = f; break; }
    }
  }
  // As a last resort, avoid picking arbitrary .*ext; require the id to be present before the extension
  if (!found) {
    for (const ext of preferredExts) {
      const f = entries.find(e => /(^|\/)\d+\.[a-z0-9]+$/i.test(e.entryName) && toLower(e.entryName).includes(`/${bookId}.`));
      if (f) { found = f; break; }
    }
  }
  if (!found) {
    throw new Error('Book file not found in archive');
  }

  return { zipPath, entryName: found.entryName, entryBuffer: found.getData() };
}

// Extract cover from FB2 XML buffer using heuristics
export function extractCoverFromFb2(fb2Buffer: Buffer): Buffer | null {
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
export function extractCoverFromEpub(epubBuffer: Buffer): Buffer | null {
  try {
    const zip = new AdmZip(epubBuffer);
    const entries = zip.getEntries();
    const getEntry = (name: string) => {
      const n = name.replace(/\\/g, '/');
      return entries.find(e => e.entryName.toLowerCase() === n.toLowerCase());
    };
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
        if (!coverHref) {
          // Sometimes items use properties="cover-image" in EPUB3
          const propsMatch = opfXml.match(/<item[^>]*properties=["'][^"']*cover-image[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i);
          if (propsMatch) coverHref = propsMatch[1];
        }
        // Resolve path relative to OPF
        if (coverHref) {
          const baseDir = opfPath.split('/').slice(0, -1).join('/');
          const rel = baseDir ? `${baseDir}/${coverHref}` : coverHref;
          const norm = rel.replace(/\\/g, '/');
          const coverEntry = entries.find(e => e.entryName.toLowerCase() === norm.toLowerCase() || e.entryName.toLowerCase().endsWith('/' + norm.toLowerCase()));
          if (coverEntry) return coverEntry.getData();
        }
      }
    }
    // Heuristic fallback: find common cover filenames
  const candidates = entries.filter(e => /(^|\/)cover\.(jpe?g|png|gif|webp)$/i.test(e.entryName) || /images\/(?:.*)cover/i.test(e.entryName));
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

// Serve book file (optionally converted via ?format=epub)
router.get('/book/:bookId', [
  param('bookId').isInt({ min: 1 }).withMessage('Book ID must be a positive integer')
], validate, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response | void> => {
  const bookId = parseInt(req.params.bookId!);
  const requestedFormatRaw = (req.query.format as string | undefined)?.toLowerCase();
  const allowedTargets = ['epub','mobi','azw3','pdf','txt','rtf','html'];
  const requestedFormat = requestedFormatRaw && allowedTargets.includes(requestedFormatRaw) ? requestedFormatRaw : undefined;

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

    // Try DB mapping first; if not available or fails, fallback to scanning via getBookZipEntry
    let entryBuffer: Buffer | null = null;
    let entryName: string | null = null;
    let actualExt = '';
    try {
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

      if (fileInfo && fileInfo.filename) {
        console.log('File info:', { filename: fileInfo.filename, start_id: fileInfo.start_id, end_id: fileInfo.end_id });
        const zipPath = path.join(process.env.BOOKS_PATH || '/application/flibusta', fileInfo.filename);
        console.log('ZIP path:', zipPath);
        try {
          await fs.access(zipPath);
          console.log('ZIP file exists');
          // Extract file from ZIP
          const zip = new AdmZip(zipPath);
          const zipEntries = zip.getEntries();
          console.log('ZIP entries count:', zipEntries.length);

          // Find the book file in the ZIP
          const toLower = (s: string) => (s || '').toLowerCase();
          const entryNameMatches = (entryNameLower: string, fileNameLower: string) => {
            return entryNameLower.endsWith(`/${fileNameLower}`) || entryNameLower === fileNameLower || entryNameLower.includes(`/${fileNameLower}`);
          };

          // Prefer exact filename
          let found: any = null;
          if (book.filename) {
            const bookFileName = toLower(book.filename);
            found = zipEntries.find(entry => entryNameMatches(toLower(entry.entryName), bookFileName)) || null;
          }
          // Fallback by preferred extensions and bookId
          const archiveTypeMatch = /^f\.(\w+)\./i.exec(fileInfo.filename || '');
          const archiveType = archiveTypeMatch && archiveTypeMatch[1] ? archiveTypeMatch[1].toLowerCase() : '';
          const baseExts = ['fb2', 'epub', 'djvu', 'pdf', 'mobi', 'txt', 'rtf', 'html', 'htm'];
          const preferredExts = Array.from(new Set([archiveType, requestedType, ...baseExts].filter(Boolean)));
          if (!found) {
            for (const ext of preferredExts) {
              const candidate = `${bookId}.${ext}`;
              const f = zipEntries.find(entry => toLower(entry.entryName).endsWith(`/${candidate}`) || toLower(entry.entryName).endsWith(candidate));
              if (f) { found = f; break; }
            }
          }
          if (!found) {
            for (const ext of preferredExts) {
              const f = zipEntries.find(entry => toLower(entry.entryName).endsWith(`.${ext}`));
              if (f) { found = f; break; }
            }
          }
          if (found) {
            entryName = found.entryName;
            entryBuffer = found.getData();
            const actualNameLower = toLower(entryName || '');
            const actualExtMatch = /\.([a-z0-9]+)$/.exec(actualNameLower);
            actualExt = actualExtMatch ? actualExtMatch[1] : (archiveType || requestedType || 'fb2');
          }
        } catch (error) {
          console.warn('ZIP file not accessible, will fallback to scanning', { error: (error as Error).message });
        }
      }
    } catch (e) {
      console.warn('DB mapping lookup failed, will fallback to scanning', { bookId, error: (e as Error).message });
    }

    // If DB path failed to yield an entry, fallback to scanning
    if (!entryBuffer || !entryName) {
      try {
        const fallback = await getBookZipEntry(bookId, requestedType);
        entryName = fallback.entryName;
        entryBuffer = fallback.entryBuffer;
        const lower = (entryName || '').toLowerCase();
        const m = /\.([a-z0-9]+)$/.exec(lower);
        actualExt = m ? m[1] : (requestedType || 'fb2');
        console.log('Fallback scanning located entry', { bookId, entryName });
      } catch (scanErr) {
        console.error('Failed to locate book in archives', { bookId, error: (scanErr as Error).message });
        return res.status(404).json(buildErrorResponse('Book file not found in archive'));
      }
    }

    // At this point we have entryBuffer/entryName and actualExt
    const fileName = `${book.author_name} - ${book.title}.${actualExt}`;
    if (requestedFormat && requestedFormat !== actualExt) {
      try {
        const converted = await ConversionService.convert(bookId, actualExt, requestedFormat as any, entryBuffer!);
        const convName = `${book.author_name} - ${book.title}.${requestedFormat}`;
        res.setHeader('Content-Type', getContentType(requestedFormat));
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(convName)}"`);
        res.setHeader('Content-Length', converted.length);
        res.send(converted);
        logger.info('Book file served with conversion', { bookId, from: actualExt, to: requestedFormat });
        return;
      } catch (convErr) {
        logger.warn('Conversion failed, falling back to original', { bookId, target: requestedFormat, error: (convErr as Error).message });
      }
    }

    res.setHeader('Content-Type', getContentType(actualExt));
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', entryBuffer!.length);
    res.send(entryBuffer);
    logger.info('Book file served successfully', { 
      bookId,
      title: book.title,
      fileType: book.filetype,
      fileSize: entryBuffer!.length,
      converted: !!requestedFormat && requestedFormat === actualExt
    });
}));

// ------------------------------------------------------------
// List available conversion formats for a book
// Supports DB-less mode (SKIP_DB_INIT=1) by returning a synthetic
// source format (fb2) so the UI can still display at least EPUB.
// ------------------------------------------------------------
router.get('/book/:bookId/formats', [
  param('bookId').isInt({ min: 1 }).withMessage('Book ID must be a positive integer')
], validate, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response | void> => {
  const bookId = parseInt(req.params.bookId!);
  let source = '';
  if (process.env.SKIP_DB_INIT === '1') {
    source = 'fb2';
  } else {
    try {
      const dbRow = await getRow(`
        SELECT b.bookid, b.filetype
        FROM libbook b
        WHERE b.bookid = $1 AND b.deleted = '0'
        LIMIT 1
      `, [bookId]);
      if (!dbRow) {
        return res.status(404).json(buildErrorResponse('Book not found'));
      }
      source = (dbRow.filetype || '').toLowerCase().trim();
    } catch (e) {
      logger.warn('Formats lookup failed, falling back to fb2 default', { bookId, error: (e as Error).message });
      source = 'fb2';
    }
  }
  let targets: string[] = [];
  try {
    targets = await (ConversionService as any).listTargetsForSource(source);
  } catch (e) {
    logger.warn('List targets failed', { bookId, error: (e as Error).message });
  }
  return res.json(buildSuccessResponse({ bookId, source, targets } as any));
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
  try {
    const stat = await fs.stat(coversCacheRoot);
    logger.info('Cover route: cache dir status', { bookId, coversCacheRoot, exists: !!stat, isDir: stat.isDirectory?.() });
  } catch (e) {
    logger.warn('Cover route: cache dir not accessible', { bookId, coversCacheRoot, error: (e as Error).message });
  }

  // Serve from cache if present (any supported extension)
  const cached = await findCachedImage(coversCacheRoot, String(bookId));
  logger.info('Cover route: cache lookup', { bookId, cached });
  if (cached) {
    logger.info('Cover route: serving from cache', { bookId, path: cached });
    return res.sendFile(cached);
  }

  if (bookCover) {
    // Try lib.b.attached.zip exact path
    const zipPath = path.join(process.env.CACHE_PATH || '/app/cache', 'lib.b.attached.zip');
    try {
      await fs.access(zipPath);
      logger.info('Cover route: lib.b zip found, extracting', { bookId, zipPath, internal: bookCover.file });
      const coverBuffer = await extractZipEntry(zipPath, bookCover.file);
      const ext = detectImageExt(coverBuffer) || 'jpg';
      const cachePath = path.join(coversCacheRoot, `${bookId}.${ext}`);
      await fs.writeFile(cachePath, coverBuffer);
      logger.info('Cover route: extracted from lib.b and cached', { bookId, cachePath, size: coverBuffer.length, ext });
      res.setHeader('Content-Type', imageContentType(ext));
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.send(coverBuffer);
    } catch (zipError) {
      logger.warn('Cover route: lib.b extraction failed, will fallback to book file', { bookId, error: (zipError as Error).message });
      // fall through to book-file extraction
    }
  }

  // Fallback: extract cover from the book file itself (fb2/epub)
  try {
    // Get book record for type hints
    const book = await getRow(`SELECT filetype FROM libbook WHERE bookid = $1 LIMIT 1`, [bookId]);
    const requestedType = (book?.filetype || '').toString();
    const { entryName, entryBuffer } = await getBookZipEntry(bookId, requestedType);
    logger.info('Cover route: got book entry for fallback', { bookId, entryName, requestedType });
    const nameLower = entryName.toLowerCase();
    let buf: Buffer | null = null;
    if (nameLower.endsWith('.fb2') || nameLower.endsWith('.xml')) {
      buf = extractCoverFromFb2(entryBuffer);
      logger.info('Cover route: fb2 cover extraction result', { bookId, hasCover: !!buf, size: buf?.length });
    } else if (nameLower.endsWith('.epub')) {
      buf = extractCoverFromEpub(entryBuffer);
      logger.info('Cover route: epub cover extraction result', { bookId, hasCover: !!buf, size: buf?.length });
    }
    if (buf && buf.length > 32) {
      const ext = detectImageExt(buf) || 'jpg';
      const cachePath = path.join(coversCacheRoot, `${bookId}.${ext}`);
      await fs.writeFile(cachePath, buf);
      logger.info('Cover route: cached extracted cover', { bookId, cachePath, size: buf.length, ext });
      res.setHeader('Content-Type', imageContentType(ext));
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.send(buf);
    }
  } catch (fallbackErr) {
    logger.warn('Cover route: fallback extraction failed', { bookId, error: (fallbackErr as Error).message });
    // ignore; will 404 below
  }

  logger.info('Cover route: not found', { bookId });
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

// DEBUG: expose a tiny status for files routes (non-production usage)
// This is intentionally placed after export to avoid affecting normal imports.
if (process.env.ENABLE_FILES_DEBUG === 'true') {
  try {
    router.get('/__debug/status', async (req: any, res: any) => {
      const coversCacheRoot = process.env.COVERS_CACHE_PATH || '/app/cache/covers';
      const authorsCacheRoot = process.env.AUTHORS_CACHE_PATH || '/app/cache/authors';
      const booksRoot = process.env.BOOKS_PATH || '/app/flibusta';
      let coversStat: any = null;
      let authorsStat: any = null;
      try { const s = await fs.stat(coversCacheRoot); coversStat = { exists: true, isDir: s.isDirectory?.(), mode: s.mode } } catch { coversStat = { exists: false }; }
      try { const s = await fs.stat(authorsCacheRoot); authorsStat = { exists: true, isDir: s.isDirectory?.(), mode: s.mode } } catch { authorsStat = { exists: false }; }
      res.json({
        ok: true,
        env: {
          COVERS_CACHE_PATH: coversCacheRoot,
          AUTHORS_CACHE_PATH: authorsCacheRoot,
          BOOKS_PATH: booksRoot,
          NODE_ENV: process.env.NODE_ENV,
        },
        coversStat,
        authorsStat
      });
    });
  } catch {}
}
