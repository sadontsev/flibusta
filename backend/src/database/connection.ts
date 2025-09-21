import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import logger from '../utils/logger';
import { DatabaseConfig } from '../types';

const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'flibusta',
  user: process.env.DB_USER || 'flibusta',
  password: process.env.DB_PASSWORD || 'flibusta',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

const pool = new Pool({
  ...dbConfig,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Test the connection
pool.on('connect', (): void => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err: Error): void => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function to execute queries
const query = async <T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> => {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Database query error', { text, params, error: errorMessage });
    throw error;
  }
};

// Helper function to get a single row
const getRow = async <T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T | null> => {
  const result = await query<T>(text, params);
  return result.rows[0] || null;
};

// Helper function to get multiple rows
const getRows = async <T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T[]> => {
  const result = await query<T>(text, params);
  return result.rows;
};

// Helper function to execute a transaction
const transaction = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export {
  pool,
  query,
  getRow,
  getRows,
  transaction
};
