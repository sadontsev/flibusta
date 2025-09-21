import express, { Response, NextFunction } from 'express';
import { query, param, validationResult } from 'express-validator';
import { getRow, getRows } from '../database/connection';
import { ExtendedRequest } from '../types';

const router = express.Router();

// Validation middleware
const validate = (req: ExtendedRequest, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    }) as any;
  }
  next();
};

// Get all series with pagination
router.get('/', [
  query('q').optional().isString().trim(),
  query('letter').optional().isString().isLength({ min: 1, max: 1 }),
  query('page').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], validate, async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = (req.query.q as string) || '';
    const letter = (req.query.letter as string) || '';
    const page = parseInt((req.query.page as string) || '0');
    const limit = parseInt((req.query.limit as string) || '50');

    let conditions = ['1=1'];
    let params: any[] = [];
    let paramIndex = 1;

    // Search by name
    if (q) {
      conditions.push(`s.seqname ILIKE $${paramIndex}`);
      params.push(`%${q}%`);
      paramIndex++;
    }

    // Filter by first letter
    if (letter) {
      conditions.push(`s.seqname ILIKE $${paramIndex}`);
      params.push(`${letter}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const offset = page * limit;

    // Get total count
    const countResult = await getRow(`
      SELECT COUNT(*) as total
      FROM libseqname s
      WHERE ${whereClause}
    `, params);

    const total = parseInt(countResult.total);

    // Get series
    const series = await getRows(`
      SELECT s.seqid, s.seqname,
             COUNT(b.bookid) as book_count
      FROM libseqname s
      LEFT JOIN libseq seq ON s.seqid = seq.seqid
      LEFT JOIN libbook b ON seq.bookid = b.bookid AND b.deleted = '0'
      WHERE ${whereClause}
      GROUP BY s.seqid, s.seqname
      ORDER BY s.seqname
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    res.json({
      success: true,
      data: series,
      pagination: {
        page: page,
        limit: limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get series by ID
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('Series ID must be a positive integer')
], validate, async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const seriesId = parseInt(req.params.id!);
    
    const series = await getRow(`
      SELECT seqid, seqname
      FROM libseqname
      WHERE seqid = $1
    `, [seriesId]);

    if (!series) {
      res.status(404).json({
        success: false,
        error: 'Series not found'
      });
      return;
    }

    // Get books in this series
    const books = await getRows(`
      SELECT b.bookid, b.title, b.year, b.lang, b.filetype, b.filesize, b.time,
             seq.seqnumb, seq.level, seq.type
      FROM libseq seq
      JOIN libbook b ON seq.bookid = b.bookid
      WHERE seq.seqid = $1 AND b.deleted = '0'
      ORDER BY seq.seqnumb, b.title
    `, [seriesId]);

    // Get authors for each book
    for (let book of books) {
      const authors = await getRows(`
        SELECT a.avtorid, a.lastname, a.firstname, a.middlename, a.nickname
        FROM libavtor a
        LEFT JOIN libavtorname USING(avtorid)
        WHERE a.bookid = $1
        ORDER BY a.pos
      `, [book.bookid]);
      book.authors = authors;
    }

    series.books = books;
    series.bookCount = books.length;

    res.json({
      success: true,
      data: series
    });
  } catch (error) {
    next(error);
  }
});

// Get series by letter
router.get('/letter/:letter', [
  param('letter').isString().isLength({ min: 1, max: 1 }).withMessage('Letter must be a single character'),
  query('page').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], validate, async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const letter = req.params.letter!.toUpperCase();
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = page * limit;

    // Get total count
    const countResult = await getRow(`
      SELECT COUNT(*) as total
      FROM libseqname
      WHERE seqname ILIKE $1
    `, [`${letter}%`]);

    const total = parseInt(countResult.total);

    // Get series
    const series = await getRows(`
      SELECT s.seqid, s.seqname,
             COUNT(b.bookid) as book_count
      FROM libseqname s
      LEFT JOIN libseq seq ON s.seqid = seq.seqid
      LEFT JOIN libbook b ON seq.bookid = b.bookid AND b.deleted = '0'
      WHERE s.seqname ILIKE $1
      GROUP BY s.seqid, s.seqname
      ORDER BY s.seqname
      LIMIT $2 OFFSET $3
    `, [`${letter}%`, limit, offset]);

    res.json({
      success: true,
      data: series,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get series statistics
router.get('/stats/overview', async (req, res, next) => {
  try {
    const stats = await getRow(`
      SELECT 
        COUNT(DISTINCT seqid) as total_series,
        COUNT(DISTINCT SUBSTRING(seqname, 1, 1)) as first_letters,
        AVG(book_count) as avg_books_per_series
      FROM (
        SELECT s.seqid, s.seqname, COUNT(b.bookid) as book_count
        FROM libseqname s
        LEFT JOIN libseq seq ON s.seqid = seq.seqid
        LEFT JOIN libbook b ON seq.bookid = b.bookid AND b.deleted = '0'
        GROUP BY s.seqid, s.seqname
      ) series_stats
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
