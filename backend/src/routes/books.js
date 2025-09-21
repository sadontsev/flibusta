const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const BookService = require('../services/BookService');
const { optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// Get recent books
router.get('/recent', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
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
], validate, async (req, res, next) => {
  try {
    const searchParams = {
      query: req.query.q,
      author: req.query.author,
      genre: req.query.genre,
      series: req.query.series,
      year: req.query.year,
      language: req.query.language || 'ru',
      sort: req.query.sort || 'relevance',
      page: parseInt(req.query.page) || 0,
      limit: parseInt(req.query.limit) || 10
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
], validate, optionalAuth, async (req, res, next) => {
  try {
    const bookId = parseInt(req.params.id);
    const book = await BookService.getBookById(bookId);
    
    if (!book) {
      return res.status(404).json({
        success: false,
        error: 'Book not found'
      });
    }

    // Add user-specific data if authenticated
    if (req.user) {
      // Check if book is in user's favorites
      const { getRow } = require('../database/connection');
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
], validate, async (req, res, next) => {
  try {
    const authorId = parseInt(req.params.authorId);
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 10;
    
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
], validate, async (req, res, next) => {
  try {
    const genreCode = req.params.genreCode;
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 10;
    
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
], validate, async (req, res, next) => {
  try {
    const bookId = parseInt(req.params.id);
    const fileInfo = await BookService.getBookFileInfo(bookId);
    
    if (!fileInfo) {
      return res.status(404).json({
        success: false,
        error: 'Book file not found'
      });
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
router.get('/stats/overview', async (req, res, next) => {
  try {
    const { getRow } = require('../database/connection');
    
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

module.exports = router;
