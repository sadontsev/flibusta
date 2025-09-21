import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface ErrorWithCode extends Error {
  code?: string | number;
  statusCode?: number;
}

const errorHandler = (err: ErrorWithCode, req: Request, res: Response, next: NextFunction): void => {
  let error: { message: string; statusCode: number } = { 
    message: err.message || 'Server Error',
    statusCode: err.statusCode || 500
  };

  // Log error
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors).map((val: any) => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // PostgreSQL errors
  if (err.code === '23505') { // unique_violation
    const message = 'Duplicate entry';
    error = { message, statusCode: 400 };
  }

  if (err.code === '23503') { // foreign_key_violation
    const message = 'Referenced record not found';
    error = { message, statusCode: 400 };
  }

  if (err.code === '42P01') { // undefined_table
    const message = 'Table not found';
    error = { message, statusCode: 500 };
  }

  // File system errors
  if (err.code === 'ENOENT') {
    const message = 'File not found';
    error = { message, statusCode: 404 };
  }

  if (err.code === 'EACCES') {
    const message = 'Permission denied';
    error = { message, statusCode: 403 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export default errorHandler;
