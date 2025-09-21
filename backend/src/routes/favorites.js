const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { getRow, getRows, query } = require('../database/connection');
const { requireAuth } = require('../middleware/auth');
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

// Get user's favorites
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userUuid = req.user.user_uuid;

    // Get favorite books
    const favoriteBooks = await getRows(`
      SELECT b.bookid, b.title, b.year, b.lang, b.filetype, b.filesize, b.time,
             f.id as favorite_id
      FROM fav f
      JOIN libbook b ON f.bookid = b.bookid
      WHERE f.user_uuid = $1 AND f.bookid IS NOT NULL AND b.deleted = '0'
      ORDER BY b.title
    `, [userUuid]);

    // Get favorite authors
    const favoriteAuthors = await getRows(`
      SELECT a.avtorid, a.lastname, a.firstname, a.middlename, a.nickname,
             f.id as favorite_id
      FROM fav f
      JOIN libavtorname a ON f.avtorid = a.avtorid
      WHERE f.user_uuid = $1 AND f.avtorid IS NOT NULL
      ORDER BY a.lastname, a.firstname
    `, [userUuid]);

    // Get favorite series
    const favoriteSeries = await getRows(`
      SELECT s.seqid, s.seqname,
             f.id as favorite_id
      FROM fav f
      JOIN libseqname s ON f.seqid = s.seqid
      WHERE f.user_uuid = $1 AND f.seqid IS NOT NULL
      ORDER BY s.seqname
    `, [userUuid]);

    // Get authors for favorite books
    for (let book of favoriteBooks) {
      const authors = await getRows(`
        SELECT a.avtorid, a.lastname, a.firstname, a.middlename, a.nickname
        FROM libavtor a
        LEFT JOIN libavtorname USING(avtorid)
        WHERE a.bookid = $1
        ORDER BY a.pos
      `, [book.bookid]);
      book.authors = authors;
    }

    res.json({
      success: true,
      data: {
        books: favoriteBooks,
        authors: favoriteAuthors,
        series: favoriteSeries
      }
    });
  } catch (error) {
    next(error);
  }
});

// Add book to favorites
router.post('/books/:bookId', [
  param('bookId').isInt({ min: 1 }).withMessage('Book ID must be a positive integer')
], validate, requireAuth, async (req, res, next) => {
  try {
    const userUuid = req.user.user_uuid;
    const bookId = parseInt(req.params.bookId);

    // Check if book exists
    const book = await getRow(`
      SELECT bookid, title FROM libbook WHERE bookid = $1 AND deleted = '0'
    `, [bookId]);

    if (!book) {
      return res.status(404).json({
        success: false,
        error: 'Book not found'
      });
    }

    // Check if already in favorites
    const existing = await getRow(`
      SELECT id FROM fav WHERE user_uuid = $1 AND bookid = $2
    `, [userUuid, bookId]);

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Book is already in favorites'
      });
    }

    // Add to favorites
    await query(`
      INSERT INTO fav (user_uuid, bookid) VALUES ($1, $2)
    `, [userUuid, bookId]);

    logger.info('Book added to favorites', { userUuid, bookId, title: book.title });

    res.json({
      success: true,
      message: 'Book added to favorites'
    });
  } catch (error) {
    next(error);
  }
});

// Remove book from favorites
router.delete('/books/:bookId', [
  param('bookId').isInt({ min: 1 }).withMessage('Book ID must be a positive integer')
], validate, requireAuth, async (req, res, next) => {
  try {
    const userUuid = req.user.user_uuid;
    const bookId = parseInt(req.params.bookId);

    const result = await query(`
      DELETE FROM fav WHERE user_uuid = $1 AND bookid = $2
    `, [userUuid, bookId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Book not found in favorites'
      });
    }

    logger.info('Book removed from favorites', { userUuid, bookId });

    res.json({
      success: true,
      message: 'Book removed from favorites'
    });
  } catch (error) {
    next(error);
  }
});

// Add author to favorites
router.post('/authors/:authorId', [
  param('authorId').isInt({ min: 1 }).withMessage('Author ID must be a positive integer')
], validate, requireAuth, async (req, res, next) => {
  try {
    const userUuid = req.user.user_uuid;
    const authorId = parseInt(req.params.authorId);

    // Check if author exists
    const author = await getRow(`
      SELECT avtorid, lastname, firstname FROM libavtorname WHERE avtorid = $1
    `, [authorId]);

    if (!author) {
      return res.status(404).json({
        success: false,
        error: 'Author not found'
      });
    }

    // Check if already in favorites
    const existing = await getRow(`
      SELECT id FROM fav WHERE user_uuid = $1 AND avtorid = $2
    `, [userUuid, authorId]);

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Author is already in favorites'
      });
    }

    // Add to favorites
    await query(`
      INSERT INTO fav (user_uuid, avtorid) VALUES ($1, $2)
    `, [userUuid, authorId]);

    logger.info('Author added to favorites', { userUuid, authorId, name: `${author.lastname} ${author.firstname}` });

    res.json({
      success: true,
      message: 'Author added to favorites'
    });
  } catch (error) {
    next(error);
  }
});

// Remove author from favorites
router.delete('/authors/:authorId', [
  param('authorId').isInt({ min: 1 }).withMessage('Author ID must be a positive integer')
], validate, requireAuth, async (req, res, next) => {
  try {
    const userUuid = req.user.user_uuid;
    const authorId = parseInt(req.params.authorId);

    const result = await query(`
      DELETE FROM fav WHERE user_uuid = $1 AND avtorid = $2
    `, [userUuid, authorId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Author not found in favorites'
      });
    }

    logger.info('Author removed from favorites', { userUuid, authorId });

    res.json({
      success: true,
      message: 'Author removed from favorites'
    });
  } catch (error) {
    next(error);
  }
});

// Add series to favorites
router.post('/series/:seriesId', [
  param('seriesId').isInt({ min: 1 }).withMessage('Series ID must be a positive integer')
], validate, requireAuth, async (req, res, next) => {
  try {
    const userUuid = req.user.user_uuid;
    const seriesId = parseInt(req.params.seriesId);

    // Check if series exists
    const series = await getRow(`
      SELECT seqid, seqname FROM libseqname WHERE seqid = $1
    `, [seriesId]);

    if (!series) {
      return res.status(404).json({
        success: false,
        error: 'Series not found'
      });
    }

    // Check if already in favorites
    const existing = await getRow(`
      SELECT id FROM fav WHERE user_uuid = $1 AND seqid = $2
    `, [userUuid, seriesId]);

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Series is already in favorites'
      });
    }

    // Add to favorites
    await query(`
      INSERT INTO fav (user_uuid, seqid) VALUES ($1, $2)
    `, [userUuid, seriesId]);

    logger.info('Series added to favorites', { userUuid, seriesId, name: series.seqname });

    res.json({
      success: true,
      message: 'Series added to favorites'
    });
  } catch (error) {
    next(error);
  }
});

// Remove series from favorites
router.delete('/series/:seriesId', [
  param('seriesId').isInt({ min: 1 }).withMessage('Series ID must be a positive integer')
], validate, requireAuth, async (req, res, next) => {
  try {
    const userUuid = req.user.user_uuid;
    const seriesId = parseInt(req.params.seriesId);

    const result = await query(`
      DELETE FROM fav WHERE user_uuid = $1 AND seqid = $2
    `, [userUuid, seriesId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Series not found in favorites'
      });
    }

    logger.info('Series removed from favorites', { userUuid, seriesId });

    res.json({
      success: true,
      message: 'Series removed from favorites'
    });
  } catch (error) {
    next(error);
  }
});

// Get user's reading progress
router.get('/progress', requireAuth, async (req, res, next) => {
  try {
    const userUuid = req.user.user_uuid;

    const progress = await getRows(`
      SELECT p.bookid, p.pos, b.title, b.filetype, b.time
      FROM progress p
      JOIN libbook b ON p.bookid = b.bookid
      WHERE p.user_uuid = $1 AND b.deleted = '0'
      ORDER BY p.pos DESC
    `, [userUuid]);

    // Get authors for each book
    for (let book of progress) {
      const authors = await getRows(`
        SELECT a.avtorid, a.lastname, a.firstname, a.middlename, a.nickname
        FROM libavtor a
        LEFT JOIN libavtorname USING(avtorid)
        WHERE a.bookid = $1
        ORDER BY a.pos
      `, [book.bookid]);
      book.authors = authors;
    }

    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    next(error);
  }
});

// Save reading progress
router.post('/progress', [
  body('bookId').isInt({ min: 1 }).withMessage('Book ID must be a positive integer'),
  body('position').isFloat({ min: 0, max: 1 }).withMessage('Position must be between 0 and 1')
], validate, requireAuth, async (req, res, next) => {
  try {
    const userUuid = req.user.user_uuid;
    const { bookId, position } = req.body;

    // Check if book exists and is FB2
    const book = await getRow(`
      SELECT bookid, title, filetype FROM libbook WHERE bookid = $1 AND deleted = '0'
    `, [bookId]);

    if (!book) {
      return res.status(404).json({
        success: false,
        error: 'Book not found'
      });
    }

    if (book.filetype !== 'fb2') {
      return res.status(400).json({
        success: false,
        error: 'Reading progress is only supported for FB2 books'
      });
    }

    // Save or update progress
    await query(`
      INSERT INTO progress (user_uuid, bookid, pos) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (user_uuid, bookid) 
      DO UPDATE SET pos = $3
    `, [userUuid, bookId, position]);

    logger.info('Reading progress saved', { userUuid, bookId, position, title: book.title });

    res.json({
      success: true,
      message: 'Reading progress saved'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
