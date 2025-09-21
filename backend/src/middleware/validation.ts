/**
 * Advanced Validation Middleware with Type Guards
 * Provides comprehensive validation with TypeScript type safety
 */

import { Response, NextFunction } from 'express';
import { validationResult, ValidationError as ExpressValidationError } from 'express-validator';
import { ExtendedRequest } from '../types';
import {
  validatePaginationParams,
  validateBookId,
  validateAuthorId,
  validateUserId,
  buildErrorResponse,
  buildValidationErrorResponse,
  isValidBookSearchParams,
  isValidAuthorSearchParams,
  BookSearchParams,
  AuthorSearchParams,
  ValidationError
} from '../types/api';

// =======================
// Base Validation Middleware
// =======================

export const validate = (req: ExtendedRequest, res: Response, next: NextFunction): Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Convert express-validator errors to our ValidationError format
    const validationErrors: ValidationError[] = errors.array().map((error: ExpressValidationError) => ({
      type: 'field',
      msg: error.msg,
      path: 'path' in error ? error.path : 'unknown',
      value: 'value' in error ? error.value : undefined,
      location: 'location' in error ? error.location : 'body',
      message: error.msg
    }));
    return res.status(400).json(buildValidationErrorResponse(validationErrors));
  }
  next();
};

// =======================
// Type Guard Middleware
// =======================

export const validateBookSearchQuery = (
  req: ExtendedRequest,
  res: Response, 
  next: NextFunction
): Response | void => {
  try {
    const query = req.query;
    
    if (!isValidBookSearchParams(query)) {
      return res.status(400).json(buildErrorResponse('Invalid search parameters'));
    }
    
    // Normalize and validate pagination
    const { page, limit } = validatePaginationParams(query.page, query.limit);
    req.query.page = page.toString();
    req.query.limit = limit.toString();
    
    next();
  } catch (error) {
    return res.status(400).json(buildErrorResponse((error as Error).message));
  }
};

export const validateAuthorSearchQuery = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    const query = req.query;
    
    if (!isValidAuthorSearchParams(query)) {
      return res.status(400).json(buildErrorResponse('Invalid search parameters'));
    }
    
    // Normalize and validate pagination
    const { page, limit } = validatePaginationParams(query.page, query.limit);
    req.query.page = page.toString();
    req.query.limit = limit.toString();
    
    next();
  } catch (error) {
    return res.status(400).json(buildErrorResponse((error as Error).message));
  }
};

// =======================
// Parameter Validation Middleware
// =======================

export const validateBookIdParam = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    const bookId = validateBookId(req.params.bookId);
    req.params.bookId = bookId.toString();
    next();
  } catch (error) {
    return res.status(400).json(buildErrorResponse((error as Error).message));
  }
};

export const validateAuthorIdParam = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    const authorId = validateAuthorId(req.params.authorId);
    req.params.authorId = authorId.toString();
    next();
  } catch (error) {
    return res.status(400).json(buildErrorResponse((error as Error).message));
  }
};

export const validateUserIdParam = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    const userId = validateUserId(req.params.userId);
    req.params.userId = userId;
    next();
  } catch (error) {
    return res.status(400).json(buildErrorResponse((error as Error).message));
  }
};

// =======================
// Authentication Type Guards
// =======================

export const requireRegisteredUser = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  if (!req.user || req.user.type !== 'registered') {
    return res.status(401).json(buildErrorResponse('Authentication required'));
  }
  next();
};

export const requireAdminUser = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  if (!req.user || req.user.type !== 'registered') {
    return res.status(401).json(buildErrorResponse('Authentication required'));
  }
  
  if (!['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json(buildErrorResponse('Admin access required'));
  }
  
  next();
};

export const requireSuperAdminUser = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  if (!req.user || req.user.type !== 'registered') {
    return res.status(401).json(buildErrorResponse('Authentication required'));
  }
  
  if (req.user.role !== 'superadmin') {
    return res.status(403).json(buildErrorResponse('Super admin access required'));
  }
  
  next();
};

// =======================
// Body Validation Middleware
// =======================

export const validateLoginBody = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  const { username, password } = req.body;
  
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json(buildErrorResponse('Username is required'));
  }
  
  if (!password || typeof password !== 'string' || password.length === 0) {
    return res.status(400).json(buildErrorResponse('Password is required'));
  }
  
  // Normalize username
  req.body.username = username.trim();
  
  next();
};

export const validateRegisterBody = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  const { username, password, email, display_name, role } = req.body;
  
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json(buildErrorResponse('Username must be at least 3 characters'));
  }
  
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json(buildErrorResponse('Password must be at least 6 characters'));
  }
  
  if (email && (typeof email !== 'string' || !isValidEmail(email))) {
    return res.status(400).json(buildErrorResponse('Invalid email format'));
  }
  
  if (display_name && typeof display_name !== 'string') {
    return res.status(400).json(buildErrorResponse('Display name must be a string'));
  }
  
  if (role && !['user', 'admin'].includes(role)) {
    return res.status(400).json(buildErrorResponse('Invalid role'));
  }
  
  // Normalize fields
  req.body.username = username.trim();
  req.body.email = email?.trim() || null;
  req.body.display_name = display_name?.trim() || username.trim();
  req.body.role = role || 'user';
  
  next();
};

export const validateChangePasswordBody = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  const { current_password, new_password } = req.body;
  
  if (!current_password || typeof current_password !== 'string') {
    return res.status(400).json(buildErrorResponse('Current password is required'));
  }
  
  if (!new_password || typeof new_password !== 'string' || new_password.length < 6) {
    return res.status(400).json(buildErrorResponse('New password must be at least 6 characters'));
  }
  
  next();
};

export const validateUpdateProfileBody = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  const { display_name, email } = req.body;
  
  if (display_name && (typeof display_name !== 'string' || display_name.trim().length === 0)) {
    return res.status(400).json(buildErrorResponse('Display name must be a non-empty string'));
  }
  
  if (email && (typeof email !== 'string' || !isValidEmail(email))) {
    return res.status(400).json(buildErrorResponse('Invalid email format'));
  }
  
  // Normalize fields
  if (display_name) req.body.display_name = display_name.trim();
  if (email) req.body.email = email.trim();
  
  next();
};

export const validateProgressBody = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  const { bookId, position } = req.body;
  
  try {
    const validatedBookId = validateBookId(bookId);
    const validatedPosition = parseFloat(String(position));
    
    if (isNaN(validatedPosition) || validatedPosition < 0 || validatedPosition > 1) {
      return res.status(400).json(buildErrorResponse('Position must be between 0 and 1'));
    }
    
    req.body.bookId = validatedBookId;
    req.body.position = validatedPosition;
    
    next();
  } catch (error) {
    return res.status(400).json(buildErrorResponse((error as Error).message));
  }
};

// =======================
// Utility Functions
// =======================

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// =======================
// Advanced Type-Safe Route Handler
// =======================

type AsyncRouteHandler = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) => Promise<Response | void>;

export function createTypeSafeHandler(
  handler: AsyncRouteHandler
): AsyncRouteHandler {
  return async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      return await handler(req, res, next);
    } catch (error) {
      console.error('Route handler error:', error);
      return res.status(500).json(buildErrorResponse('Internal server error'));
    }
  };
}

// =======================
// Pagination Helper
// =======================

export function extractPaginationParams(req: ExtendedRequest): { page: number; limit: number; offset: number } {
  const { page, limit } = validatePaginationParams(req.query.page, req.query.limit);
  const offset = page * limit;
  return { page, limit, offset };
}

// =======================
// Search Parameters Helper
// =======================

export function extractBookSearchParams(req: ExtendedRequest): BookSearchParams {
  const query = req.query;
  const params: BookSearchParams = {
    page: parseInt(query.page as string) || 0,
    limit: parseInt(query.limit as string) || 20,
    sort: (query.sort as 'title' | 'year' | 'author' | 'added') || 'title',
    order: (query.order as 'asc' | 'desc') || 'asc'
  };
  
  // Add optional properties only if they exist
  if (query.query && typeof query.query === 'string') params.query = query.query;
  if (query.author && typeof query.author === 'string') params.author = query.author;
  if (query.title && typeof query.title === 'string') params.title = query.title;
  if (query.genre && typeof query.genre === 'string') params.genre = query.genre;
  if (query.series && typeof query.series === 'string') params.series = query.series;
  if (query.lang && typeof query.lang === 'string') params.lang = query.lang;
  if (query.filetype && typeof query.filetype === 'string') params.filetype = query.filetype;
  if (query.year_from) params.year_from = parseInt(query.year_from as string);
  if (query.year_to) params.year_to = parseInt(query.year_to as string);
  
  return params;
}

export function extractAuthorSearchParams(req: ExtendedRequest): AuthorSearchParams {
  const query = req.query;
  const params: AuthorSearchParams = {
    page: parseInt(query.page as string) || 0,
    limit: parseInt(query.limit as string) || 20,
    sort: (query.sort as 'lastname' | 'firstname' | 'bookcount') || 'lastname',
    order: (query.order as 'asc' | 'desc') || 'asc'
  };
  
  // Add optional properties only if they exist
  if (query.query && typeof query.query === 'string') params.query = query.query;
  if (query.lastname && typeof query.lastname === 'string') params.lastname = query.lastname;
  if (query.firstname && typeof query.firstname === 'string') params.firstname = query.firstname;
  if (query.nickname && typeof query.nickname === 'string') params.nickname = query.nickname;
  
  return params;
}

export default {
  validate,
  validateBookSearchQuery,
  validateAuthorSearchQuery,
  validateBookIdParam,
  validateAuthorIdParam,
  validateUserIdParam,
  requireRegisteredUser,
  requireAdminUser,
  requireSuperAdminUser,
  validateLoginBody,
  validateRegisterBody,
  validateChangePasswordBody,
  validateUpdateProfileBody,
  validateProgressBody,
  createTypeSafeHandler,
  extractPaginationParams,
  extractBookSearchParams,
  extractAuthorSearchParams
};