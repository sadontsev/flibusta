/**
 * Comprehensive API Documentation with TypeScript Interfaces
 * This file provides complete type definitions for all API endpoints,
 * request/response types, and validation schemas.
 */

// =======================
// Core Data Interfaces
// =======================

export interface Book {
  bookid: number;
  title: string;
  year?: number;
  lang: string;
  filetype: string;
  filesize?: number;
  deleted: string;
  annotation?: string;
  authors?: Author[];
  genres?: Genre[];
  series?: Series[];
  isFavorite?: boolean;
  readingProgress?: number;
  coverUrl?: string;
}

export interface Author {
  avtorid: number;
  lastname: string;
  firstname: string;
  middlename?: string;
  nickname?: string;
  pos?: number;
  bookCount?: number;
  isFavorite?: boolean;
  aliases?: string[];
}

export interface Genre {
  genreid: number;
  genrecode: string;
  genredesc: string;
  genremeta: string;
  bookCount?: number;
  parentId?: number;
  children?: Genre[];
}

export interface Series {
  seqid: number;
  seqname: string;
  bookCount?: number;
  books?: BookInSeries[];
}

export interface BookInSeries {
  bookid: number;
  title: string;
  seqnum?: number;
  authors?: Author[];
}

export interface User {
  user_uuid: string;
  username: string;
  email: string;
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

// =======================
// API Request Interfaces
// =======================

export interface BookSearchParams {
  query?: string;
  author?: string;
  title?: string;
  genre?: string;
  series?: string;
  lang?: string;
  filetype?: string;
  year_from?: number;
  year_to?: number;
  page?: number;
  limit?: number;
  sort?: 'title' | 'year' | 'author' | 'added';
  order?: 'asc' | 'desc';
}

export interface AuthorSearchParams {
  query?: string;
  lastname?: string;
  firstname?: string;
  nickname?: string;
  page?: number;
  limit?: number;
  sort?: 'lastname' | 'firstname' | 'bookcount';
  order?: 'asc' | 'desc';
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
  display_name?: string;
  role?: 'user' | 'admin';
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UpdateProfileRequest {
  display_name?: string;
  email?: string;
}

export interface FavoriteRequest {
  bookId?: number;
  authorId?: number;
  seriesId?: number;
}

export interface ProgressRequest {
  bookId: number;
  position: number;
}

// =======================
// API Response Interfaces
// =======================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: ValidationError[];
}

export interface ValidationError {
  type: string;
  value: any;
  msg: string;
  path: string;
  location: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BookSearchResponse extends PaginatedResponse<Book> {
  filters?: {
    availableLanguages: string[];
    availableFiletypes: string[];
    yearRange: { min: number; max: number };
  };
}

export interface AuthorSearchResponse extends PaginatedResponse<Author> {}

export interface GenreHierarchyResponse {
  success: boolean;
  data: Genre[];
}

export interface UserStatsResponse {
  success: boolean;
  data: {
    favorite_count: number;
    books_in_progress: number;
    avg_reading_progress: number;
    total_reading_time?: number;
  };
}

export interface LoginResponse {
  success: boolean;
  data: {
    user: RegisteredUser;
    session_id: string;
  };
}

// =======================
// Advanced Type Guards
// =======================

export function isBook(obj: any): obj is Book {
  return obj && 
    typeof obj.bookid === 'number' &&
    typeof obj.title === 'string' &&
    typeof obj.lang === 'string' &&
    typeof obj.filetype === 'string';
}

export function isAuthor(obj: any): obj is Author {
  return obj &&
    typeof obj.avtorid === 'number' &&
    typeof obj.lastname === 'string';
}

export function isRegisteredUser(user: SessionUser): user is RegisteredUser {
  return user.type === 'registered';
}

export function isAnonymousUser(user: SessionUser): user is AnonymousUser {
  return user.type === 'anonymous';
}

export function isValidBookSearchParams(params: any): params is BookSearchParams {
  if (!params || typeof params !== 'object') return false;
  
  // Optional string fields
  const stringFields = ['query', 'author', 'title', 'genre', 'series', 'lang', 'filetype', 'sort', 'order'];
  for (const field of stringFields) {
    if (params[field] !== undefined && typeof params[field] !== 'string') return false;
  }
  
  // Optional number fields
  const numberFields = ['year_from', 'year_to', 'page', 'limit'];
  for (const field of numberFields) {
    if (params[field] !== undefined && typeof params[field] !== 'number') return false;
  }
  
  // Validate enum values
  if (params.sort && !['title', 'year', 'author', 'added'].includes(params.sort)) return false;
  if (params.order && !['asc', 'desc'].includes(params.order)) return false;
  
  return true;
}

export function isValidAuthorSearchParams(params: any): params is AuthorSearchParams {
  if (!params || typeof params !== 'object') return false;
  
  const stringFields = ['query', 'lastname', 'firstname', 'nickname', 'sort', 'order'];
  for (const field of stringFields) {
    if (params[field] !== undefined && typeof params[field] !== 'string') return false;
  }
  
  const numberFields = ['page', 'limit'];
  for (const field of numberFields) {
    if (params[field] !== undefined && typeof params[field] !== 'number') return false;
  }
  
  if (params.sort && !['lastname', 'firstname', 'bookcount'].includes(params.sort)) return false;
  if (params.order && !['asc', 'desc'].includes(params.order)) return false;
  
  return true;
}

// =======================
// Validation Helpers
// =======================

export function validatePaginationParams(page?: any, limit?: any): { page: number; limit: number } {
  const validatedPage = Math.max(0, parseInt(String(page)) || 0);
  const validatedLimit = Math.min(100, Math.max(1, parseInt(String(limit)) || 20));
  return { page: validatedPage, limit: validatedLimit };
}

export function validateBookId(bookId: any): number {
  const id = parseInt(String(bookId));
  if (isNaN(id) || id <= 0) {
    throw new Error('Invalid book ID');
  }
  return id;
}

export function validateAuthorId(authorId: any): number {
  const id = parseInt(String(authorId));
  if (isNaN(id) || id <= 0) {
    throw new Error('Invalid author ID');
  }
  return id;
}

export function validateUserId(userId: any): string {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID');
  }
  return userId;
}

// =======================
// Response Builders
// =======================

export function buildSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data
  };
}

export function buildErrorResponse(error: string): ApiResponse {
  return {
    success: false,
    error
  };
}

export function buildValidationErrorResponse(errors: ValidationError[]): ApiResponse {
  return {
    success: false,
    errors
  };
}

export function buildPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

// =======================
// API Endpoint Documentation
// =======================

/**
 * API Endpoints Documentation
 * 
 * Books API:
 * - GET /api/books - Search books with pagination and filters
 * - GET /api/books/:id - Get specific book details
 * - GET /api/books/:id/download - Download book file
 * - GET /api/books/stats - Get book statistics
 * 
 * Authors API:
 * - GET /api/authors - Search authors with pagination
 * - GET /api/authors/:id - Get author details with books
 * - GET /api/authors/:id/books - Get books by author
 * - GET /api/authors/stats - Get author statistics
 * 
 * Genres API:
 * - GET /api/genres - Get genre hierarchy
 * - GET /api/genres/:id - Get genre details
 * - GET /api/genres/:id/books - Get books in genre
 * 
 * Series API:
 * - GET /api/series - Search series
 * - GET /api/series/:id - Get series details
 * - GET /api/series/:id/books - Get books in series
 * 
 * Favorites API:
 * - GET /api/favorites - Get user favorites
 * - POST /api/favorites/books/:bookId - Add book to favorites
 * - DELETE /api/favorites/books/:bookId - Remove book from favorites
 * - POST /api/favorites/authors/:authorId - Add author to favorites
 * - DELETE /api/favorites/authors/:authorId - Remove author from favorites
 * 
 * Auth API:
 * - POST /api/auth/login - User login
 * - POST /api/auth/logout - User logout
 * - POST /api/auth/register - Register new user (admin only)
 * - GET /api/auth/me - Get current user info
 * - POST /api/auth/change-password - Change user password
 * - PUT /api/auth/profile - Update user profile
 * 
 * Session API:
 * - GET /api/session/user - Get current session user
 * - POST /api/session/progress - Save reading progress
 * - GET /api/session/progress - Get reading progress
 * - GET /api/session/stats - Get user statistics
 * 
 * Files API:
 * - GET /api/files/book/:bookId/:type - Get book file
 * - GET /api/files/cover/:bookId - Get book cover
 * - GET /api/files/author/:authorId - Get author image
 * 
 * Admin API:
 * - GET /api/admin/users - List users (admin only)
 * - PUT /api/admin/users/:userId - Update user (admin only)
 * - DELETE /api/admin/users/:userId - Delete user (admin only)
 * - GET /api/admin/stats - Get system statistics
 * - POST /api/admin/maintenance - Trigger maintenance tasks
 */

export default {
  // Export all interfaces and utilities
  isBook,
  isAuthor,
  isRegisteredUser,
  isAnonymousUser,
  isValidBookSearchParams,
  isValidAuthorSearchParams,
  validatePaginationParams,
  validateBookId,
  validateAuthorId,
  validateUserId,
  buildSuccessResponse,
  buildErrorResponse,
  buildValidationErrorResponse,
  buildPaginatedResponse
};