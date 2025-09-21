# Node.js Management System Implementation

## Overview

This document describes the implementation of the Node.js management system that replaces and enhances the original PHP shell scripts with modern JavaScript functionality.

## Architecture

### Core Components

1. **DatabaseManager.js** - Main management class handling:
   - SQL file downloads
   - Cover file downloads  
   - Daily book updates
   - ZIP file mapping updates
   - Search vector updates
   - Database health checks

2. **MaintenanceScheduler.js** - Automated task scheduler using `node-cron`:
   - Daily updates (3 AM)
   - Weekly search vector updates (Sunday 4 AM)
   - Health checks (every 6 hours)
   - Weekly refresh (Saturday 2 AM)

3. **manage.js** - CLI interface using `yargs`:
   - Command-line tool for manual operations
   - Comprehensive help system
   - Colored output for better UX

4. **Admin API Routes** - REST API endpoints:
   - `/api/admin/stats` - Database statistics
   - `/api/admin/health` - Health checks
   - `/api/admin/download-sql` - Download SQL files
   - `/api/admin/scheduler/*` - Scheduler management

5. **Shell Wrapper** - `manage_nodejs.sh`:
   - Bridge between shell and Node.js
   - Docker integration
   - API command alternatives

## Features Implemented

### ✅ **Ported from PHP Shell Scripts**

| Original Script | Node.js Implementation | Status |
|----------------|----------------------|--------|
| `getsql.sh` | `DatabaseManager.downloadSqlFiles()` | ✅ Complete |
| `getcovers.sh` | `DatabaseManager.downloadCoverFiles()` | ✅ Complete |
| `update_daily.sh` | `DatabaseManager.updateDailyBooks()` | ✅ Complete |
| `fix_missing_books.sh` | `DatabaseManager.createMissingFilenames()` | ✅ Complete |
| `app_update_zip_list.php` | `DatabaseManager.updateZipMappings()` | ✅ Complete |
| `update_vectors.sql` | `DatabaseManager.updateSearchVectors()` | ✅ Complete |
| `setup_complete.sh` | CLI `full-setup` command | ✅ Complete |

### ✅ **Enhanced Features**

1. **Automated Scheduling**:
   ```javascript
   // Daily at 3 AM: Update daily books and ZIP mappings
   scheduleTask('daily-update', '0 3 * * *', async () => { ... });
   
   // Weekly on Sunday at 4 AM: Update search vectors
   scheduleTask('weekly-search-update', '0 4 * * 0', async () => { ... });
   ```

2. **Database Health Monitoring**:
   ```javascript
   const health = await dbManager.healthCheck();
   // Checks: missing ZIP mappings, orphaned records, etc.
   ```

3. **Comprehensive Statistics**:
   ```javascript
   const stats = await dbManager.getDatabaseStats();
   // Returns: books, authors, genres, ZIP mappings, etc.
   ```

4. **API Integration**:
   ```bash
   curl -X POST -H "Authorization: Bearer token" \
        http://localhost:27102/api/admin/full-setup
   ```

## Usage Examples

### CLI Operations

```bash
# Show database statistics
npm run manage stats

# Perform health check
npm run manage health

# Download SQL files
npm run manage download-sql

# Update daily books
npm run manage update-daily

# Complete setup
npm run manage full-setup
```

### Shell Wrapper

```bash
# Show statistics
./manage_nodejs.sh stats

# Start maintenance scheduler
./manage_nodejs.sh scheduler-start

# Check Docker status
./manage_nodejs.sh docker-status

# API operations
./manage_nodejs.sh api-health
```

### API Operations

```bash
# Get statistics
curl -H "Authorization: Bearer dev-token" \
     http://localhost:27102/api/admin/stats

# Start scheduler
curl -X POST -H "Authorization: Bearer dev-token" \
     http://localhost:27102/api/admin/scheduler/start

# Run full setup
curl -X POST -H "Authorization: Bearer dev-token" \
     http://localhost:27102/api/admin/full-setup
```

## Advantages over PHP Scripts

### 1. **Unified Technology Stack**
- Everything in JavaScript/Node.js
- No need for PHP runtime in production
- Shared dependencies and utilities

### 2. **Better Error Handling**
```javascript
try {
  await dbManager.downloadSqlFiles();
  logger.info('✅ SQL files downloaded successfully');
} catch (error) {
  logger.error('❌ SQL download failed:', error);
  throw error;
}
```

### 3. **Real-time Monitoring**
```javascript
// Health checks every 6 hours with logging
scheduleTask('health-check', '0 */6 * * *', async () => {
  const health = await dbManager.healthCheck();
  if (!health.healthy) {
    logger.warn('Health issues found:', health.issues);
  }
});
```

### 4. **API-First Design**
- All operations available via REST API
- Easy integration with web interfaces
- Remote management capabilities

### 5. **Improved Logging**
```javascript
logger.info('Starting SQL download...');
logger.warn('Failed to download file: timeout');
logger.error('Critical error:', error);
```

## Migration Path

### From Shell Scripts to Node.js

1. **Immediate**: Use shell wrapper for compatibility
   ```bash
   ./manage_nodejs.sh update-daily  # Uses Node.js backend
   ```

2. **Gradual**: Replace cron jobs with Node.js scheduler
   ```javascript
   // Replace: 0 3 * * * /path/to/update_daily.sh
   scheduleTask('daily-update', '0 3 * * *', updateFunction);
   ```

3. **Full Migration**: Use API endpoints for automation
   ```bash
   # In CI/CD pipelines
   curl -X POST -H "Authorization: Bearer $TOKEN" \
        http://flibusta-api/admin/update-daily
   ```

## Environment Configuration

Required environment variables:

```bash
# Enable maintenance scheduler
ENABLE_MAINTENANCE_SCHEDULER=true

# File paths
SQL_PATH=/app/sql
BOOKS_PATH=/app/flibusta
CACHE_PATH=/app/cache

# Timezone for scheduler
TZ=UTC
```

## Security Considerations

1. **Authentication**: All admin endpoints require authentication
2. **Authorization**: Role-based access control
3. **Rate Limiting**: API endpoints are rate-limited
4. **Input Validation**: All inputs validated with express-validator

## Performance Optimizations

1. **Async Operations**: All I/O operations are asynchronous
2. **Database Connection Pooling**: Efficient database usage
3. **Graceful Shutdown**: Proper cleanup on termination
4. **Error Recovery**: Retry mechanisms for network operations

## Monitoring and Alerting

```javascript
// Automatic health monitoring
const health = await dbManager.healthCheck();
if (!health.healthy) {
  // Send alerts via webhook, email, etc.
  await sendAlert(health.issues);
}
```

## Future Enhancements

1. **Job Queue Integration**: Use Redis/Bull for long-running tasks
2. **Metrics Collection**: Prometheus/Grafana integration
3. **Backup Automation**: Automated database backups
4. **Performance Monitoring**: APM integration
5. **Webhook Notifications**: Real-time status updates

## Dependencies

- **node-cron**: Task scheduling
- **yargs**: CLI argument parsing
- **express-validator**: Input validation
- **winston**: Logging
- **pg**: PostgreSQL client

## Conclusion

The Node.js management system provides a modern, maintainable, and feature-rich replacement for the original PHP shell scripts while maintaining compatibility and adding significant enhancements for monitoring, automation, and API integration.