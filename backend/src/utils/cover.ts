import path from 'path';
import fs from 'fs/promises';
import AdmZip from 'adm-zip';
import { getRow } from '../database/connection';

// Locate a book entry within the flibusta book zips
export async function getBookZipEntry(bookId: number, requestedType?: string): Promise<{ zipPath: string; entryName: string; entryBuffer: Buffer; }> {
  const requested = (requestedType || '').toLowerCase().trim();
  const booksRoot = process.env.BOOKS_PATH || '/application/flibusta';

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

  async function scanDirForZip(): Promise<string | null> {
    try {
      const files = await fs.readdir(booksRoot);
      type Candidate = { full: string; ext: string; start: number; end: number };
      const candidates: Candidate[] = [];
      for (const f of files) {
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

  let zipPath = await tryDbMapping();
  if (!zipPath) zipPath = await scanDirForZip();
  if (!zipPath) throw new Error('Book archive not available on disk');

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const toLower = (s: string) => (s || '').toLowerCase();

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

  const archiveTypeMatch = /^f\.(\w+)\./i.exec(path.basename(zipPath));
  const archiveType = archiveTypeMatch && archiveTypeMatch[1] ? archiveTypeMatch[1].toLowerCase() : '';
  const baseExts = ['fb2', 'epub', 'djvu', 'pdf', 'mobi', 'txt', 'rtf', 'html', 'htm'];
  const preferredExts = Array.from(new Set([archiveType, requested, ...baseExts].filter(Boolean)));
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
  if (!found) {
    for (const ext of preferredExts) {
      const candidate = `${bookId}.${ext}`;
      const f = entries.find(e => toLower(e.entryName).endsWith('/' + candidate));
      if (f) { found = f; break; }
    }
  }
  if (!found) {
    for (const ext of preferredExts) {
      const f = entries.find(e => /(^|\/)\d+\.[a-z0-9]+$/i.test(e.entryName) && toLower(e.entryName).includes(`/${bookId}.`));
      if (f) { found = f; break; }
    }
  }
  if (!found) throw new Error('Book file not found in archive');

  return { zipPath, entryName: found.entryName, entryBuffer: found.getData() };
}

// Extract cover from FB2 XML buffer using heuristics
export function extractCoverFromFb2(fb2Buffer: Buffer): Buffer | null {
  try {
    const xml = fb2Buffer.toString('utf8');
    const coverIdMatch = xml.match(/<binary[^>]*id=["']([^"']*cover[^"']*)["'][^>]*>([\s\S]*?)<\/binary>/i);
    if (coverIdMatch && coverIdMatch[2]) {
      const b64 = coverIdMatch[2].replace(/\s+/g, '');
      try { return Buffer.from(b64, 'base64'); } catch {}
    }
    const imgBinaryMatch = xml.match(/<binary[^>]*content-type=["']image\/(?:jpeg|jpg|png|gif|webp)["'][^>]*>([\s\S]*?)<\/binary>/i);
    if (imgBinaryMatch && imgBinaryMatch[1]) {
      const b64 = imgBinaryMatch[1].replace(/\s+/g, '');
      try { return Buffer.from(b64, 'base64'); } catch {}
    }
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

    const container = getEntry('META-INF/container.xml');
    let opfPath = '';
    if (container) {
      const xml = readText(container);
      const m = xml.match(/full-path=["']([^"']+)["']/i);
      if (m) opfPath = m[1];
    }
    if (opfPath) {
      const opf = getEntry(opfPath);
      if (opf) {
        const opfXml = readText(opf);
        const meta = opfXml.match(/<meta[^>]*name=["']cover["'][^>]*content=["']([^"']+)["'][^>]*>/i);
        let coverHref = '';
        if (meta) {
          const coverId = meta[1];
          const itemMatch = opfXml.match(new RegExp(`<item[^>]*id=["']${coverId}["'][^>]*href=["']([^"']+)["'][^>]*>`, 'i'));
          if (itemMatch) coverHref = itemMatch[1];
        }
        if (!coverHref) {
          const guideMatch = opfXml.match(/<reference[^>]*type=["']cover["'][^>]*href=["']([^"']+)["'][^>]*>/i);
          if (guideMatch) coverHref = guideMatch[1];
        }
        if (!coverHref) {
          const propsMatch = opfXml.match(/<item[^>]*properties=["'][^"']*cover-image[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i);
          if (propsMatch) coverHref = propsMatch[1];
        }
        if (coverHref) {
          const baseDir = opfPath.split('/').slice(0, -1).join('/');
          const rel = baseDir ? `${baseDir}/${coverHref}` : coverHref;
          const norm = rel.replace(/\\/g, '/');
          const coverEntry = entries.find(e => e.entryName.toLowerCase() === norm.toLowerCase() || e.entryName.toLowerCase().endsWith('/' + norm.toLowerCase()));
          if (coverEntry) return coverEntry.getData();
        }
      }
    }
    const candidates = entries.filter(e => /(^|\/)cover\.(jpe?g|png|gif|webp)$/i.test(e.entryName) || /images\/(?:.*)cover/i.test(e.entryName));
    if (candidates.length > 0 && candidates[0]) return candidates[0]!.getData();
    const imageEntries = entries.filter(e => /(jpe?g|png|gif|webp)$/i.test(e.entryName));
    if (imageEntries.length) {
      imageEntries.sort((a, b) => b.header.size - a.header.size);
      if (imageEntries[0]) return imageEntries[0]!.getData();
    }
  } catch {}
  return null;
}
