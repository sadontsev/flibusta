import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { getRow, query } from '../database/connection';
import logger from '../utils/logger';
import { DatabaseStats, HealthCheckResult } from '../types/index';
import UpdateService from '../services/UpdateService';

interface DownloadResult {
    success: boolean;
    file: string;
    error?: string;
}

interface UpdateResult {
    success: boolean;
    message: string;
    recordsProcessed?: number;
}

class DatabaseManager {
    private sqlPath: string;
    private flibustaPath: string;
    private cachePath: string;

    constructor() {
        this.sqlPath = process.env.SQL_PATH || '/app/sql';
        this.flibustaPath = process.env.BOOKS_PATH || '/app/flibusta';
        this.cachePath = process.env.CACHE_PATH || '/app/cache';
    }

    /**
     * Download SQL files from flibusta.is
     */
    async downloadSqlFiles(): Promise<DownloadResult[]> {
        logger.info('Starting SQL files download...');
        
        const sqlFiles = [
            'lib.libavtor.sql.gz',
            'lib.libavtoraliase.sql.gz',
            'lib.libtranslator.sql.gz',
            'lib.libavtorname.sql.gz',
            'lib.libbook.sql.gz',
            'lib.libfilename.sql.gz',
            'lib.libgenre.sql.gz',
            'lib.libgenrelist.sql.gz',
            'lib.libjoinedbooks.sql.gz',
            'lib.librate.sql.gz',
            'lib.librecs.sql.gz',
            'lib.libseqname.sql.gz',
            'lib.libseq.sql.gz',
            'lib.reviews.sql.gz',
            'lib.a.annotations.sql.gz',
            'lib.b.annotations.sql.gz',
            'lib.a.annotations_pics.sql.gz',
            'lib.b.annotations_pics.sql.gz'
        ];

        const results: DownloadResult[] = [];

        try {
            // Ensure SQL directory exists
            await fs.mkdir(path.join(this.sqlPath), { recursive: true });

            // Download each file
            for (const file of sqlFiles) {
                try {
                    const url = `http://flibusta.is/sql/${file}`;
                    const outputPath = path.join(this.sqlPath, file);
                    
                    logger.info(`Downloading ${file}...`);
                    execSync(`wget -q "${url}" -O "${outputPath}"`);
                    
                    results.push({
                        success: true,
                        file: file
                    });
                } catch (error) {
                    logger.error(`Failed to download ${file}:`, error);
                    results.push({
                        success: false,
                        file: file,
                        error: (error as Error).message
                    });
                }
            }

            logger.info('SQL files download completed');
            return results;
        } catch (error) {
            logger.error('SQL files download failed:', error);
            throw error;
        }
    }

    /**
     * Download cover files
     */
    async downloadCoverFiles(): Promise<UpdateResult> {
        logger.info('Starting cover files download...');
        
        try {
            const updater = new UpdateService();
            const results = await updater.updateCovers();
            const ok = results.every(r => r.status === 'success');
            return {
                success: ok,
                message: ok ? 'Cover files ensured/updated successfully' : 'Some cover updates failed; check logs'
            };
        } catch (error) {
            logger.error('Cover files download failed:', error);
            return {
                success: false,
                message: (error as Error).message
            };
        }
    }

    /**
     * Update daily books from downloaded files
     */
    async updateDailyBooks(): Promise<UpdateResult> {
        logger.info('Starting daily books update...');
        
        try {
            const updater = new UpdateService();
            const results = await updater.updateDailyBooks();
            const ok = results.every(r => r.status === 'success');
            return {
                success: ok,
                message: ok ? 'Daily books downloaded successfully' : 'Some daily downloads failed; check logs'
            };
        } catch (error) {
            logger.error('Daily books update failed:', error);
            return {
                success: false,
                message: (error as Error).message
            };
        }
    }

    /**
     * Update ZIP file mappings
     */
    async updateZipMappings(): Promise<UpdateResult> {
        logger.info('Starting ZIP mappings update...');
        
        try {
            const result = await query(`
                INSERT INTO book_mappings (book_id, zip_file, internal_path)
                SELECT 
                    lb.BookId,
                    CASE 
                        WHEN lf.FileType = 'fb2' THEN 'f.fb2.' || LPAD((lb.BookId / 1000)::text, 6, '0') || '.zip'
                        WHEN lf.FileType = 'epub' THEN 'f.epub.' || LPAD((lb.BookId / 1000)::text, 6, '0') || '.zip'
                        WHEN lf.FileType = 'djvu' THEN 'f.djvu.' || LPAD((lb.BookId / 1000)::text, 6, '0') || '.zip'
                    END as zip_file,
                    lf.File as internal_path
                FROM libbook lb
                JOIN libfilename lf ON lb.BookId = lf.BookId
                WHERE NOT EXISTS (
                    SELECT 1 FROM book_mappings bm 
                    WHERE bm.book_id = lb.BookId 
                    AND bm.zip_file = CASE 
                        WHEN lf.FileType = 'fb2' THEN 'f.fb2.' || LPAD((lb.BookId / 1000)::text, 6, '0') || '.zip'
                        WHEN lf.FileType = 'epub' THEN 'f.epub.' || LPAD((lb.BookId / 1000)::text, 6, '0') || '.zip'
                        WHEN lf.FileType = 'djvu' THEN 'f.djvu.' || LPAD((lb.BookId / 1000)::text, 6, '0') || '.zip'
                    END
                )
            `);

            return {
                success: true,
                message: 'ZIP mappings updated successfully',
                recordsProcessed: result.rowCount || 0
            };
        } catch (error) {
            logger.error('ZIP mappings update failed:', error);
            return {
                success: false,
                message: (error as Error).message
            };
        }
    }

    /**
     * Create missing filename entries
     */
    async createMissingFilenames(): Promise<UpdateResult> {
        logger.info('Creating missing filename entries...');
        
        try {
            const result = await query(`
                INSERT INTO libfilename (BookId, File, FileType)
                SELECT 
                    lb.BookId,
                    lb.BookId || '.fb2' as File,
                    'fb2' as FileType
                FROM libbook lb
                WHERE NOT EXISTS (
                    SELECT 1 FROM libfilename lf 
                    WHERE lf.BookId = lb.BookId
                )
                AND lb.deleted = '0'
            `);

            return {
                success: true,
                message: 'Missing filename entries created successfully',
                recordsProcessed: result.rowCount || 0
            };
        } catch (error) {
            logger.error('Creating missing filename entries failed:', error);
            return {
                success: false,
                message: (error as Error).message
            };
        }
    }

    /**
     * Update search vectors for full-text search
     */
    async updateSearchVectors(): Promise<UpdateResult> {
        logger.info('Updating search vectors...');
        
        try {
            await query(`
                UPDATE libbook 
                SET search_vector = to_tsvector('russian', 
                    coalesce(Title, '') || ' ' || 
                    coalesce((SELECT string_agg(a.FirstName || ' ' || a.LastName, ' ') 
                              FROM libavtor la 
                              JOIN libavtorname a ON la.AvtorId = a.AvtorId 
                              WHERE la.BookId = libbook.BookId), '') || ' ' ||
                    coalesce((SELECT string_agg(s.SeqName, ' ') 
                              FROM libseq ls 
                              JOIN libseqname s ON ls.SeqId = s.SeqId 
                              WHERE ls.BookId = libbook.BookId), '')
                )
                WHERE search_vector IS NULL OR updated_at > search_vector_updated_at
            `);

            return {
                success: true,
                message: 'Search vectors updated successfully'
            };
        } catch (error) {
            logger.error('Search vectors update failed:', error);
            return {
                success: false,
                message: (error as Error).message
            };
        }
    }

    /**
     * Perform database health check
     */
    async healthCheck(): Promise<HealthCheckResult> {
        logger.info('Performing database health check...');
        
        const issues: string[] = [];
        let healthy = true;

        try {
            // Check database connection
            await query('SELECT 1');

            // Check if main tables exist and have data
            const bookCount = await getRow('SELECT COUNT(*) as count FROM libbook');
            if (!bookCount || parseInt(bookCount.count as string) === 0) {
                issues.push('No books found in database');
                healthy = false;
            }

            const authorCount = await getRow('SELECT COUNT(*) as count FROM libavtorname');
            if (!authorCount || parseInt(authorCount.count as string) === 0) {
                issues.push('No authors found in database');
                healthy = false;
            }

            // Check for orphaned records
            const orphanedBooks = await getRow(`
                SELECT COUNT(*) as count 
                FROM libbook lb 
                WHERE NOT EXISTS (
                    SELECT 1 FROM libfilename lf WHERE lf.BookId = lb.BookId
                )
            `);
            
            if (orphanedBooks && parseInt(orphanedBooks.count as string) > 0) {
                issues.push(`${orphanedBooks.count} books without filenames`);
            }

            return {
                healthy,
                issues,
                timestamp: new Date()
            };
        } catch (error) {
            logger.error('Health check failed:', error);
            return {
                healthy: false,
                issues: [`Database connection failed: ${(error as Error).message}`],
                timestamp: new Date()
            };
        }
    }

    /**
     * Get database statistics
     */
    async getDatabaseStats(): Promise<DatabaseStats> {
        try {
            const [/* books */, tables, dbSize] = await Promise.all([
                getRow('SELECT COUNT(*) as count FROM libbook WHERE deleted = \'0\''),
                getRow('SELECT count(*) as count FROM information_schema.tables WHERE table_schema = \'public\''),
                getRow('SELECT pg_size_pretty(pg_database_size(current_database())) as size')
            ]);

            return {
                total_size: (dbSize?.size as string) || '0 MB',
                table_count: parseInt((tables?.count as string) || '0'),
                index_count: 0, // Could be implemented
                connection_count: 0, // Could be implemented  
                cache_hit_ratio: 0, // Could be implemented
                transactions_per_second: 0 // Could be implemented
            };
        } catch (error) {
            logger.error('Failed to get database stats:', error);
            throw error;
        }
    }
}

export default DatabaseManager;