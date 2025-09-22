import express, { Response, NextFunction } from 'express';
import { query, param, validationResult } from 'express-validator';
import { ExtendedRequest } from '../types';
import BookService from '../services/BookService';
import { optionalAuth } from '../middleware/auth';
import { getRow } from '../database/connection';

const router = express.Router();

// Validation middleware
const validate = (req: ExtendedRequest, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      errors: errors.array()
    });
    return;
  }
  next();
};

// Get recent books
router.get('/recent', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const books = await BookService.getRecentBooks(limit);
    
    res.json({
      success: true,
      data: books
    });
  } catch (error) {
    next(error);
  }
});

// Search books
router.get('/search', [
  query('q').optional().isString().trim(),
  query('author').optional().isString().trim(),
  query('genre').optional().isString().trim(),
  query('series').optional().isString().trim(),
  query('year').optional().isInt({ min: 1800, max: 2100 }),
  query('language').optional().isString().isLength({ min: 2, max: 3 }),
  query('sort').optional().isIn(['relevance', 'date', 'title', 'title_desc', 'author', 'author_desc', 'year', 'year_desc', 'rating', 'rating_asc']),
  query('page').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], validate, async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const searchParams = {
      query: req.query.q as string,
      author: req.query.author as string,
      genre: req.query.genre as string,
      series: req.query.series as string,
      year: req.query.year as string,
      language: (req.query.language as string) || 'ru',
      sort: (req.query.sort as string) || 'relevance',
      page: parseInt(req.query.page as string) || 0,
      limit: parseInt(req.query.limit as string) || 10
    };

    const result = await BookService.searchBooks(searchParams);
    
    res.json({
      success: true,
      data: result.books,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

// Get book by ID
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('Book ID must be a positive integer')
], validate, optionalAuth, async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bookId = parseInt(req.params.id!);
    const book = await BookService.getBookById(bookId);
    
    if (!book) {
      res.status(404).json({
        success: false,
        error: 'Book not found'
      });
      return;
    }

    // Add user-specific data if authenticated
    if (req.user) {
      // Check if book is in user's favorites
      const favorite = await getRow(`
        SELECT id FROM fav 
        WHERE user_uuid = $1 AND bookid = $2
      `, [req.user.user_uuid, bookId]);
      
      book.isFavorite = !!favorite;

      // Get reading progress for FB2 books
      if (book.filetype === 'fb2') {
        const progress = await getRow(`
          SELECT pos FROM progress 
          WHERE user_uuid = $1 AND bookid = $2
        `, [req.user.user_uuid, bookId]);
        
        if (progress) {
          book.readingProgress = progress.pos;
        }
      }
    }
    
    res.json({
      success: true,
      data: book
    });
  } catch (error) {
    next(error);
  }
});

// Get books by author
router.get('/author/:authorId', [
  param('authorId').isInt({ min: 1 }).withMessage('Author ID must be a positive integer'),
  query('page').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], validate, async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authorId = parseInt(req.params.authorId!);
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const result = await BookService.getBooksByAuthor(authorId, page, limit);
    
    res.json({
      success: true,
      data: result.books,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

// Get books by genre
router.get('/genre/:genreCode', [
  param('genreCode').isString().trim().notEmpty().withMessage('Genre code is required'),
  query('page').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], validate, async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const genreCode = req.params.genreCode!;
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const result = await BookService.getBooksByGenre(genreCode, page, limit);
    
    res.json({
      success: true,
      data: result.books,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

// Get book file info (for downloading)
router.get('/:id/file-info', [
  param('id').isInt({ min: 1 }).withMessage('Book ID must be a positive integer')
], validate, async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bookId = parseInt(req.params.id!);
    const fileInfo = await BookService.getBookFileInfo(bookId);
    
    if (!fileInfo) {
      res.status(404).json({
        success: false,
        error: 'Book file not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: fileInfo
    });
  } catch (error) {
    next(error);
  }
});

// Get book statistics
router.get('/stats/overview', async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    
    const stats = await getRow(`
      SELECT 
        COUNT(*) as total_books,
        COUNT(DISTINCT lang) as languages,
        MIN(year) as earliest_year,
        MAX(year) as latest_year,
        COUNT(DISTINCT filetype) as file_types
      FROM libbook 
      WHERE deleted = '0'
    `);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

export default router;
