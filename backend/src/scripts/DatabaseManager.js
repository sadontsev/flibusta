const fs = require('fs').promises;
const path = require('path');
const { execSync, spawn } = require('child_process');
const { getRows, getRow, query } = require('../database/connection');
const logger = require('../utils/logger');

class DatabaseManager {
  constructor() {
    this.sqlPath = process.env.SQL_PATH || '/app/sql';
    this.flibustaPath = process.env.BOOKS_PATH || '/app/flibusta';
    this.cachePath = process.env.CACHE_PATH || '/app/cache';
  }

  /**
   * Download SQL files from flibusta.is
   */
  async downloadSqlFiles() {
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

    try {
      // Ensure SQL directory exists
      await fs.mkdir(path.join(this.sqlPath), { recursive: true });

      // Download each file
      for (const file of sqlFiles) {
        const url = `http://flibusta.is/sql/${file}`;
        const outputPath = path.join(this.sqlPath, file);
        
        logger.info(`Downloading ${file}...`);
        
        try {
          execSync(`wget -c -nc -O "${outputPath}" "${url}"`, { 
            stdio: 'inherit',
            timeout: 300000 // 5 minutes timeout per file
          });
        } catch (error) {
          logger.warn(`Failed to download ${file}: ${error.message}`);
        }
      }

      logger.info('SQL files download completed');
      return { success: true };
    } catch (error) {
      logger.error('SQL download failed:', error);
      throw error;
    }
  }

  /**
   * Download cover and author image files
   */
  async downloadCoverFiles() {
    logger.info('Starting cover files download...');
    
    try {
      // Ensure cache directory exists
      await fs.mkdir(path.join(this.cachePath), { recursive: true });

      const coverFiles = [
        'lib.a.attached.zip', // Author images
        'lib.b.attached.zip'  // Book covers
      ];

      for (const file of coverFiles) {
        const url = `http://flibusta.is/sql/${file}`;
        const outputPath = path.join(this.cachePath, file);
        
        logger.info(`Downloading ${file}...`);
        
        // Remove existing file first
        try {
          await fs.unlink(outputPath);
        } catch (error) {
          // File doesn't exist, ignore
        }

        try {
          execSync(`wget -c -nc -O "${outputPath}" "${url}"`, { 
            stdio: 'inherit',
            timeout: 600000 // 10 minutes timeout per file
          });
        } catch (error) {
          logger.warn(`Failed to download ${file}: ${error.message}`);
        }
      }

      logger.info('Cover files download completed');
      return { success: true };
    } catch (error) {
      logger.error('Cover download failed:', error);
      throw error;
    }
  }

  /**
   * Update daily book files from flibusta.is
   */
  async updateDailyBooks() {
    logger.info('Starting daily books update...');
    
    try {
      // Ensure flibusta directory exists
      await fs.mkdir(path.join(this.flibustaPath), { recursive: true });

      // Download daily updates
      const command = `wget --directory-prefix="${this.flibustaPath}" -e robots=off -c -nc -np -nd -A.zip -r http://flibusta.is/daily/`;
      
      logger.info('Downloading daily book updates...');
      execSync(command, { 
        stdio: 'inherit',
        timeout: 1800000 // 30 minutes timeout
      });

      logger.info('Daily books update completed');
      return { success: true };
    } catch (error) {
      logger.error('Daily books update failed:', error);
      throw error;
    }
  }

  /**
   * Scan flibusta directory and update book_zip mappings
   */
  async updateZipMappings() {
    logger.info('Updating ZIP file mappings...');
    
    try {
      // Clear existing mappings
      await query('TRUNCATE book_zip');
      logger.info('Cleared existing ZIP mappings');

      // Scan flibusta directory
      const files = await fs.readdir(this.flibustaPath);
      const zipFiles = files.filter(file => file.endsWith('.zip') && file.includes('-'));

      logger.info(`Found ${zipFiles.length} ZIP files to process`);

      // Process each ZIP file
      for (const file of zipFiles) {
        try {
          // Parse filename to extract information
          const match = file.match(/^f\.(.*?)\.(\d+)-(\d+)\.zip$/);
          if (!match) {
            logger.warn(`Skipping file with invalid format: ${file}`);
            continue;
          }

          const format = match[1];
          const startId = parseInt(match[2]);
          const endId = parseInt(match[3]);
          
          // Determine usr value (0 for fb2, 1 for user format)
          const usr = format === 'fb2' ? 0 : 1;

          // Skip problematic files
          if (file.includes('d.fb2-009')) {
            logger.info(`Skipping problematic file: ${file}`);
            continue;
          }

          // Insert mapping
          await query(
            'INSERT INTO book_zip (filename, start_id, end_id, usr) VALUES ($1, $2, $3, $4)',
            [file, startId, endId, usr]
          );

          logger.info(`Added mapping: ${file} (${startId}-${endId}, usr=${usr})`);
        } catch (error) {
          logger.error(`Error processing ${file}:`, error);
        }
      }

      // Get final count
      const result = await getRow('SELECT COUNT(*) as count FROM book_zip');
      logger.info(`ZIP mappings update completed. Total mappings: ${result.count}`);
      
      return { success: true, mappingsCount: parseInt(result.count) };
    } catch (error) {
      logger.error('ZIP mappings update failed:', error);
      throw error;
    }
  }

  /**
   * Update full-text search vectors
   */
  async updateSearchVectors() {
    logger.info('Updating full-text search vectors...');
    
    try {
      // Update author name vectors
      await query(`
        INSERT INTO libavtorname_ts
        SELECT avtorid, to_tsvector('russian', concat(lastname, ' ', middlename, ' ', firstname, ' ', nickname)) as vector
        FROM libavtorname
        ON CONFLICT (avtorid) DO UPDATE SET
        vector = EXCLUDED.vector
      `);

      // Update book title vectors
      await query(`
        INSERT INTO libbook_ts
        SELECT bookid, to_tsvector('russian', title) as vector
        FROM libbook
        ON CONFLICT (bookid) DO UPDATE SET
        vector = EXCLUDED.vector
      `);

      // Update sequence name vectors
      await query(`
        INSERT INTO libseqname_ts
        SELECT seqid, to_tsvector('russian', seqname) as vector
        FROM libseqname
        ON CONFLICT (seqid) DO UPDATE SET
        vector = EXCLUDED.vector
      `);

      logger.info('Full-text search vectors updated successfully');
      return { success: true };
    } catch (error) {
      logger.error('Search vectors update failed:', error);
      throw error;
    }
  }

  /**
   * Create missing filename entries for books
   */
  async createMissingFilenames() {
    logger.info('Creating missing filename entries...');
    
    try {
      const result = await query(`
        INSERT INTO libfilename (bookid, filename)
        SELECT bookid, bookid || '.' || filetype as filename
        FROM libbook 
        WHERE deleted = '0' 
          AND bookid NOT IN (SELECT bookid FROM libfilename WHERE bookid IS NOT NULL)
        RETURNING bookid
      `);

      logger.info(`Created ${result.rowCount} missing filename entries`);
      return { success: true, created: result.rowCount };
    } catch (error) {
      logger.error('Creating missing filenames failed:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    try {
      const stats = {};

      // Book counts
      const bookStats = await getRow(`
        SELECT 
          COUNT(*) as total_books,
          COUNT(CASE WHEN deleted = '0' THEN 1 END) as active_books,
          COUNT(DISTINCT filetype) as file_formats
        FROM libbook
      `);

      // Author counts
      const authorStats = await getRow('SELECT COUNT(*) as total_authors FROM libavtorname');

      // Genre counts
      const genreStats = await getRow('SELECT COUNT(*) as total_genres FROM libgenrelist');

      // Series counts
      const seriesStats = await getRow('SELECT COUNT(*) as total_series FROM libseqname');

      // ZIP file mappings
      const zipStats = await getRow('SELECT COUNT(*) as zip_mappings FROM book_zip');

      // Filename mappings
      const filenameStats = await getRow('SELECT COUNT(*) as filename_mappings FROM libfilename');

      stats.books = bookStats;
      stats.authors = authorStats;
      stats.genres = genreStats;
      stats.series = seriesStats;
      stats.zipMappings = zipStats;
      stats.filenameMappings = filenameStats;

      return stats;
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      throw error;
    }
  }

  /**
   * Perform database health check
   */
  async healthCheck() {
    try {
      const issues = [];
      
      // Check for books without ZIP mappings
      const booksWithoutZip = await getRow(`
        SELECT COUNT(*) as count
        FROM libbook b
        WHERE b.deleted = '0' 
          AND NOT EXISTS (
            SELECT 1 FROM book_zip bz 
            WHERE b.bookid BETWEEN bz.start_id AND bz.end_id
              AND bz.filename LIKE 'f.' || b.filetype || '.%'
          )
      `);

      if (parseInt(booksWithoutZip.count) > 0) {
        issues.push(`${booksWithoutZip.count} books without ZIP file mappings`);
      }

      // Check for books without filenames
      const booksWithoutFilenames = await getRow(`
        SELECT COUNT(*) as count
        FROM libbook b
        WHERE b.deleted = '0' 
          AND b.bookid NOT IN (SELECT bookid FROM libfilename WHERE bookid IS NOT NULL)
      `);

      if (parseInt(booksWithoutFilenames.count) > 0) {
        issues.push(`${booksWithoutFilenames.count} books without filename mappings`);
      }

      // Check for orphaned authors
      const orphanedAuthors = await getRow(`
        SELECT COUNT(*) as count
        FROM libavtorname an
        WHERE NOT EXISTS (SELECT 1 FROM libavtor a WHERE a.avtorid = an.avtorid)
      `);

      if (parseInt(orphanedAuthors.count) > 0) {
        issues.push(`${orphanedAuthors.count} orphaned author records`);
      }

      return {
        healthy: issues.length === 0,
        issues: issues
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        healthy: false,
        issues: [`Health check failed: ${error.message}`]
      };
    }
  }
}

module.exports = DatabaseManager;