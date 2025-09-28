import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import http from 'http';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import CoverCacheService from './CoverCacheService';

const execAsync = promisify(exec);

interface UpdateResult {
    file: string;
    status: 'success' | 'error';
    message: string;
}

interface SqlExecutionResult {
    success: boolean;
    message: string;
}

interface UpdateStatus {
    isRunning: boolean;
    lastUpdate?: Date;
    currentOperation?: string;
    progress?: OperationProgress;
}

type OperationType = 'sql' | 'daily' | 'covers' | 'mappings' | 'full';

interface OperationProgress {
    id: string;
    type: OperationType;
    startedAt: string; // ISO string for easy JSON
    updatedAt: string;
    completedAt?: string;
    currentIndex: number; // 0-based
    total: number;
    step: string; // human label
    successes: number;
    errors: number;
    message?: string; // last message
}

class UpdateService {
    private baseUrl: string;
    private sqlUrl: string;
    private dailyUrl: string;
    private sqlDir: string;
    private booksDir: string;
    private cacheDir: string;
    private mappingsSqlPath: string;
    private isRunning: boolean = false;
    private currentOperation: string = '';
    private progress?: OperationProgress;

    constructor() {
        this.baseUrl = 'http://flibusta.is';
        this.sqlUrl = `${this.baseUrl}/sql/`;
        this.dailyUrl = `${this.baseUrl}/daily/`;
        this.sqlDir = process.env.SQL_PATH || '/app/sql';
        this.booksDir = process.env.BOOKS_PATH || '/app/flibusta';
        this.cacheDir = process.env.CACHE_PATH || '/app/cache';
        // Allow overriding the mappings SQL path; default to container path
        this.mappingsSqlPath = process.env.MAPPINGS_SQL_PATH || '/app/populate_book_mappings.sql';
    }

    async downloadFile(url: string, destination: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https:') ? https : http;
            const file = createWriteStream(destination);
            
            protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    resolve(destination);
                });
                
                file.on('error', (err) => {
                    fs.unlink(destination).catch(() => {}); // Delete the file async
                    reject(err);
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    }

    async extractGzipFile(gzipPath: string): Promise<string> {
        const sqlPath = gzipPath.replace('.gz', '');
        try {
            await execAsync(`gunzip -f "${gzipPath}"`);
            return sqlPath;
        } catch (error) {
            throw new Error(`Failed to extract ${gzipPath}: ${(error as Error).message}`);
        }
    }

    async executeSqlFile(sqlPath: string): Promise<SqlExecutionResult> {
        try {
            const { stdout, stderr } = await execAsync(
                `psql -h ${process.env.DB_HOST} -p ${process.env.DB_PORT} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} -f "${sqlPath}"`,
                { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD } }
            );
            
            if (stderr && !stderr.includes('WARNING')) {
                throw new Error(`SQL execution error: ${stderr}`);
            }
            
            return { success: true, message: 'SQL file executed successfully' };
        } catch (error) {
            throw new Error(`Failed to execute SQL file: ${(error as Error).message}`);
        }
    }

    async updateSqlFiles(): Promise<UpdateResult[]> {
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
            'lib.b.annotations.sql.gz',
            'lib.a.annotations.sql.gz',
            'lib.b.annotations_pics.sql.gz',
            'lib.a.annotations_pics.sql.gz'
        ];

        const results: UpdateResult[] = [];
        this.isRunning = true;
        this.currentOperation = 'Updating SQL files';
        this.progress = {
            id: uuidv4(),
            type: 'sql',
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            currentIndex: 0,
            total: sqlFiles.length,
            step: 'Initializing',
            successes: 0,
            errors: 0,
            message: 'Preparing to process SQL files'
        };
        
        for (const sqlFile of sqlFiles) {
            try {
                this.progress!.step = 'Downloading';
                this.progress!.message = `Downloading ${sqlFile}`;
                this.progress!.updatedAt = new Date().toISOString();
                const url = `${this.sqlUrl}${sqlFile}`;
                const destination = path.join(this.sqlDir, sqlFile);
                
                logger.info(`Downloading ${sqlFile}...`);
                await this.downloadFile(url, destination);
                
                logger.info(`Extracting ${sqlFile}...`);
                this.progress!.step = 'Extracting';
                this.progress!.message = `Extracting ${sqlFile}`;
                this.progress!.updatedAt = new Date().toISOString();
                const extractedPath = await this.extractGzipFile(destination);
                
                logger.info(`Executing ${extractedPath}...`);
                this.progress!.step = 'Executing';
                this.progress!.message = `Executing ${path.basename(extractedPath)}`;
                this.progress!.updatedAt = new Date().toISOString();
                const result = await this.executeSqlFile(extractedPath);
                
                results.push({
                    file: sqlFile,
                    status: 'success',
                    message: result.message
                });
                this.progress!.successes += 1;
                
            } catch (error) {
                results.push({
                    file: sqlFile,
                    status: 'error',
                    message: (error as Error).message
                });
                this.progress!.errors += 1;
            }
            this.progress!.currentIndex += 1;
            this.progress!.updatedAt = new Date().toISOString();
        }
        
        this.isRunning = false;
        this.currentOperation = '';
        if (this.progress) {
            this.progress.completedAt = new Date().toISOString();
            this.progress.updatedAt = new Date().toISOString();
        }
        return results;
    }

    async updateDailyBooks(): Promise<UpdateResult[]> {
        try {
            this.isRunning = true;
            this.currentOperation = 'Updating daily books';
            
            // Get the list of daily files
            const dailyFiles = await this.getDailyFileList();
            const results: UpdateResult[] = [];
            this.progress = {
                id: uuidv4(),
                type: 'daily',
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                currentIndex: 0,
                total: dailyFiles.length,
                step: 'Initializing',
                successes: 0,
                errors: 0,
                message: 'Preparing to download daily archives'
            };
            
            for (const file of dailyFiles) {
                try {
                    this.progress!.step = 'Downloading';
                    this.progress!.message = `Downloading ${file}`;
                    this.progress!.updatedAt = new Date().toISOString();
                    const url = `${this.dailyUrl}${file}`;
                    const destination = path.join(this.booksDir, file);
                    
                    logger.info(`Downloading daily book file: ${file}...`);
                    await this.downloadFile(url, destination);
                    
                    results.push({
                        file: file,
                        status: 'success',
                        message: 'Downloaded successfully'
                    });
                    this.progress!.successes += 1;
                    
                } catch (error) {
                    results.push({
                        file: file,
                        status: 'error',
                        message: (error as Error).message
                    });
                    this.progress!.errors += 1;
                }
                this.progress!.currentIndex += 1;
                this.progress!.updatedAt = new Date().toISOString();
            }
            
            this.isRunning = false;
            this.currentOperation = '';
            if (this.progress) {
                this.progress.completedAt = new Date().toISOString();
                this.progress.updatedAt = new Date().toISOString();
            }
            return results;
        } catch (error) {
            this.isRunning = false;
            this.currentOperation = '';
            throw error;
        }
    }

    async updateCovers(): Promise<UpdateResult[]> {
        try {
            this.isRunning = true;
            this.currentOperation = 'Updating covers';

            const results: UpdateResult[] = [];
            this.progress = {
                id: uuidv4(),
                type: 'covers',
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                currentIndex: 0,
                total: 2,
                step: 'Initializing',
                successes: 0,
                errors: 0,
                message: 'Ensuring cover archives'
            };

            // Ensure cache directories exist
            const coversDir = path.join(this.cacheDir, 'covers');
            const authorsDir = path.join(this.cacheDir, 'authors');
            try {
                await fs.mkdir(this.cacheDir, { recursive: true });
                await fs.mkdir(coversDir, { recursive: true });
                await fs.mkdir(authorsDir, { recursive: true });
            } catch (e) {
                logger.warn('Failed ensuring cache directories (will continue):', (e as Error).message);
            }

            // Define cover archive files
            const archives = [
                { name: 'lib.a.attached.zip', url: `${this.sqlUrl}lib.a.attached.zip` },
                { name: 'lib.b.attached.zip', url: `${this.sqlUrl}lib.b.attached.zip` }
            ];

            for (const arch of archives) {
                const dest = path.join(this.cacheDir, arch.name);
                let action: 'skipped' | 'downloaded' | 'failed' = 'skipped';
                let message = 'Already present';
                try {
                    this.progress!.step = 'Checking';
                    this.progress!.message = `Checking ${arch.name}`;
                    this.progress!.updatedAt = new Date().toISOString();
                    // Check if file exists and is non-empty
                    let needDownload = false;
                    try {
                        const stat = await fs.stat(dest);
                        if (!stat || stat.size < 1024 * 1024) { // smaller than 1MB is suspicious
                            needDownload = true;
                        }
                    } catch {
                        needDownload = true;
                    }

                    if (needDownload) {
                        logger.info(`Downloading ${arch.name} to ${dest}...`);
                        this.progress!.step = 'Downloading';
                        this.progress!.message = `Downloading ${arch.name}`;
                        this.progress!.updatedAt = new Date().toISOString();
                        await this.downloadFile(arch.url, dest);
                        action = 'downloaded';
                        message = 'Downloaded successfully';
                    }

                    results.push({ file: arch.name, status: 'success', message });
                    this.progress!.successes += 1;
                } catch (err) {
                    action = 'failed';
                    message = (err as Error).message;
                    logger.error(`Failed to ensure ${arch.name}:`, err);
                    results.push({ file: arch.name, status: 'error', message });
                    this.progress!.errors += 1;
                }
                this.progress!.currentIndex += 1;
                this.progress!.updatedAt = new Date().toISOString();
            }

            // After ensuring archives, optionally run a precache pass for covers
            try {
                const limit = Number(process.env.COVERS_PRECACHE_LIMIT || 500);
                const mode = (process.env.COVERS_PRECACHE_MODE as 'recent'|'missing'|'all') || 'missing';
                logger.info(`Running cover precache after covers update: mode=${mode} limit=${limit}`);
                const summary = await CoverCacheService.precacheAll({ limit, mode });
                results.push({
                  file: `covers_precache_${mode}`,
                  status: 'success',
                  message: `Precached covers: processed=${summary.processed}, cached=${summary.cached}, errors=${summary.errors}`
                });
            } catch (e) {
                const msg = (e as Error).message;
                logger.warn('Cover precache after covers update failed', { error: msg });
                results.push({ file: 'covers_precache', status: 'error', message: msg });
            }

            this.isRunning = false;
            this.currentOperation = '';
            if (this.progress) {
                this.progress.completedAt = new Date().toISOString();
                this.progress.updatedAt = new Date().toISOString();
            }
            return results;
        } catch (error) {
            this.isRunning = false;
            this.currentOperation = '';
            throw error;
        }
    }

    async updateBookMappings(): Promise<UpdateResult> {
        try {
            this.isRunning = true;
            this.currentOperation = 'Updating book mappings';
            this.progress = {
                id: uuidv4(),
                type: 'mappings',
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                currentIndex: 0,
                total: 1,
                step: 'Executing',
                successes: 0,
                errors: 0,
                message: 'Running mappings SQL'
            };

            // Ensure the SQL file exists
            try {
                await fs.access(this.mappingsSqlPath);
            } catch {
                this.isRunning = false;
                this.currentOperation = '';
                return {
                    file: 'book_mappings',
                    status: 'error',
                    message: `Mappings SQL not found at ${this.mappingsSqlPath}. Set MAPPINGS_SQL_PATH or place the file at that location.`
                };
            }

            // Execute using psql (same path as other SQL files)
            await this.executeSqlFile(this.mappingsSqlPath);
            this.progress.successes = 1;
            this.progress.currentIndex = 1;

            this.isRunning = false;
            this.currentOperation = '';
            if (this.progress) {
                this.progress.completedAt = new Date().toISOString();
                this.progress.updatedAt = new Date().toISOString();
            }
            return {
                file: 'book_mappings',
                status: 'success',
                message: 'Book mappings updated successfully'
            };
        } catch (error) {
            this.isRunning = false;
            this.currentOperation = '';
            return {
                file: 'book_mappings',
                status: 'error',
                message: (error as Error).message
            };
        }
    }

    async getDailyFileList(): Promise<string[]> {
        // Mock implementation - in real scenario this would fetch from server
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const formatDate = (date: Date): string => {
            const isoString = date.toISOString();
            if (isoString) {
                return isoString.split('T')[0]?.replace(/-/g, '') || '';
            }
            return '';
        };
        
        return [
            `f.fb2.${formatDate(yesterday)}.zip`,
            `f.epub.${formatDate(yesterday)}.zip`,
            `f.djvu.${formatDate(yesterday)}.zip`
        ];
    }

    getUpdateStatus(): UpdateStatus {
        const status: UpdateStatus = {
            isRunning: this.isRunning
        };
        
        if (this.currentOperation) {
            status.currentOperation = this.currentOperation;
        }
        if (this.progress) {
            status.progress = this.progress;
        }
        
        return status;
    }
}

export default UpdateService;