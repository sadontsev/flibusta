#!/usr/bin/env node

import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';
import DatabaseManager from './DatabaseManager';
import logger from '../utils/logger';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const dbManager = new DatabaseManager();

// Configure yargs
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 <command> [options]')
  .command('download-sql', 'Download SQL files from flibusta.is', {}, async () => {
    try {
      await dbManager.downloadSqlFiles();
      console.log('✅ SQL files downloaded successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ SQL download failed:', (error as Error).message);
      process.exit(1);
    }
  })
  .command('download-covers', 'Download cover and author image files', {}, async () => {
    try {
      await dbManager.downloadCoverFiles();
      console.log('✅ Cover files downloaded successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Cover download failed:', (error as Error).message);
      process.exit(1);
    }
  })
  .command('update-daily', 'Download daily book updates', {}, async () => {
    try {
      await dbManager.updateDailyBooks();
      console.log('✅ Daily books updated successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Daily update failed:', (error as Error).message);
      process.exit(1);
    }
  })
  .command('update-zip-mappings', 'Scan and update ZIP file mappings', {}, async () => {
    try {
      const result = await dbManager.updateZipMappings();
      console.log(`✅ ZIP mappings updated successfully`);
      process.exit(0);
    } catch (error) {
      console.error('❌ ZIP mappings update failed:', (error as Error).message);
      process.exit(1);
    }
  })
  .command('create-missing-filenames', 'Create missing filename entries', {}, async () => {
    try {
      const result = await dbManager.createMissingFilenames();
      console.log(`✅ Missing filename entries created successfully`);
      process.exit(0);
    } catch (error) {
      console.error('❌ Create missing filenames failed:', (error as Error).message);
      process.exit(1);
    }
  })
  .command('update-search-vectors', 'Update search vectors for full-text search', {}, async () => {
    try {
      await dbManager.updateSearchVectors();
      console.log('✅ Search vectors updated successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Search vectors update failed:', (error as Error).message);
      process.exit(1);
    }
  })
  .command('health-check', 'Perform database health check', {}, async () => {
    try {
      const health = await dbManager.healthCheck();
      if (health.healthy) {
        console.log('✅ Database health check passed');
      } else {
        console.log('⚠️  Database health check found issues:');
        health.issues.forEach(issue => console.log(`  - ${issue}`));
      }
      process.exit(health.healthy ? 0 : 1);
    } catch (error) {
      console.error('❌ Health check failed:', (error as Error).message);
      process.exit(1);
    }
  })
  .command('stats', 'Show database statistics', {}, async () => {
    try {
      const stats = await dbManager.getDatabaseStats();
      console.log('📊 Database Statistics:');
      console.log(`  Total Size: ${stats.total_size}`);
      console.log(`  Tables: ${stats.table_count}`);
      console.log(`  Indexes: ${stats.index_count}`);
      console.log(`  Connections: ${stats.connection_count}`);
      console.log(`  Cache Hit Ratio: ${stats.cache_hit_ratio.toFixed(2)}%`);
      console.log(`  Transactions/sec: ${stats.transactions_per_second}`);
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to get stats:', (error as Error).message);
      process.exit(1);
    }
  })
  .command('audit-archives', 'Audit DB book_zip ranges against physical ZIP files to find missing or truncated archives', {}, async () => {
    try {
      const root = process.env.BOOKS_PATH || '/app/flibusta';
      const { readdir, stat } = await import('fs/promises');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const pexec = promisify(exec);
      const pathModule = await import('path');
      const db = (await import('../database/connection'));
      const getRows = db.getRows as (sql:string, params?:any[])=>Promise<any[]>;
      const getRow = db.getRow as (sql:string, params?:any[])=>Promise<any>;

      console.log(`🔍 Auditing archives in ${root}`);
      let files: string[] = [];
      try { files = await readdir(root); } catch (e) { console.error('Cannot read books directory:', (e as Error).message); process.exit(2); }

      // Parse archives and build index
      interface Arc { name:string; type:string; start:number; end:number; fullPath:string; exists:boolean; }
      const arcs: Arc[] = [];
  const rx = /^(f\.)?(fb2|epub|djvu|pdf|mobi|txt)\.(\d+)-(\d+)\.zip$/i; // dot pattern f.fb2.123-456.zip
  const rxAlt = /^(f\.)?(fb2|epub|djvu|pdf|mobi|txt)-(\d+)-(\d+)\.zip$/i; // dash pattern f.fb2-123-456.zip
      for (const f of files) {
        let match: RegExpExecArray | null = rx.exec(f);
        if (!match) match = rxAlt.exec(f);
        if (match) {
          // Normalize indices depending on which pattern matched
          // rx: 1(optional f.),2=type,3=start,4=end
          // rxAlt: 1(optional f.),2=type,3=start,4=end (same indices after adjustment)
          const type = (match[2] || '').toLowerCase();
          const start = parseInt(match[3] || 'NaN', 10);
          const end = parseInt(match[4] || 'NaN', 10);
          if (type && !Number.isNaN(start) && !Number.isNaN(end)) {
            arcs.push({ name: f, type, start, end, fullPath: pathModule.join(root, f), exists: true });
          }
        }
      }

      if (!arcs.length) {
        console.warn('⚠️  No matching archives found. Mount may be missing or BOOKS_PATH incorrect.');
      }

      // Build quick lookup per type sorted
      const byType: Record<string, Arc[]> = {};
  for (const a of arcs) { (byType[a.type] = byType[a.type] || []).push(a); }
      Object.values(byType).forEach(list => list.sort((a,b)=>a.start-b.start));

      // Detect gaps per type
      interface Gap { type:string; gapStart:number; gapEnd:number; reason:string; }
      const gaps: Gap[] = [];
      for (const [type, list] of Object.entries(byType)) {
        let lastEnd: number | null = null;
        for (const arc of list) {
          if (lastEnd !== null && arc.start > lastEnd + 1) {
            gaps.push({ type, gapStart: lastEnd + 1, gapEnd: arc.start - 1, reason: 'no archive range covers these IDs' });
          }
          lastEnd = Math.max(lastEnd ?? arc.end, arc.end);
        }
      }

      // Sample latest DB mappings to detect mismatches / truncations
  const sampleMappings = await getRows(`SELECT filename, start_id, end_id, usr FROM book_zip ORDER BY end_id DESC LIMIT 60`);
      interface MappingIssue { filename:string; start_id:number; end_id:number; issue:string; details?:any }
      const mappingIssues: MappingIssue[] = [];
      const zipInfoCache: Record<string,{maxId:number, count:number}|null> = {};

      async function inspectZip(fullPath: string): Promise<{maxId:number, count:number}|null> {
        if (zipInfoCache[fullPath] !== undefined) return zipInfoCache[fullPath];
        try {
          // Use unzip -l to avoid loading whole archive into memory
          const { stdout } = await pexec(`unzip -l "${fullPath}"`);
          let maxId = -1; let count = 0;
            for (const line of stdout.split(/\r?\n/)) {
              // lines contain: size date time name
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 4) {
                const name = parts[3];
                const m = /^(\d+)\.(fb2|epub|djvu|pdf|mobi|txt)$/i.exec(name || '');
                if (m && m[1]) { const id = parseInt(m[1], 10); if (!Number.isNaN(id)) { if (id > maxId) maxId = id; count++; } }
              }
            }
          const res = { maxId, count };
          zipInfoCache[fullPath] = res;
          return res;
        } catch (e) {
          zipInfoCache[fullPath] = null;
          return null;
        }
      }

      for (const m of sampleMappings) {
        const fname = m.filename as string;
        const arc = arcs.find(a => a.name === fname);
        if (!arc) {
          mappingIssues.push({ filename: fname, start_id: m.start_id, end_id: m.end_id, issue: 'file_missing' });
          continue;
        }
        const inspected = await inspectZip(arc.fullPath);
        if (!inspected) {
          mappingIssues.push({ filename: fname, start_id: m.start_id, end_id: m.end_id, issue: 'cannot_read_zip' });
          continue;
        }
        if (inspected.maxId !== -1 && inspected.maxId < m.end_id) {
          mappingIssues.push({ filename: fname, start_id: m.start_id, end_id: m.end_id, issue: 'truncated_archive', details: { reportedEnd: m.end_id, actualMax: inspected.maxId, fileEntries: inspected.count } });
        }
      }

      // Check highest book IDs vs archive coverage
      const maxBookRow = await getRow('SELECT MAX(bookid) AS max FROM libbook');
      const maxBookId = parseInt((maxBookRow?.max as string) || '0', 10);
      const coveredMax = Math.max(...arcs.map(a => a.end), 0);
      const tailGap = (coveredMax < maxBookId) ? { from: coveredMax + 1, to: maxBookId } : null;

      const summary = {
        booksPath: root,
        archiveCount: arcs.length,
        maxBookId,
        coveredMax,
        uncoveredTail: tailGap,
        typeCounts: Object.fromEntries(Object.entries(byType).map(([t,l]) => [t, l.length])),
        gaps,
        mappingIssues,
      };

      console.log('\n===== ARCHIVE AUDIT SUMMARY =====');
      console.log(JSON.stringify(summary, null, 2));
      console.log('=================================');

      if (mappingIssues.some(i => i.issue !== '')) {
        process.exitCode = 3; // non-zero to indicate issues found
      } else {
        process.exitCode = 0;
      }
    } catch (error) {
      console.error('❌ Audit failed:', (error as Error).message);
      process.exit(1);
    }
  })
  .command('reconcile-zip-ranges', 'Scan all book archives (fb2/epub/djvu/pdf/mobi/txt) and reconcile book_zip table with actual min/max IDs', (y)=> y
    .option('apply', { type: 'boolean', default: true, describe: 'Apply changes (disable for dry run)' })
    .option('includeN', { type: 'boolean', default: false, describe: 'Also include f.n.* archives (experimental)' })
    .option('limit', { type: 'number', describe: 'Limit number of archives processed (debug)' })
  , async (args) => {
    const startTs = Date.now();
    try {
      const root = process.env.BOOKS_PATH || '/app/flibusta';
      console.log(`🛠  Reconciling archive ranges in ${root}`);
      const { readdir } = await import('fs/promises');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const pexec = promisify(exec);
      const pathModule = await import('path');
  const db = (await import('../database/connection'));
  const getRows = db.getRows as (sql:string, params?:any[])=>Promise<any[]>;
  const getRow = db.getRow as (sql:string, params?:any[])=>Promise<any>;
  const queryExec = db.query as (sql:string, params?:any[])=>Promise<any>;

      const files = await readdir(root);
      const rxRangeDot = /^f\.(fb2|epub|djvu|pdf|mobi|txt)\.(\d+)-(\d+)\.zip$/i;
      const rxRangeDash = /^f\.(fb2|epub|djvu|pdf|mobi|txt)-(\d+)-(\d+)\.zip$/i;
      const rxDate = /^f\.(fb2|epub|djvu|pdf|mobi|txt)\.(\d{8})\.zip$/i; // dated daily snapshots
      const rxN = /^f\.n\.(\d+)-(\d+)\.zip$/i;

  interface Scan { filename:string; fullPath:string; type:string; declaredStart:number; declaredEnd:number; mode:'range'|'date'|'n'; actualStart:number|null; actualEnd:number|null; count:number; truncated?:boolean }
      const scans: Scan[] = [];
      for (const f of files) {
        let m:RegExpExecArray|null = null;
        if ((m = rxRangeDot.exec(f)) !== null) {
          const type = m[1]?.toLowerCase() || 'unknown';
          const start = parseInt(m[2] || '-1',10);
          const end = parseInt(m[3] || '-1',10);
          if (start>=0 && end>=0) scans.push({ filename:f, fullPath:pathModule.join(root,f), type, declaredStart:start, declaredEnd:end, mode:'range', actualStart:null, actualEnd:null, count:0 });
          continue;
        }
        if ((m = rxRangeDash.exec(f)) !== null) {
          const type = m[1]?.toLowerCase() || 'unknown';
          const start = parseInt(m[2] || '-1',10);
          const end = parseInt(m[3] || '-1',10);
          if (start>=0 && end>=0) scans.push({ filename:f, fullPath:pathModule.join(root,f), type, declaredStart:start, declaredEnd:end, mode:'range', actualStart:null, actualEnd:null, count:0 });
          continue;
        }
        if ((m = rxDate.exec(f)) !== null) {
          const type = m[1]?.toLowerCase() || 'unknown';
          scans.push({ filename:f, fullPath:pathModule.join(root,f), type, declaredStart:-1, declaredEnd:-1, mode:'date', actualStart:null, actualEnd:null, count:0 });
          continue;
        }
        if (args.includeN && (m = rxN.exec(f)) !== null) {
          const start = parseInt(m[1] || '-1',10);
          const end = parseInt(m[2] || '-1',10);
          if (start>=0 && end>=0) scans.push({ filename:f, fullPath:pathModule.join(root,f), type:'n', declaredStart:start, declaredEnd:end, mode:'n', actualStart:null, actualEnd:null, count:0 });
          continue;
        }
      }

      if (args.limit && args.limit > 0) {
        scans.splice(args.limit);
      }

      console.log(`Found ${scans.length} candidate archives (processing...)`);
      // Inspect each archive for actual min/max
      for (const s of scans) {
        try {
          const { stdout } = await pexec(`unzip -l "${s.fullPath}"`);
          let minId = Number.MAX_SAFE_INTEGER;
          let maxId = -1;
          let count = 0;
          for (const line of stdout.split(/\r?\n/)) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 4) {
              const name = parts[3];
              const mm = /^(\d+)\.(fb2|epub|djvu|pdf|mobi|txt)$/i.exec(name || '');
              if (mm && mm[1]) {
                const id = parseInt(mm[1]!,10);
                if (id < minId) minId = id;
                if (id > maxId) maxId = id;
                count++;
              }
            }
          }
          if (count > 0) {
            s.actualStart = (s.mode==='range' && s.declaredStart !== -1) ? Math.min(s.declaredStart, minId) : minId;
            s.actualEnd = (s.mode==='range' && s.declaredEnd !== -1) ? Math.min(maxId, s.declaredEnd) : maxId;
            s.count = count;
            if (s.mode==='range' && s.declaredEnd !== -1 && maxId < s.declaredEnd) {
              s.truncated = true;
              s.actualEnd = maxId;
            }
            if (s.mode==='date' && s.actualStart !== null && s.actualEnd !== null) {
              s.declaredStart = s.actualStart;
              s.declaredEnd = s.actualEnd;
            }
          } else {
            s.actualStart = null;
            s.actualEnd = null;
            s.count = 0;
          }
        } catch (e) {
          s.count = 0;
          s.actualStart = null;
          s.actualEnd = null;
        }
      }

      // Filter out empty or unreadable
  const usable = scans.filter(s => (s.count||0) > 0 && (s.actualStart !== null) && (s.actualEnd !== null) && (s.type !== 'n' || args.includeN));
      // Build SQL operations
      // Strategy: For each usable archive create or update row keyed by filename; set start_id, end_id.
      // We avoid deleting to preserve history, but mark truncated corrections.

      const upserts: {filename:string; start:number; end:number; truncated?:boolean}[] = usable.map(s => {
        const base = { filename: s.filename, start: s.actualStart as number, end: s.actualEnd as number } as {filename:string; start:number; end:number; truncated?:boolean};
        if (s.truncated) base.truncated = true;
        return base;
      });

      // Retrieve existing rows for comparison
      const existingRows = await getRows('SELECT filename, start_id, end_id FROM book_zip WHERE filename = ANY($1)', [upserts.map(u=>u.filename)]);
      const existingMap = new Map<string,{start:number; end:number}>(existingRows.map(r=>[r.filename,{start:parseInt(r.start_id,10), end:parseInt(r.end_id,10)}]));

      const changes = upserts.filter(u => {
        const ex = existingMap.get(u.filename);
        if (!ex) return true;
        return ex.start !== u.start || ex.end !== u.end;
      });

      console.log(`Archives usable: ${usable.length}; needing insert/update: ${changes.length}`);
      if (!args.apply) {
        console.log('--- DRY RUN (no DB changes) ---');
        console.log(JSON.stringify({ changes, truncated: changes.filter(c=>c.truncated).map(c=>c.filename) }, null, 2));
        process.exit(0);
      }

      // Perform upserts individually (portable). Could be optimized with UNNEST.
      let applied = 0;
      for (const c of changes) {
        const existing = await getRow('SELECT id FROM book_zip WHERE filename = $1 LIMIT 1', [c.filename]);
        if (existing && existing.id) {
          await queryExec('UPDATE book_zip SET start_id = $2, end_id = $3 WHERE id = $1', [existing.id, c.start, c.end]);
        } else {
          await queryExec('INSERT INTO book_zip (filename, start_id, end_id, usr) VALUES ($1,$2,$3,0)', [c.filename, c.start, c.end]);
        }
        applied++;
      }

      const durationMs = Date.now() - startTs;
      console.log(`✅ Reconciliation complete. Updated ${applied} rows in ${durationMs} ms.`);
      // Optional: warn about overlapping ranges anomalies
      const overlaps = [] as {a:string; b:string; range:[number,number]}[];
      const sorted = upserts.slice().sort((a,b)=>a.start-b.start);
      for (let i=1;i<sorted.length;i++) {
        const prev = sorted[i-1]!;
        const cur = sorted[i]!;
        if (cur && prev && cur.start <= prev.end) {
          overlaps.push({ a: prev.filename, b: cur.filename, range:[cur.start, Math.min(prev.end, cur.end)] });
        }
      }
      if (overlaps.length) {
        console.log('⚠️  Overlapping ranges detected (may be fine if intentional):');
        overlaps.slice(0,20).forEach(o=>console.log(`  ${o.a} <-> ${o.b} overlap ${o.range[0]}-${o.range[1]}`));
        if (overlaps.length>20) console.log(`  ... (${overlaps.length-20} more)`);
      }
      process.exit(0);
    } catch (error) {
      console.error('❌ Reconciliation failed:', (error as Error).message);
      process.exit(1);
    }
  })
  .command('purge-orphan-zip-mappings', 'Delete book_zip rows whose filename does not exist on disk', y => y
    .option('apply', { type: 'boolean', default: true, describe: 'Actually perform deletions (set false for dry run)' })
    .option('pattern', { type: 'string', describe: 'Optional filename regex filter (e.g. ^f\\.fb2\\.)' })
  , async (args) => {
    try {
      const root = process.env.BOOKS_PATH || '/app/flibusta';
      console.log(`🧹 Purging orphan zip mappings using root ${root}`);
      const { readdir } = await import('fs/promises');
      const pathModule = await import('path');
      const db = (await import('../database/connection'));
      const getRows = db.getRows as (sql:string, params?:any[])=>Promise<any[]>;
      const queryExec = db.query as (sql:string, params?:any[])=>Promise<any>;

      const diskFiles = new Set<string>((await readdir(root)).filter(f => f.endsWith('.zip')));
      console.log(`Found ${diskFiles.size} .zip files on disk`);

      const rows = await getRows('SELECT id, filename FROM book_zip');
      const regex = args.pattern ? new RegExp(args.pattern) : null;
      const orphans = rows.filter(r => {
        const name = r.filename as string;
        if (regex && !regex.test(name)) return false; // skip if doesn't match filter
        return !diskFiles.has(name);
      });
      console.log(`Identified ${orphans.length} orphan mappings${regex ? ' (filtered)' : ''}.`);

      if (!args.apply) {
        console.log('--- DRY RUN (no deletions) ---');
        console.log(JSON.stringify({ sample: orphans.slice(0,25).map(o=>o.filename), total: orphans.length }, null, 2));
        process.exit(0);
      }

      let deleted = 0;
      // Batch deletes in chunks to avoid huge single statement
      const chunkSize = 500;
      for (let i=0;i<orphans.length;i+=chunkSize) {
        const chunk = orphans.slice(i, i+chunkSize);
        const ids = chunk.map(c=>c.id);
        const placeholders = ids.map((_,idx)=>`$${idx+1}`).join(',');
        await queryExec(`DELETE FROM book_zip WHERE id IN (${placeholders})`, ids);
        deleted += chunk.length;
      }
      console.log(`✅ Deleted ${deleted} orphan rows.`);
      process.exit(0);
    } catch (error) {
      console.error('❌ Purge failed:', (error as Error).message);
      process.exit(1);
    }
  })
  .demandCommand(1, 'You need to specify a command')
  .help()
  .alias('h', 'help')
  .version('1.0.0')
  .alias('v', 'version')
  .epilogue('For more information, see: https://github.com/your-repo/flibusta-backend');

// Execute argument parsing (previously missing, commands wouldn't run)
argv.parse();