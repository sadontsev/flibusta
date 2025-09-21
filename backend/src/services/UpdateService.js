const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const { pipeline } = require('stream/promises');
const { createWriteStream } = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class UpdateService {
    constructor() {
        this.baseUrl = 'http://flibusta.is';
        this.sqlUrl = `${this.baseUrl}/sql/`;
        this.dailyUrl = `${this.baseUrl}/daily/`;
        this.sqlDir = process.env.SQL_PATH || '/app/sql';
        this.booksDir = process.env.BOOKS_PATH || '/app/flibusta';
        this.cacheDir = process.env.CACHE_PATH || '/app/cache';
    }

    async downloadFile(url, destination) {
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

    async extractGzipFile(gzipPath) {
        const sqlPath = gzipPath.replace('.gz', '');
        try {
            await execAsync(`gunzip -f "${gzipPath}"`);
            return sqlPath;
        } catch (error) {
            throw new Error(`Failed to extract ${gzipPath}: ${error.message}`);
        }
    }

    async executeSqlFile(sqlPath) {
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
            throw new Error(`Failed to execute SQL file: ${error.message}`);
        }
    }

    async updateSqlFiles() {
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

        const results = [];
        
        for (const sqlFile of sqlFiles) {
            try {
                const url = `${this.sqlUrl}${sqlFile}`;
                const destination = path.join(this.sqlDir, sqlFile);
                
                console.log(`Downloading ${sqlFile}...`);
                await this.downloadFile(url, destination);
                
                console.log(`Extracting ${sqlFile}...`);
                const extractedPath = await this.extractGzipFile(destination);
                
                console.log(`Executing ${extractedPath}...`);
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
                    message: error.message
                });
            }
        }
        
        return results;
    }

    async updateDailyBooks() {
        try {
            // Get the list of daily files
            const dailyFiles = await this.getDailyFileList();
            const results = [];
            
            for (const file of dailyFiles) {
                try {
                    const url = `${this.dailyUrl}${file}`;
                    const destination = path.join(this.booksDir, file);
                    
                    console.log(`Downloading daily book file: ${file}...`);
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
                        message: error.message
                    });
                }
            }
            
            return results;
        } catch (error) {
            throw new Error(`Failed to update daily books: ${error.message}`);
        }
    }

    async getDailyFileList() {
        return new Promise((resolve, reject) => {
            http.get(this.dailyUrl, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    // Parse HTML to extract file links
                    const fileMatches = data.match(/<([^>]+\.zip)>/g);
                    if (fileMatches) {
                        const files = fileMatches.map(match => match.replace(/[<>]/g, ''));
                        resolve(files);
                    } else {
                        resolve([]);
                    }
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    async updateCovers() {
        const coverFiles = [
            'lib.a.attached.zip',
            'lib.b.attached.zip'
        ];

        const results = [];
        
        for (const coverFile of coverFiles) {
            try {
                const url = `${this.sqlUrl}${coverFile}`;
                const destination = path.join(this.sqlDir, coverFile);
                
                // Remove existing file if it exists
                try {
                    await fs.unlink(destination);
                } catch (err) {
                    // File doesn't exist, that's fine
                }
                
                console.log(`Downloading cover file: ${coverFile}...`);
                await this.downloadFile(url, destination);
                
                results.push({
                    file: coverFile,
                    status: 'success',
                    message: 'Downloaded successfully'
                });
                
            } catch (error) {
                results.push({
                    file: coverFile,
                    status: 'error',
                    message: error.message
                });
            }
        }
        
        return results;
    }

    async updateBookMappings() {
        try {
            // This would update the book_zip and libfilename tables
            // based on the newly downloaded files
            const sqlPath = path.join(this.sqlDir, 'populate_book_mappings.sql');
            
            if (await fs.access(sqlPath).then(() => true).catch(() => false)) {
                await this.executeSqlFile(sqlPath);
                return { success: true, message: 'Book mappings updated successfully' };
            } else {
                return { success: false, message: 'Book mappings file not found' };
            }
        } catch (error) {
            throw new Error(`Failed to update book mappings: ${error.message}`);
        }
    }

    async getUpdateStatus() {
        try {
            const [sqlFiles, dailyFiles, coverFiles] = await Promise.all([
                fs.readdir(this.sqlDir),
                fs.readdir(this.booksDir),
                fs.readdir(this.cacheDir)
            ]);

            return {
                sqlFiles: sqlFiles.length,
                dailyFiles: dailyFiles.filter(f => f.endsWith('.zip')).length,
                coverFiles: coverFiles.filter(f => f.includes('cover')).length,
                lastUpdate: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Failed to get update status: ${error.message}`);
        }
    }
}

module.exports = UpdateService;
