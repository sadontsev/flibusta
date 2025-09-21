const express = require('express');
const { query, param, validationResult } = require('express-validator');
const { getRow, getRows } = require('../database/connection');

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

// Get all genres
router.get('/', async (req, res, next) => {
  try {
    const genres = await getRows(`
      SELECT DISTINCT genremeta as category, 
             COUNT(*) as book_count
      FROM libgenrelist
      GROUP BY genremeta
      ORDER BY genremeta
    `);

    res.json({
      success: true,
      data: genres
    });
  } catch (error) {
    next(error);
  }
});

// Get genres by category
router.get('/category/:category', [
  param('category').isString().trim().notEmpty().withMessage('Category is required')
], validate, async (req, res, next) => {
  try {
    const category = req.params.category;
    
    const genres = await getRows(`
      SELECT genreid, genrecode, genredesc, genremeta,
             COUNT(b.bookid) as book_count
      FROM libgenrelist gl
      LEFT JOIN libgenre g ON gl.genreid = g.genreid
      LEFT JOIN libbook b ON g.bookid = b.bookid AND b.deleted = '0'
      WHERE gl.genremeta = $1
      GROUP BY gl.genreid, gl.genrecode, gl.genredesc, gl.genremeta
      ORDER BY gl.genredesc
    `, [category]);

    res.json({
      success: true,
      data: genres
    });
  } catch (error) {
    next(error);
  }
});

// Get genre by code
router.get('/:genreCode', [
  param('genreCode').isString().trim().notEmpty().withMessage('Genre code is required')
], validate, async (req, res, next) => {
  try {
    const genreCode = req.params.genreCode;
    
    const genre = await getRow(`
      SELECT genreid, genrecode, genredesc, genremeta
      FROM libgenrelist
      WHERE genrecode = $1
    `, [genreCode]);

    if (!genre) {
      return res.status(404).json({
        success: false,
        error: 'Genre not found'
      });
    }

    // Get book count for this genre
    const bookCount = await getRow(`
      SELECT COUNT(*) as count
      FROM libgenre g
      JOIN libbook b ON g.bookid = b.bookid
      WHERE g.genreid = $1 AND b.deleted = '0'
    `, [genre.genreid]);

    genre.bookCount = parseInt(bookCount.count);

    res.json({
      success: true,
      data: genre
    });
  } catch (error) {
    next(error);
  }
});

// Get genre statistics
router.get('/stats/overview', async (req, res, next) => {
  try {
    const stats = await getRow(`
      SELECT 
        COUNT(DISTINCT genreid) as total_genres,
        COUNT(DISTINCT genremeta) as total_categories,
        COUNT(DISTINCT genrecode) as total_codes
      FROM libgenrelist
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
