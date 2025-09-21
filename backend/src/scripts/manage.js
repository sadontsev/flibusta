#!/usr/bin/env node

const path = require('path');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DatabaseManager = require('./DatabaseManager');
const logger = require('../utils/logger');

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
      console.error('❌ SQL download failed:', error.message);
      process.exit(1);
    }
  })
  .command('download-covers', 'Download cover and author image files', {}, async () => {
    try {
      await dbManager.downloadCoverFiles();
      console.log('✅ Cover files downloaded successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Cover download failed:', error.message);
      process.exit(1);
    }
  })
  .command('update-daily', 'Download daily book updates', {}, async () => {
    try {
      await dbManager.updateDailyBooks();
      console.log('✅ Daily books updated successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Daily update failed:', error.message);
      process.exit(1);
    }
  })
  .command('update-zip-mappings', 'Scan and update ZIP file mappings', {}, async () => {
    try {
      const result = await dbManager.updateZipMappings();
      console.log(`✅ ZIP mappings updated successfully. Total: ${result.mappingsCount}`);
      process.exit(0);
    } catch (error) {
      console.error('❌ ZIP mappings update failed:', error.message);
      process.exit(1);
    }
  })
  .command('update-search-vectors', 'Update full-text search vectors', {}, async () => {
    try {
      await dbManager.updateSearchVectors();
      console.log('✅ Search vectors updated successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Search vectors update failed:', error.message);
      process.exit(1);
    }
  })
  .command('create-missing-filenames', 'Create missing filename entries', {}, async () => {
    try {
      const result = await dbManager.createMissingFilenames();
      console.log(`✅ Created ${result.created} missing filename entries`);
      process.exit(0);
    } catch (error) {
      console.error('❌ Creating missing filenames failed:', error.message);
      process.exit(1);
    }
  })
  .command('stats', 'Show database statistics', {}, async () => {
    try {
      const stats = await dbManager.getDatabaseStats();
      
      console.log('\n📊 Database Statistics:');
      console.log('════════════════════════');
      console.log(`📚 Books: ${stats.books.active_books.toLocaleString()} active / ${stats.books.total_books.toLocaleString()} total`);
      console.log(`📖 File Formats: ${stats.books.file_formats}`);
      console.log(`👥 Authors: ${stats.authors.total_authors.toLocaleString()}`);
      console.log(`🏷️  Genres: ${stats.genres.total_genres.toLocaleString()}`);
      console.log(`📑 Series: ${stats.series.total_series.toLocaleString()}`);
      console.log(`🗜️  ZIP Mappings: ${stats.zipMappings.zip_mappings.toLocaleString()}`);
      console.log(`📝 Filename Mappings: ${stats.filenameMappings.filename_mappings.toLocaleString()}`);
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to get stats:', error.message);
      process.exit(1);
    }
  })
  .command('health', 'Perform database health check', {}, async () => {
    try {
      const health = await dbManager.healthCheck();
      
      if (health.healthy) {
        console.log('✅ Database is healthy');
      } else {
        console.log('⚠️  Database issues found:');
        health.issues.forEach(issue => {
          console.log(`   • ${issue}`);
        });
      }
      
      process.exit(health.healthy ? 0 : 1);
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      process.exit(1);
    }
  })
  .command('full-setup', 'Perform complete setup (download + import + update)', {}, async () => {
    try {
      console.log('🚀 Starting full setup...\n');
      
      // Step 1: Download SQL files
      console.log('1/6 📥 Downloading SQL files...');
      await dbManager.downloadSqlFiles();
      console.log('✅ SQL files downloaded\n');
      
      // Step 2: Download covers
      console.log('2/6 🖼️  Downloading cover files...');
      await dbManager.downloadCoverFiles();
      console.log('✅ Cover files downloaded\n');
      
      // Step 3: Update daily books
      console.log('3/6 📚 Updating daily books...');
      await dbManager.updateDailyBooks();
      console.log('✅ Daily books updated\n');
      
      // Step 4: Update ZIP mappings
      console.log('4/6 🗜️  Updating ZIP mappings...');
      const zipResult = await dbManager.updateZipMappings();
      console.log(`✅ ZIP mappings updated (${zipResult.mappingsCount} total)\n`);
      
      // Step 5: Create missing filenames
      console.log('5/6 📝 Creating missing filenames...');
      const filenameResult = await dbManager.createMissingFilenames();
      console.log(`✅ Created ${filenameResult.created} missing filenames\n`);
      
      // Step 6: Update search vectors
      console.log('6/6 🔍 Updating search vectors...');
      await dbManager.updateSearchVectors();
      console.log('✅ Search vectors updated\n');
      
      console.log('🎉 Full setup completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('❌ Full setup failed:', error.message);
      process.exit(1);
    }
  })
  .demandCommand(1, 'You need to specify a command')
  .help('h')
  .alias('h', 'help')
  .example('$0 stats', 'Show database statistics')
  .example('$0 health', 'Check database health')
  .example('$0 update-daily', 'Download daily book updates')
  .example('$0 full-setup', 'Perform complete setup')
  .argv;

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});