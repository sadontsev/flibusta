import { Request } from 'express';
import { Session } from 'express-session';

// User Types
export interface User {
  user_uuid: string;
  username: string;
  email: string;
  password_hash?: string;
  role: 'user' | 'admin' | 'superadmin';
  is_active: boolean;
  display_name?: string;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface AnonymousUser {
  user_uuid: string;
  name: string;
  type: 'anonymous';
}

export interface RegisteredUser extends Omit<User, 'password_hash'> {
  type: 'registered';
}

export type SessionUser = AnonymousUser | RegisteredUser;

// Book Types
export interface Book {
  bookid: string | number;
  title: string;
  year?: number;
  lang: string;
  filetype: string;
  filesize?: string | number;
  deleted: string;
  authors?: string[];
  genres?: string[];
}

// Favorite entry for a book
export interface BookFavorite {
  bookid: string | number;
  fav_id: number;
  title: string;
  year?: number;
  lang: string;
  filetype: string;
  filesize?: string | number;
  authors: string[];
  genres: string[];
}

export interface ReadingProgress {
  bookid: string | number;
  pos: number;
  title: string;
  year?: number;
  lang: string;
  filetype: string;
  authors: string[];
}

// Session Types
export interface SessionData {
  user_uuid?: string;
  anonymous_uuid?: string;
  anonymous_name?: string;
  initialized?: boolean;
  // merged fields below (was duplicated further down)
  last_activity?: Date;
  created_at?: Date;
}

export interface ExtendedRequest extends Request {
  user?: SessionUser;
  session: Session & SessionData;
}

export interface AuthenticatedRequest extends Request {
  user: RegisteredUser;
  session: Session & SessionData;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationParams;
}

export interface FavoritesResponse {
  favorites: BookFavorite[];
  pagination: PaginationParams;
}

export interface ProgressResponse {
  progress: ReadingProgress[];
  pagination: PaginationParams;
}

// Database Types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | object;
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  command: string;
}

// Update Service Types
export interface UpdateSchedule {
  id: number;
  update_type: string;
  enabled: boolean;
  cron_expression: string;
  last_run?: Date;
  next_run?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateHistory {
  id: number;
  update_type: string;
  status: 'success' | 'error' | 'running';
  started_at: Date;
  completed_at?: Date;
  duration_seconds?: number;
  files_processed: number;
  files_successful: number;
  files_failed: number;
  error_message?: string;
  details?: object;
  created_at: Date;
}

// Author Types
export interface Author {
  avtorid: number;
  firstname?: string;
  middlename?: string;
  lastname: string;
}

// Genre Types
export interface Genre {
  genreid: number;
  genredesc: string;
}

// Series Types
export interface Series {
  seqid: number;
  seqname: string;
}

// Error Types
export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

// Update Service Types
export interface UpdateResult {
  status: 'success' | 'error';
  message: string;
  file?: string;
  error?: string;
  processed?: number;
  successful?: number;
  failed?: number;
}

export interface UpdateScheduleRecord {
  id: number;
  update_type: 'daily_books' | 'sql_files' | 'covers' | 'mappings' | 'full';
  cron_expression: string;
  enabled: boolean;
  last_run?: Date;
  next_run?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateHistoryRecord {
  id: number;
  update_type: string;
  status: 'running' | 'success' | 'error';
  started_at: Date;
  completed_at?: Date;
  duration_seconds?: number;
  files_processed?: number;
  files_successful?: number;
  files_failed?: number;
  error_message?: string;
  details?: Record<string, unknown>;
  created_at?: Date;
}

export interface UpdateStatsRecord {
  update_type: string;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  last_run?: Date;
  avg_duration?: number;
  total_files_successful?: number;
  total_files_failed?: number;
}

// Admin Types
export interface AdminUser extends User {
  role: 'admin' | 'superadmin';
}

export interface UserManagementResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SystemStatus {
  database: {
    connected: boolean;
    version?: string;
    stats?: Record<string, unknown>;
  };
  cache: {
    size: number;
    hits: number;
    misses: number;
  };
  updates: {
    last_update?: Date;
    status: string;
    pending_updates: number;
  };
  system: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu_usage?: number;
  };
}

// Database Management Types
export interface DatabaseInfo {
  name: string;
  size: string;
  tables: number;
  version: string;
  connections: number;
}

export interface TableInfo {
  table_name: string;
  row_count: number;
  size: string;
  last_vacuum?: Date;
  last_analyze?: Date;
}

export interface DatabaseStats {
  total_size: string;
  table_count: number;
  index_count: number;
  connection_count: number;
  cache_hit_ratio: number;
  transactions_per_second: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  issues: string[];
  timestamp: Date;
}

// Maintenance Types
export interface MaintenanceTask {
  id: string;
  name: string;
  description: string;
  schedule: string;
  last_run?: Date;
  next_run?: Date;
  status: 'idle' | 'running' | 'error';
  enabled: boolean;
}

export interface MaintenanceLog {
  id: number;
  task_id: string;
  started_at: Date;
  completed_at?: Date;
  status: 'running' | 'success' | 'error';
  duration?: number;
  log_details?: string;
  error_message?: string;
}

// (SessionData fields merged above to avoid re-declaration)

export interface SessionStats {
  total_sessions: number;
  active_sessions: number;
  registered_sessions: number;
  anonymous_sessions: number;
  avg_session_duration: number;
}

// File Management Types
export interface FileInfo {
  path: string;
  size: number;
  modified: Date;
  type: 'file' | 'directory';
  permissions?: string;
}

export interface FileOperation {
  operation: 'create' | 'update' | 'delete' | 'move';
  source: string;
  destination?: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

// Environment Types
export interface ProcessEnv {
  NODE_ENV?: string;
  PORT?: string;
  HOST?: string;
  DB_HOST?: string;
  DB_PORT?: string;
  DB_NAME?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_SSL?: string;
  SESSION_SECRET?: string;
  JWT_SECRET?: string;
  JWT_EXPIRES_IN?: string;
  SESSION_MAX_AGE?: string;
  SUPERADMIN_USERNAME?: string;
  SUPERADMIN_PASSWORD?: string;
  SUPERADMIN_EMAIL?: string;
  ENABLE_MAINTENANCE_SCHEDULER?: string;
  ENABLE_AUTOMATED_UPDATES?: string;
  LOG_LEVEL?: string;
  BCRYPT_ROUNDS?: string;
}