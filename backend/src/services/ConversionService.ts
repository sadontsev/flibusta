import path from 'path';
import fs from 'fs/promises';
import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';
import { spawn } from 'child_process';
import { IncomingMessage, RequestOptions as HttpRequestOptions, request as httpRequest } from 'http';
import { RequestOptions as HttpsRequestOptions, request as httpsRequest } from 'https';
import logger from '../utils/logger';
import { extractCoverFromFb2 } from '../utils/cover';

export type TargetFormat = 'epub' | 'mobi' | 'azw3' | 'pdf' | 'txt' | 'rtf' | 'html';

const ALL_TARGETS: TargetFormat[] = ['epub', 'mobi', 'azw3', 'pdf', 'txt', 'rtf', 'html'];

interface Fb2Meta {
  title?: string;
  authors: string[];
  lang?: string;
  date?: string;
  annotation?: string;
  sequences?: { name: string; number?: string }[];
}

/** Simple cache path resolver */
function conversionCachePath(bookId: number, format: TargetFormat): string {
  const base = process.env.CONVERSIONS_CACHE_PATH || '/app/cache/converted';
  return path.join(base, `${bookId}.${format}`);
}

async function ensureDir(p: string) {
  try { await fs.mkdir(p, { recursive: true }); }
  catch {}
}

export class ConversionService {
  private calibreDetected: boolean | null = null;
  private detecting: Promise<boolean> | null = null;
  private inProgress: Map<string, Promise<Buffer>> = new Map();

  /** Determine if calibre's ebook-convert is available (cached). */
  private async hasCalibre(): Promise<boolean> {
    // If external Calibre URL provided, treat as available
    if (process.env.CALIBRE_URL && process.env.CALIBRE_URL.trim() !== '') { this.calibreDetected = true; return true; }
    if (process.env.ENABLE_CALIBRE === '0') { this.calibreDetected = false; return false; }
    if (this.calibreDetected !== null) return this.calibreDetected;
    if (this.detecting) return this.detecting;
    this.detecting = new Promise<boolean>((resolve) => {
      const cmd = process.env.CALIBRE_EBOOK_CONVERT || 'ebook-convert';
      const child = spawn(cmd, ['--version']);
      let done = false;
      child.on('error', () => { if (!done) { done = true; this.calibreDetected = false; resolve(false); } });
      child.on('exit', (code) => { if (!done) { done = true; this.calibreDetected = code === 0; resolve(this.calibreDetected); } });
      setTimeout(() => { if (!done) { try { child.kill('SIGKILL'); }
        catch {}
        this.calibreDetected = false; resolve(false); } }, 5000);
    });
    const ok = await this.detecting; this.detecting = null; return ok;
  }

  /** Public accessor for calibre availability */
  public async isCalibreAvailable(): Promise<boolean> { return this.hasCalibre(); }

  /** Return list of convertible targets for a given source extension. */
  async listTargetsForSource(sourceExt: string): Promise<TargetFormat[]> {
    sourceExt = (sourceExt || '').toLowerCase();
    const has = await this.hasCalibre();
    if (has) {
      // All targets except identical (no point converting fb2->fb2 etc.)
      return ALL_TARGETS.filter(t => t !== sourceExt);
    }
    // Fallback: only fb2 -> epub supported internally
    if (['fb2', 'xml'].includes(sourceExt)) return ['epub'];
    return []; // no conversions available
  }

  /** Public API: convert raw book buffer of given source type to requested target. */
  async convert(bookId: number, sourceExt: string, target: TargetFormat, raw: Buffer): Promise<Buffer> {
    sourceExt = (sourceExt || '').toLowerCase();
    target = (target || '').toLowerCase() as TargetFormat;
    if (!ALL_TARGETS.includes(target)) throw new Error(`Unsupported target format: ${target}`);
    if (sourceExt === target) return raw; // already desired type

    const cacheFile = conversionCachePath(bookId, target);
    // Serve from cache if present & >1KB
    try {
      const st = await fs.stat(cacheFile);
      if (st.size > 1024) {
        logger.debug('Conversion cache hit', { bookId, target });
        return fs.readFile(cacheFile);
      }
    }
    catch {}

    const key = `${bookId}:${target}`;
    if (this.inProgress.has(key)) return this.inProgress.get(key)!;

    const promise = (async () => {
      const has = await this.hasCalibre();
      try {
        if (has) {
          return await this.convertViaCalibre(bookId, sourceExt, target, raw, cacheFile);
        }
        // Fallback path (only fb2 -> epub)
        if (target === 'epub' && (sourceExt === 'fb2' || sourceExt === 'xml')) {
          const out = await this.fb2ToEpub(bookId, raw); return out;
        }
        throw new Error(`Conversion from ${sourceExt} to ${target} not supported (calibre unavailable)`);
      } finally { this.inProgress.delete(key); }
    })();
    this.inProgress.set(key, promise);
    return promise;
  }

  /** Run calibre ebook-convert for arbitrary conversion. */
  private async convertViaCalibre(bookId: number, sourceExt: string, target: TargetFormat, raw: Buffer, cacheFile: string): Promise<Buffer> {
    // Prefer external microservice if configured
    if (process.env.CALIBRE_URL && process.env.CALIBRE_URL.trim() !== '') {
      const out = await this.convertViaCalibreService(bookId, sourceExt, target, raw);
      try { await ensureDir(path.dirname(cacheFile)); await fs.writeFile(cacheFile, out); } catch (e) { logger.warn('Failed to cache calibre conversion', { bookId, target, error: (e as Error).message }); }
      logger.info('Calibre service conversion complete', { bookId, from: sourceExt, to: target, size: out.length });
      return out;
    }

    const workDir = '/tmp/conversions';
    try { await fs.mkdir(workDir, { recursive: true }); }
    catch {}
    const inputPath = path.join(workDir, `${bookId}-src.${sourceExt || 'bin'}`);
    const outputPath = path.join(workDir, `${bookId}-out.${target}`);
    await fs.writeFile(inputPath, raw);

    const cmd = process.env.CALIBRE_EBOOK_CONVERT || 'ebook-convert';
    logger.info('Starting calibre conversion', { bookId, from: sourceExt, to: target });

    await new Promise<void>((resolve, reject) => {
      const child = spawn(cmd, [inputPath, outputPath], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', d => { stderr += d.toString(); });
      const timeoutMs = Number(process.env.CALIBRE_CONVERSION_TIMEOUT_MS || 120000); // 2 min default
      const timer = setTimeout(() => { try { child.kill('SIGKILL'); }
        catch {}
        reject(new Error(`Calibre conversion timeout after ${timeoutMs}ms`)); }, timeoutMs);
      child.on('error', err => { clearTimeout(timer); reject(err); });
      child.on('exit', code => {
        clearTimeout(timer);
        if (code === 0) return resolve();
        reject(new Error(`Calibre failed (code ${code}): ${stderr.slice(0,500)}`));
      });
    });

    let out: Buffer;
    try { out = await fs.readFile(outputPath); } catch (e) { throw new Error(`Calibre output missing: ${(e as Error).message}`); }
    try { await ensureDir(path.dirname(cacheFile)); await fs.writeFile(cacheFile, out); } catch (e) { logger.warn('Failed to cache calibre conversion', { bookId, target, error: (e as Error).message }); }
    logger.info('Calibre conversion complete', { bookId, from: sourceExt, to: target, size: out.length });
    return out;
  }

  /** Invoke external Calibre HTTP microservice */
  private async convertViaCalibreService(bookId: number, sourceExt: string, target: TargetFormat, raw: Buffer): Promise<Buffer> {
    const base = (process.env.CALIBRE_URL || '').replace(/\/$/, '');
    const urlStr = `${base}/convert?from=${encodeURIComponent(sourceExt || 'bin')}&to=${encodeURIComponent(target)}`;
    logger.info('Calling Calibre service', { bookId, url: urlStr });
    const isHttps = urlStr.startsWith('https://');
    const timeoutMs = Number(process.env.CALIBRE_CONVERSION_TIMEOUT_MS || 180000);
    const u = new URL(urlStr);
    const headers: Record<string, string | number> = {
      'Content-Type': 'application/octet-stream',
      'Content-Length': Buffer.byteLength(raw)
    };
    if (u.username || u.password) {
      const auth = Buffer.from(`${u.username}:${u.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }
    const options: HttpRequestOptions | HttpsRequestOptions = {
      method: 'POST',
      hostname: u.hostname,
      port: u.port ? Number(u.port) : (isHttps ? 443 : 80),
      path: `${u.pathname}${u.search}`,
      headers
    };
    const reqFn = isHttps ? httpsRequest : httpRequest;
    return await new Promise<Buffer>((resolve, reject) => {
      const req = reqFn(options, (res: IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const status = res.statusCode || 0;
          if (status >= 200 && status < 300) return resolve(buf);
          const msg = buf.toString('utf8');
          return reject(new Error(`Calibre service error ${status}: ${msg.slice(0, 500)}`));
        });
      });
      req.on('error', reject);
      req.setTimeout(timeoutMs, () => { try { req.destroy(new Error('Calibre service timeout')); }
        catch {} });
      req.write(raw);
      req.end();
    });
  }

  /** High-level FB2 -> EPUB conversion with naive XHTML rendering (fallback when calibre is absent) */
  private async fb2ToEpub(bookId: number, fb2Buffer: Buffer): Promise<Buffer> {
    const cacheFile = conversionCachePath(bookId, 'epub');
    // Serve cached if exists and > 1KB
    try {
      const stat = await fs.stat(cacheFile);
      if (stat.size > 1024) {
        logger.debug('Conversion cache hit', { bookId, target: 'epub' });
        return fs.readFile(cacheFile);
      }
  }
  catch {}

    const fb2Text = fb2Buffer.toString('utf8');
    let meta: Fb2Meta = { authors: [] };

    // Helpers to safely navigate xml2js output without using any/unknown pervasively
    type XmlObject = Record<string, unknown>;
    const asObj = (v: unknown): XmlObject => (v && typeof v === 'object' ? v as XmlObject : {});
    const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
    const asStr = (v: unknown): string => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && '_' in (v as Record<string, unknown>)) {
        const u = (v as Record<string, unknown>)['_'];
        if (typeof u === 'string') return u;
      }
      return String(v ?? '');
    };

    try {
      const parsed = await parseStringPromise(fb2Text, { explicitArray: true, mergeAttrs: true }) as XmlObject;
      const root = asObj(parsed['FictionBook'] ?? parsed['fictionbook']);
      const desc = asObj(asArr(root['description'])[0]);
      const titleInfo = asObj(asArr(desc['title-info'])[0]);

      const authorsArr: string[] = [];
      for (const a of asArr(titleInfo['author'])) {
        const ao = asObj(a);
        const first = asStr(asArr(ao['first-name'])[0]).trim();
        const last = asStr(asArr(ao['last-name'])[0]).trim();
        const nick = asStr(asArr(ao['nickname'])[0]).trim();
        const full = [last, (first || nick)].filter(Boolean).join(' ').trim();
        if (full) authorsArr.push(full);
      }

      const sequences: { name: string; number?: string }[] = [];
      for (const s of asArr(titleInfo['sequence'])) {
        const so = asObj(s);
        const name = asStr(so['name']).trim();
        if (!name) continue;
        const numberVal = asStr(so['number']).trim();
        if (numberVal) sequences.push({ name, number: numberVal });
        else sequences.push({ name });
      }

      // Build meta without assigning explicit undefined to optional props (exactOptionalPropertyTypes)
      const built: Fb2Meta = { authors: authorsArr };
      const titleVal = asStr(asArr(titleInfo['book-title'])[0]).trim();
      if (titleVal) built.title = titleVal;
      const langVal = asStr(asArr(titleInfo['lang'])[0]).trim();
      if (langVal) built.lang = langVal;
      const dateVal = asStr(asArr(titleInfo['date'])[0]).trim();
      if (dateVal) built.date = dateVal;
      const annotationVal = (() => {
        const annObj = asObj(asArr(titleInfo['annotation'])[0]);
        const parts = asArr(annObj['p']).map((p) => asStr(p));
        return parts.join('\n').trim();
      })();
      if (annotationVal) built.annotation = annotationVal;
      if (sequences.length) built.sequences = sequences;
      meta = built;
    } catch (_e) {
      logger.warn('FB2 parse failed, proceeding with fallback XHTML', { bookId, error: (_e as Error).message });
    }

    // Naive body extraction: keep text within <body> tags; if parse failed use regex.
    let bodyHtml = '';
    try {
      // Quick transform: replace common FB2 tags with HTML equivalents
      const bodyMatches = fb2Text.match(/<body[\s\S]*?<\/body>/gi) || [];
      const transformed = bodyMatches.map(b => {
        return b
          .replace(/<body[^>]*>/gi, '')
          .replace(/<\/body>/gi, '')
          .replace(/<section>/gi, '<div class="section">')
          .replace(/<\/section>/gi, '</div>')
          .replace(/<p>/gi, '<p>')
          .replace(/<\/p>/gi, '</p>')
          .replace(/<emphasis>/gi, '<em>')
          .replace(/<\/emphasis>/gi, '</em>')
          .replace(/<strong>/gi, '<strong>')
          .replace(/<\/strong>/gi, '</strong>')
          .replace(/<subtitle>/gi, '<h3>')
          .replace(/<\/subtitle>/gi, '</h3>')
          .replace(/<title>/gi, '<h2>')
          .replace(/<\/title>/gi, '</h2>')
          .replace(/<epigraph>/gi, '<blockquote class="epigraph">')
          .replace(/<\/epigraph>/gi, '</blockquote>')
          // Remove binary blocks & styles
          .replace(/<binary[\s\S]*?<\/binary>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          ;
      }).join('\n');
      bodyHtml = transformed || '<p>(No content)</p>';
    } catch {
      bodyHtml = '<p>(Failed to extract content)</p>';
    }

    const xhtml = `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<html xmlns="http://www.w3.org/1999/xhtml">\n<head>\n` +
      `<meta charset="utf-8" />\n<title>${escapeHtml(meta.title || 'Untitled')}</title>\n` +
      `<meta name="generator" content="Flibusta ConversionService" />\n` +
      (meta.authors.length ? `<meta name="author" content="${escapeHtml(meta.authors.join(', '))}" />\n` : '') +
      `</head>\n<body>\n<h1>${escapeHtml(meta.title || 'Untitled')}</h1>\n` +
      (meta.annotation ? `<div class="annotation">${escapeHtml(meta.annotation)}</div>` : '') +
      bodyHtml + '\n</body>\n</html>';

    // Cover (if present)
    let coverBuffer: Buffer | null = null;
    try { coverBuffer = extractCoverFromFb2(fb2Buffer); }
    catch {}

    // Build EPUB structure
  const zip = new AdmZip();
  // Add mimetype uncompressed per spec
  zip.addFile('mimetype', Buffer.from('application/epub+zip'), '', 0);
    zip.addFile('META-INF/container.xml', Buffer.from(`<?xml version="1.0"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`));
    zip.addFile('OEBPS/index.xhtml', Buffer.from(xhtml, 'utf8'));

    let manifestItems = `<item id="index" href="index.xhtml" media-type="application/xhtml+xml"/>`;
    let spineItems = `<itemref idref="index"/>`;
    if (coverBuffer) {
      zip.addFile('OEBPS/cover.jpg', coverBuffer);
      manifestItems += `\n<item id="cover-image" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>`;
    }

    const metaXml = `<?xml version="1.0" encoding="utf-8"?>\n<package version="3.0" unique-identifier="BookId" xmlns="http://www.idpf.org/2007/opf">\n` +
      `<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n` +
      `<dc:identifier id="BookId">urn:flibusta:book:${bookId}</dc:identifier>\n` +
      `<dc:title>${escapeXml(meta.title || 'Untitled')}</dc:title>\n` +
      meta.authors.map(a => `<dc:creator>${escapeXml(a)}</dc:creator>`).join('\n') + '\n' +
      (meta.lang ? `<dc:language>${escapeXml(meta.lang)}</dc:language>` : '<dc:language>ru</dc:language>') + '\n' +
      (meta.date ? `<dc:date>${escapeXml(meta.date)}</dc:date>` : '') + '\n' +
      `</metadata>\n<manifest>\n${manifestItems}\n</manifest>\n<spine>\n${spineItems}\n</spine>\n</package>`;
    zip.addFile('OEBPS/content.opf', Buffer.from(metaXml, 'utf8'));

    const outBuffer = zip.toBuffer();
    try {
      await ensureDir(path.dirname(cacheFile));
      await fs.writeFile(cacheFile, outBuffer);
    } catch (e) {
      logger.warn('Failed to write conversion cache', { bookId, target: 'epub', error: (e as Error).message });
    }
    return outBuffer;
  }
}

function escapeHtml(s: string): string { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)); }
function escapeXml(s: string): string { return escapeHtml(s); }

export default new ConversionService();
