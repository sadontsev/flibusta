import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import http from 'http';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger';

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
}

class UpdateService {
    private baseUrl: string;
    private sqlUrl: string;
    private dailyUrl: string;
    private sqlDir: string;
    private booksDir: string;
    private cacheDir: string;
    private isRunning: boolean = false;
    private currentOperation: string = '';

    constructor() {
        this.baseUrl = 'http://flibusta.is';
        this.sqlUrl = `${this.baseUrl}/sql/`;
        this.dailyUrl = `${this.baseUrl}/daily/`;
        this.sqlDir = process.env.SQL_PATH || '/app/sql';
        this.booksDir = process.env.BOOKS_PATH || '/app/flibusta';
        this.cacheDir = process.env.CACHE_PATH || '/app/cache';
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
        
        for (const sqlFile of sqlFiles) {
            try {
                const url = `${this.sqlUrl}${sqlFile}`;
                const destination = path.join(this.sqlDir, sqlFile);
                
                logger.info(`Downloading ${sqlFile}...`);
                await this.downloadFile(url, destination);
                
                logger.info(`Extracting ${sqlFile}...`);
                const extractedPath = await this.extractGzipFile(destination);
                
                logger.info(`Executing ${extractedPath}...`);
                const result = await this.executeSqlFile(extractedPath);
                
                results.push({
                    file: sqlFile,
                    status: 'success',
                    message: result.message
                });
                
            } catch (error) {
                results.push({
                    file: sqlFile,
                    status: 'error',
                    message: (error as Error).message
                });
            }
        }
        
        this.isRunning = false;
        this.currentOperation = '';
        return results;
    }

    async updateDailyBooks(): Promise<UpdateResult[]> {
        try {
            this.isRunning = true;
            this.currentOperation = 'Updating daily books';
            
            // Get the list of daily files
            const dailyFiles = await this.getDailyFileList();
            const results: UpdateResult[] = [];
            
            for (const file of dailyFiles) {
                try {
                    const url = `${this.dailyUrl}${file}`;
                    const destination = path.join(this.booksDir, file);
                    
                    logger.info(`Downloading daily book file: ${file}...`);
                    await this.downloadFile(url, destination);
                    
                    results.push({
                        file: file,
                        status: 'success',
                        message: 'Downloaded successfully'
                    });
                    
                } catch (error) {
                    results.push({
                        file: file,
                        status: 'error',
                        message: (error as Error).message
                    });
                }
            }
            
            this.isRunning = false;
            this.currentOperation = '';
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
            
            // Execute covers update script
            try {
                await execAsync('/app/getcovers.sh');
                results.push({
                    file: 'covers',
                    status: 'success',
                    message: 'Covers updated successfully'
                });
            } catch (error) {
                results.push({
                    file: 'covers',
                    status: 'error',
                    message: (error as Error).message
                });
            }
            
            this.isRunning = false;
            this.currentOperation = '';
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
            
            await execAsync('/app/populate_book_mappings.sql');
            
            this.isRunning = false;
            this.currentOperation = '';
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
        
        return status;
    }
}

export default UpdateService;