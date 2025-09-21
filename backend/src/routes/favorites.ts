/**
 * Favorites Routes - TypeScript Implementation
 * Handles user favorites for books, authors, and series
 */

import express, { Response } from 'express';
import { body, param } from 'express-validator';
import { query as dbQuery, getRow } from '../database/connection';
import { requireAuth } from '../middleware/auth';
import { 
  validate, 
  extractPaginationParams,
  createTypeSafeHandler
} from '../middleware/validation';
import { 
  buildPaginatedResponse, 
  buildErrorResponse, 
  buildSuccessResponse 
} from '../types/api';
import logger from '../utils/logger';
import { ExtendedRequest, RegisteredUser } from '../types';

const router = express.Router();

// =======================
// Books Favorites
// =======================

// Get user's favorite books
router.get('/books', requireAuth, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response> => {
  const user = req.user as RegisteredUser;
  const userId = user.user_uuid;
  const { page, limit, offset } = extractPaginationParams(req);

  const queryText = `
    SELECT 
      b.bookid, b.title, b.filename, b.filesize, b.libid, b.md5, b.registerdate,
      b.lang, b.fileext, b.year, b.pages, b.availableformats, b.updatesource,
      COUNT(*) OVER() as total_count
    FROM fav f
    JOIN books b ON f.bookid = b.bookid
    WHERE f.user_uuid = $1
    ORDER BY f.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await dbQuery(queryText, [userId, limit, offset]);
  const books = result.rows;
  const totalCount = books.length > 0 ? parseInt(books[0].total_count) : 0;

  return res.json(buildPaginatedResponse(books, page, limit, totalCount));
}));

// Add book to favorites
router.post('/books/:bookId', [
  param('bookId').isInt({ min: 1 }).withMessage('Book ID must be a positive integer')
], validate, requireAuth, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response> => {
  const user = req.user as RegisteredUser;
  const userUuid = user.user_uuid;
  const bookId = parseInt(req.params.bookId!);

  // Check if book exists
  const book = await getRow(`
    SELECT bookid, title FROM books WHERE bookid = $1 AND deleted = '0'
  `, [bookId]);

  if (!book) {
    return res.status(404).json(buildErrorResponse('Book not found'));
  }

  // Check if already in favorites
  const existing = await getRow(`
    SELECT fav_id FROM fav WHERE user_uuid = $1 AND bookid = $2
  `, [userUuid, bookId]);

  if (existing) {
    return res.status(409).json(buildErrorResponse('Book already in favorites'));
  }

  // Add to favorites
  await dbQuery(`
    INSERT INTO fav (user_uuid, bookid) VALUES ($1, $2)
  `, [userUuid, bookId]);

  logger.info('Book added to favorites', { userUuid, bookId, title: book.title });

  return res.json(buildSuccessResponse({ message: 'Book added to favorites', bookId }));
}));

// Remove book from favorites
router.delete('/books/:bookId', [
  param('bookId').isInt({ min: 1 }).withMessage('Book ID must be a positive integer')
], validate, requireAuth, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response> => {
  const user = req.user as RegisteredUser;
  const userUuid = user.user_uuid;
  const bookId = parseInt(req.params.bookId!);

  const result = await dbQuery(`
    DELETE FROM fav WHERE user_uuid = $1 AND bookid = $2
  `, [userUuid, bookId]);

  if (result.rowCount === 0) {
    return res.status(404).json(buildErrorResponse('Book not found in favorites'));
  }

  logger.info('Book removed from favorites', { userUuid, bookId });

  return res.json(buildSuccessResponse({ message: 'Book removed from favorites', bookId }));
}));

// =======================
// Authors Favorites
// =======================

// Get user's favorite authors
router.get('/authors', requireAuth, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response> => {
  const user = req.user as RegisteredUser;
  const userId = user.user_uuid;
  const { page, limit, offset } = extractPaginationParams(req);

  const queryText = `
    SELECT 
      a.avtorid, a.firstname, a.middlename, a.lastname, a.nickname,
      COUNT(*) OVER() as total_count
    FROM fav_authors fa
    JOIN authors a ON fa.author_id = a.avtorid
    WHERE fa.user_uuid = $1
    ORDER BY fa.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await dbQuery(queryText, [userId, limit, offset]);
  const authors = result.rows;
  const totalCount = authors.length > 0 ? parseInt(authors[0].total_count) : 0;

  return res.json(buildPaginatedResponse(authors, page, limit, totalCount));
}));

// Add author to favorites
router.post('/authors/:authorId', [
  param('authorId').isInt({ min: 1 }).withMessage('Author ID must be a positive integer')
], validate, requireAuth, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response> => {
  const user = req.user as RegisteredUser;
  const userUuid = user.user_uuid;
  const authorId = parseInt(req.params.authorId!);

  // Check if author exists
  const author = await getRow(`
    SELECT avtorid, firstname, lastname, nickname FROM authors WHERE avtorid = $1
  `, [authorId]);

  if (!author) {
    return res.status(404).json(buildErrorResponse('Author not found'));
  }

  // Check if already in favorites
  const existing = await getRow(`
    SELECT id FROM fav_authors WHERE user_uuid = $1 AND author_id = $2
  `, [userUuid, authorId]);

  if (existing) {
    return res.status(409).json(buildErrorResponse('Author already in favorites'));
  }

  // Add to favorites
  await dbQuery(`
    INSERT INTO fav_authors (user_uuid, author_id) VALUES ($1, $2)
  `, [userUuid, authorId]);

  const authorName = author.nickname || `${author.firstname} ${author.lastname}`.trim();
  logger.info('Author added to favorites', { userUuid, authorId, authorName });

  return res.json(buildSuccessResponse({ message: 'Author added to favorites', authorId }));
}));

// Remove author from favorites
router.delete('/authors/:authorId', [
  param('authorId').isInt({ min: 1 }).withMessage('Author ID must be a positive integer')
], validate, requireAuth, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response> => {
  const user = req.user as RegisteredUser;
  const userUuid = user.user_uuid;
  const authorId = parseInt(req.params.authorId!);

  const result = await dbQuery(`
    DELETE FROM fav_authors WHERE user_uuid = $1 AND author_id = $2
  `, [userUuid, authorId]);

  if (result.rowCount === 0) {
    return res.status(404).json(buildErrorResponse('Author not found in favorites'));
  }

  logger.info('Author removed from favorites', { userUuid, authorId });

  return res.json(buildSuccessResponse({ message: 'Author removed from favorites', authorId }));
}));

// =======================
// Series Favorites
// =======================

// Get user's favorite series
router.get('/series', requireAuth, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response> => {
  const user = req.user as RegisteredUser;
  const userId = user.user_uuid;
  const { page, limit, offset } = extractPaginationParams(req);

  const queryText = `
    SELECT 
      s.ser_id, s.ser_name,
      COUNT(*) OVER() as total_count
    FROM fav_series fs
    JOIN series s ON fs.series_id = s.ser_id
    WHERE fs.user_uuid = $1
    ORDER BY fs.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await dbQuery(queryText, [userId, limit, offset]);
  const series = result.rows;
  const totalCount = series.length > 0 ? parseInt(series[0].total_count) : 0;

  return res.json(buildPaginatedResponse(series, page, limit, totalCount));
}));

// Add series to favorites
router.post('/series/:seriesId', [
  param('seriesId').isInt({ min: 1 }).withMessage('Series ID must be a positive integer')
], validate, requireAuth, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response> => {
  const user = req.user as RegisteredUser;
  const userUuid = user.user_uuid;
  const seriesId = parseInt(req.params.seriesId!);

  // Check if series exists
  const series = await getRow(`
    SELECT ser_id, ser_name FROM series WHERE ser_id = $1
  `, [seriesId]);

  if (!series) {
    return res.status(404).json(buildErrorResponse('Series not found'));
  }

  // Check if already in favorites
  const existing = await getRow(`
    SELECT id FROM fav_series WHERE user_uuid = $1 AND series_id = $2
  `, [userUuid, seriesId]);

  if (existing) {
    return res.status(409).json(buildErrorResponse('Series already in favorites'));
  }

  // Add to favorites
  await dbQuery(`
    INSERT INTO fav_series (user_uuid, series_id) VALUES ($1, $2)
  `, [userUuid, seriesId]);

  logger.info('Series added to favorites', { userUuid, seriesId, seriesName: series.ser_name });

  return res.json(buildSuccessResponse({ message: 'Series added to favorites', seriesId }));
}));

// Remove series from favorites
router.delete('/series/:seriesId', [
  param('seriesId').isInt({ min: 1 }).withMessage('Series ID must be a positive integer')
], validate, requireAuth, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response> => {
  const user = req.user as RegisteredUser;
  const userUuid = user.user_uuid;
  const seriesId = parseInt(req.params.seriesId!);

  const result = await dbQuery(`
    DELETE FROM fav_series WHERE user_uuid = $1 AND series_id = $2
  `, [userUuid, seriesId]);

  if (result.rowCount === 0) {
    return res.status(404).json(buildErrorResponse('Series not found in favorites'));
  }

  logger.info('Series removed from favorites', { userUuid, seriesId });

  return res.json(buildSuccessResponse({ message: 'Series removed from favorites', seriesId }));
}));

// =======================
// Statistics and Utilities
// =======================

// Get favorites counts
router.get('/stats', requireAuth, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response> => {
  const user = req.user as RegisteredUser;
  const userUuid = user.user_uuid;

  const [booksResult, authorsResult, seriesResult] = await Promise.all([
    dbQuery('SELECT COUNT(*) as count FROM fav WHERE user_uuid = $1', [userUuid]),
    dbQuery('SELECT COUNT(*) as count FROM fav_authors WHERE user_uuid = $1', [userUuid]),
    dbQuery('SELECT COUNT(*) as count FROM fav_series WHERE user_uuid = $1', [userUuid])
  ]);

  const stats = {
    books: parseInt(booksResult.rows[0]?.count || '0'),
    authors: parseInt(authorsResult.rows[0]?.count || '0'),
    series: parseInt(seriesResult.rows[0]?.count || '0')
  };

  return res.json(buildSuccessResponse({ message: 'Favorites statistics', stats }));
}));

// Check if items are favorited
router.post('/check', [
  body('books').optional().isArray().withMessage('Books must be an array'),
  body('authors').optional().isArray().withMessage('Authors must be an array'),
  body('series').optional().isArray().withMessage('Series must be an array')
], validate, requireAuth, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response> => {
  const user = req.user as RegisteredUser;
  const userUuid = user.user_uuid;
  const { books, authors, series } = req.body;

  const result: any = {};

  if (books && Array.isArray(books)) {
    const bookIds = books.filter(id => Number.isInteger(id));
    if (bookIds.length > 0) {
      const booksQuery = await dbQuery(
        `SELECT bookid FROM fav WHERE user_uuid = $1 AND bookid = ANY($2)`,
        [userUuid, bookIds]
      );
      result.books = booksQuery.rows.map(row => row.bookid);
    } else {
      result.books = [];
    }
  }

  if (authors && Array.isArray(authors)) {
    const authorIds = authors.filter(id => Number.isInteger(id));
    if (authorIds.length > 0) {
      const authorsQuery = await dbQuery(
        `SELECT author_id FROM fav_authors WHERE user_uuid = $1 AND author_id = ANY($2)`,
        [userUuid, authorIds]
      );
      result.authors = authorsQuery.rows.map(row => row.author_id);
    } else {
      result.authors = [];
    }
  }

  if (series && Array.isArray(series)) {
    const seriesIds = series.filter(id => Number.isInteger(id));
    if (seriesIds.length > 0) {
      const seriesQuery = await dbQuery(
        `SELECT series_id FROM fav_series WHERE user_uuid = $1 AND series_id = ANY($2)`,
        [userUuid, seriesIds]
      );
      result.series = seriesQuery.rows.map(row => row.series_id);
    } else {
      result.series = [];
    }
  }

  return res.json(buildSuccessResponse({ message: 'Favorites check completed', result }));
}));

export default router;