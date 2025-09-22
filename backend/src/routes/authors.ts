import express, { Response, NextFunction } from 'express';
import { query, param, validationResult } from 'express-validator';
import { ExtendedRequest } from '../types';
import AuthorService from '../services/AuthorService';
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

// Get all authors with pagination
router.get('/', [
  query('q').optional().isString().trim(),
  query('letter').optional().isString().isLength({ min: 1, max: 1 }),
  query('sort').optional().isIn(['relevance', 'name', 'name_desc', 'firstname', 'firstname_desc', 'books', 'books_asc', 'recent']),
  query('page').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], validate, async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const searchParams = {
      query: req.query.q as string,
      letter: req.query.letter as string,
      sort: (req.query.sort as string) || 'relevance',
      page: parseInt(req.query.page as string) || 0,
      limit: parseInt(req.query.limit as string) || 50
    };

    const result = await AuthorService.searchAuthors(searchParams);
    
    res.json({
      success: true,
      data: result.authors,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

// Get authors by letter
router.get('/letter/:letter', [
  param('letter').isString().isLength({ min: 1, max: 1 }).withMessage('Letter must be a single character'),
  query('page').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], validate, async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const letter = req.params.letter!.toUpperCase();
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const result = await AuthorService.getAuthorsByLetter(letter, page, limit);
    
    res.json({
      success: true,
      data: result.authors,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

// Get author by ID
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('Author ID must be a positive integer')
], validate, optionalAuth, async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authorId = parseInt(req.params.id!);
    const author = await AuthorService.getAuthorById(authorId);
    
    if (!author) {
      res.status(404).json({
        success: false,
        error: 'Author not found'
      });
      return;
    }

    // Add user-specific data if authenticated
    if (req.user) {
      const favorite = await getRow(`
        SELECT id FROM fav 
        WHERE user_uuid = $1 AND avtorid = $2
      `, [req.user.user_uuid, authorId]);
      
      author.isFavorite = !!favorite;
    }
    
    res.json({
      success: true,
      data: author
    });
  } catch (error) {
    next(error);
  }
});

// Get author aliases
router.get('/:id/aliases', [
  param('id').isInt({ min: 1 }).withMessage('Author ID must be a positive integer')
], validate, async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authorId = parseInt(req.params.id!);
    const aliases = await AuthorService.getAuthorAliases(authorId);
    
    res.json({
      success: true,
      data: aliases
    });
  } catch (error) {
    next(error);
  }
});

// Get popular authors
router.get('/popular/list', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const authors = await AuthorService.getPopularAuthors(limit);
    
    res.json({
      success: true,
      data: authors
    });
  } catch (error) {
    next(error);
  }
});

// Get author statistics
router.get('/stats/overview', async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await AuthorService.getAuthorStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

export default router;
