import path from 'path';
import fs from 'fs/promises';
import logger from '../utils/logger';
import { getRow, getRows } from '../database/connection';
import { getBookZipEntry, extractCoverFromFb2, extractCoverFromEpub } from '../utils/cover';

function imageContentType(ext: string): string {
  const t: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
  return t[ext.toLowerCase()] || 'application/octet-stream';
}

function detectImageExt(buf: Buffer): 'jpg' | 'jpeg' | 'png' | 'gif' | 'webp' | null {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

async function ensureDir(p: string) {
  try { await fs.mkdir(p, { recursive: true }); }
  catch {}
}

function coversRoot() { return process.env.COVERS_CACHE_PATH || '/app/cache/covers'; }

class CoverCacheService {
  private inFlight: Map<number, Promise<string | null>> = new Map();
  private queue: number[] = [];
  private running = 0;
  private concurrency = Math.max(1, Math.min(8, Number(process.env.COVERS_CONCURRENCY || 3)));
  private progress: {
    active: boolean;
    mode: 'recent'|'missing'|'all';
    limit: number;
    processed: number;
    cached: number;
    errors: number;
    startedAt: string | null;
    lastUpdatedAt: string | null;
    done: boolean;
  } = {
    active: false,
    mode: 'missing',
    limit: 0,
    processed: 0,
    cached: 0,
    errors: 0,
    startedAt: null,
    lastUpdatedAt: null,
    done: false
  };

  getProgress() {
    return { ...this.progress };
  }

  stopPrecaching() {
    if (this.progress.active) {
      logger.info('Stopping cover precaching operation');
      this.progress.active = false;
      this.progress.done = true;
      this.progress.lastUpdatedAt = new Date().toISOString();
    }
  }

  async isCached(bookId: number): Promise<string | null> {
    const root = coversRoot();
    const exts = ['jpg','jpeg','png','gif','webp'];
    for (const ext of exts) {
      const p = path.join(root, `${bookId}.${ext}`);
      try { await fs.access(p); return p; }
      catch {}
    }
    return null;
  }

  schedule(bookId: number) {
    if (this.inFlight.has(bookId)) return;
    if (!this.queue.includes(bookId)) this.queue.push(bookId);
    this.pump();
  }

  private pump() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const id = this.queue.shift()!;
      if (this.inFlight.has(id)) continue;
      const p = this.ensureCached(id).catch((e) => { logger.warn('Cover ensureCached failed', { bookId: id, error: (e as Error).message }); return null; })
        .finally(() => { this.inFlight.delete(id); this.running--; this.pump(); });
      this.inFlight.set(id, p);
      this.running++;
    }
  }

  async ensureCached(bookId: number): Promise<string | null> {
    // Already cached
    const cached = await this.isCached(bookId);
    if (cached) return cached;

    const root = coversRoot();
    await ensureDir(root);

    // Try libbpics (lib.b.attached.zip)
    try {
      const row = await getRow(`SELECT file FROM libbpics WHERE bookid=$1 LIMIT 1`, [bookId]);
      if (row && row.file) {
        const zipPath = path.join(process.env.CACHE_PATH || '/app/cache', 'lib.b.attached.zip');
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        try {
          await fs.access(zipPath);
          const { stdout } = await execFileAsync('unzip', ['-p', zipPath, row.file], { encoding: 'buffer', maxBuffer: 1024 * 1024 * 50 });
          const buf: Buffer = stdout as unknown as Buffer;
          if (buf && buf.length > 32) {
            const ext = detectImageExt(buf) || 'jpg';
            const out = path.join(root, `${bookId}.${ext}`);
            await fs.writeFile(out, buf);
            return out;
          }
        } catch (_e) {
          // fall through to extraction from book file
          logger.debug('lib.b cover extraction failed, fallback to book file', { bookId, error: (_e as Error).message });
        }
      }
  }
  catch {}

    // Fallback: open the book file and extract cover (fb2/epub)
    try {
      const requestedType = '';
      const { entryName, entryBuffer } = await getBookZipEntry(bookId, requestedType);
      const lower = (entryName || '').toLowerCase();
      let buf: Buffer | null = null;
      if (lower.endsWith('.fb2') || lower.endsWith('.xml')) buf = extractCoverFromFb2(entryBuffer);
      else if (lower.endsWith('.epub')) buf = extractCoverFromEpub(entryBuffer);
      if (buf && buf.length > 32) {
        const ext = detectImageExt(buf) || 'jpg';
        const out = path.join(root, `${bookId}.${ext}`);
        await fs.writeFile(out, buf);
        return out;
      }
    } catch (_e) {
      logger.debug('Fallback cover extraction failed', { bookId, error: (_e as Error).message });
    }
    return null;
  }

  async precacheAll(opts?: { limit?: number; mode?: 'recent'|'missing'|'all' }): Promise<{ processed: number; cached: number; errors: number; started: boolean }>{
    // Allow much higher limits for full database processing, but keep reasonable default
    const limit = Math.max(1, Math.min(1000000, opts?.limit || 1000));
    const mode = opts?.mode || 'missing';

    // If already running, return current status
    if (this.progress.active) {
      return { processed: this.progress.processed, cached: this.progress.cached, errors: this.progress.errors, started: false };
    }

    let rows: Array<{ bookid: number }> = [];
    if (mode === 'recent') {
      rows = await getRows(`SELECT bookid FROM libbook WHERE deleted='0' ORDER BY bookid DESC LIMIT $1`, [limit]);
    } else if (mode === 'all') {
      rows = await getRows(`SELECT bookid FROM libbook WHERE deleted='0' ORDER BY bookid ASC LIMIT $1`, [limit]);
    } else { // missing
      // Heuristic: try recent ids first and check cache presence quickly
      rows = await getRows(`SELECT bookid FROM libbook WHERE deleted='0' ORDER BY bookid DESC LIMIT $1`, [limit*2]);
    }

    // initialize progress
    this.progress.active = true;
    this.progress.mode = mode as any;
    this.progress.limit = Math.min(limit, rows.length);
    this.progress.processed = 0;
    this.progress.cached = 0;
    this.progress.errors = 0;
    this.progress.startedAt = new Date().toISOString();
    this.progress.lastUpdatedAt = this.progress.startedAt;
    this.progress.done = false;

    // Start background processing
    this.runBackgroundProcessing(rows, mode).catch(error => {
      logger.error('Background cover processing error:', error);
      this.progress.active = false;
      this.progress.done = true;
    });

    // Return immediately with initial status
    return { processed: 0, cached: 0, errors: 0, started: true };
  }

  private async runBackgroundProcessing(rows: Array<{ bookid: number }>, mode: string) {
    let processed = 0, cached = 0, errors = 0;
    
    for (const r of rows) {
      // Check if we should stop (e.g., if progress was reset)
      if (!this.progress.active) break;
      
      const id = Number(r.bookid);
      try {
        const is = await this.isCached(id);
        if (mode === 'missing' && is) {
          // skip already cached in missing mode
          this.progress.lastUpdatedAt = new Date().toISOString();
          continue;
        }
        processed++;
        const out = await this.ensureCached(id);
        if (out) cached++;
      } catch { errors++; }
      
      // update progress snapshot
      this.progress.processed = processed;
      this.progress.cached = cached;
      this.progress.errors = errors;
      this.progress.lastUpdatedAt = new Date().toISOString();
      
      // Small delay to prevent overwhelming the system
      if (processed % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
    
    // finalize progress
    this.progress.processed = processed;
    this.progress.cached = cached;
    this.progress.errors = errors;
    this.progress.done = true;
    this.progress.active = false;
    this.progress.lastUpdatedAt = new Date().toISOString();
    
    logger.info(`Cover precaching completed: ${processed} processed, ${cached} cached, ${errors} errors`);
  }

  getStats() {
    return {
      queue: this.queue.length,
      running: this.running,
      inFlight: this.inFlight.size,
      concurrency: this.concurrency,
      progress: { ...this.progress }
    };
  }
}

export default new CoverCacheService();
export { imageContentType };
