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
export interface ApiResponse<T = any> {
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

export interface QueryResult<T = any> {
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