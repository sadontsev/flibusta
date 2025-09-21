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
  .demandCommand(1, 'You need to specify a command')
  .help()
  .alias('h', 'help')
  .version('1.0.0')
  .alias('v', 'version')
  .epilogue('For more information, see: https://github.com/your-repo/flibusta-backend');