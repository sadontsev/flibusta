import { getRow, getRows, query } from '../database/connection';
import logger from '../utils/logger';

interface Book {
  bookid: number;
  title: string;
  filetype: string;
  annotation?: string;
  authors?: Author[];
  genres?: Genre[];
  series?: Series[];
  reviews?: Review[];
  isFavorite?: boolean;
  readingProgress?: number;
}

interface Author {
  avtorid: number;
  lastname: string;
  firstname: string;
  middlename?: string;
  nickname?: string;
  pos: number;
}

interface Genre {
  genreid: number;
  genrecode: string;
  genredesc: string;
  genremeta: string;
}

interface Series {
  seqid: number;
  seqname: string;
  seqnumb?: number;
  level?: number;
  type?: string;
}

interface Review {
  id: number;
  rating: number;
  review_text?: string;
  user_id: string;
  created_at: Date;
}

interface SearchParams {
  query?: string;
  author?: string;
  genre?: string;
  series?: string;
  year?: string;
  language?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

interface SearchResult {
  books: Book[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

class BookService {
  private recordsPerPage: number;

  constructor() {
    this.recordsPerPage = parseInt(process.env.RECORDS_PER_PAGE || '10');
  }

  async getBookById(bookId: number): Promise<Book | null> {
    try {
      const book = await getRow(`
        SELECT b.*,
               (SELECT body FROM libbannotations WHERE bookid = b.bookid LIMIT 1) as annotation
        FROM libbook b 
        WHERE b.bookid = $1 AND b.deleted = '0'
      `, [bookId]);

      if (!book) {
        return null;
      }

      // Get authors
      const authors = await getRows(`
        SELECT a.avtorid, an.lastname, an.firstname, an.middlename, an.nickname, a.pos
        FROM libavtor a
        LEFT JOIN libavtorname an ON a.avtorid = an.avtorid
        WHERE a.bookid = $1
        ORDER BY a.pos
      `, [bookId]);

      // Get genres
      const genres = await getRows(`
        SELECT g.genreid, g.genrecode, g.genredesc, g.genremeta
        FROM libgenre
        JOIN libgenrelist g USING(genreid)
        WHERE bookid = $1
        ORDER BY g.genredesc
      `, [bookId]);

      // Get series
      const series = await getRows(`
        SELECT seq.seqid, s.seqname, seq.seqnumb, seq.level, seq."Type" as type
        FROM libseq seq
        JOIN libseqname s ON seq.seqid = s.seqid
        WHERE seq.bookid = $1
        ORDER BY seq.seqnumb
      `, [bookId]);

      // Get reviews
      const reviews = await getRows(`
        SELECT name, text, time
        FROM libreviews
        WHERE bookid = $1
        ORDER BY time DESC
      `, [bookId]);

      return {
        ...book,
        authors,
        genres,
        series,
        reviews
      };
    } catch (error) {
      logger.error('Error getting book by ID', { bookId, error: (error as Error).message });
      throw error;
    }
  }

  async searchBooks(searchParams: SearchParams): Promise<SearchResult> {
    try {
      const {
        query = '',
        author = '',
        genre = '',
        series = '',
        year = '',
        language = 'ru',
        sort = 'date',
        page = 0,
        limit = this.recordsPerPage
      } = searchParams;

      let conditions = ['b.deleted = $1'];
      let params = ['0'];
      let paramIndex = 2;

      // Enhanced search that can handle combined book name and author queries
      if (query) {
        // Split query into potential book title and author parts
        const queryParts = query.split(/\s+by\s+|\s+автор\s+|\s+от\s+/i);
        
        if (queryParts.length > 1) {
          // Query contains both book title and author
          const bookTitle = queryParts[0]?.trim();
          const authorName = queryParts[1]?.trim();
          
          if (bookTitle) {
            conditions.push(`b.title ILIKE $${paramIndex}`);
            params.push(`%${bookTitle}%`);
            paramIndex++;
          }
          
          if (authorName) {
            conditions.push(`EXISTS (
              SELECT 1 FROM libavtor a 
              JOIN libavtorname an ON a.avtorid = an.avtorid 
              WHERE a.bookid = b.bookid 
              AND (
                an.lastname ILIKE $${paramIndex} 
                OR an.firstname ILIKE $${paramIndex}
                OR an.nickname ILIKE $${paramIndex}
                OR CONCAT(an.lastname, ' ', an.firstname) ILIKE $${paramIndex}
                OR CONCAT(an.firstname, ' ', an.lastname) ILIKE $${paramIndex}
              )
            )`);
            params.push(`%${authorName}%`);
            paramIndex++;
          }
        } else {
          // Single query - search in both title and author fields
          conditions.push(`(
            b.title ILIKE $${paramIndex} 
            OR EXISTS (
              SELECT 1 FROM libavtor a 
              JOIN libavtorname an ON a.avtorid = an.avtorid 
              WHERE a.bookid = b.bookid 
              AND (
                an.lastname ILIKE $${paramIndex} 
                OR an.firstname ILIKE $${paramIndex}
                OR an.nickname ILIKE $${paramIndex}
                OR CONCAT(an.lastname, ' ', an.firstname) ILIKE $${paramIndex}
                OR CONCAT(an.firstname, ' ', an.lastname) ILIKE $${paramIndex}
              )
            )
          )`);
          params.push(`%${query}%`);
          paramIndex++;
        }
      }

      // Search by author (separate parameter)
      if (author) {
        conditions.push(`EXISTS (
          SELECT 1 FROM libavtor a 
          JOIN libavtorname an ON a.avtorid = an.avtorid 
          WHERE a.bookid = b.bookid 
          AND (
            an.lastname ILIKE $${paramIndex} 
            OR an.firstname ILIKE $${paramIndex}
            OR an.nickname ILIKE $${paramIndex}
            OR CONCAT(an.lastname, ' ', an.firstname) ILIKE $${paramIndex}
            OR CONCAT(an.firstname, ' ', an.lastname) ILIKE $${paramIndex}
          )
        )`);
        params.push(`%${author}%`);
        paramIndex++;
      }

      // Search by genre
      if (genre) {
        conditions.push(`EXISTS (
          SELECT 1 FROM libgenre g
          JOIN libgenrelist gl ON g.genreid = gl.genreid
          WHERE g.bookid = b.bookid 
          AND gl.genredesc ILIKE $${paramIndex}
        )`);
        params.push(`%${genre}%`);
        paramIndex++;
      }

      // Search by series
      if (series) {
        conditions.push(`EXISTS (
          SELECT 1 FROM libseq seq
          JOIN libseqname s ON seq.seqid = s.seqid
          WHERE seq.bookid = b.bookid 
          AND s.seqname ILIKE $${paramIndex}
        )`);
        params.push(`%${series}%`);
        paramIndex++;
      }

      // Search by year
      if (year) {
        conditions.push(`b.year = $${paramIndex}`);
        params.push(year);
        paramIndex++;
      }

      // Language filter
      if (language) {
        conditions.push(`b.lang = $${paramIndex}`);
        params.push(language);
        paramIndex++;
      }

      // Build ORDER BY clause based on sort parameter
      let orderBy = 'b.bookid DESC'; // default
      let orderByParams: any[] = [];
      
      switch (sort) {
        case 'relevance':
          // For relevance, prioritize exact matches and recent additions
          if (query) {
            orderBy = 'relevance_score ASC, b.bookid DESC';
            orderByParams = [
              query,                    // exact match
              query + '%',              // starts with
              '%' + query + '%'         // contains
            ];
            paramIndex += 3;
          } else {
            orderBy = 'b.bookid DESC';
          }
          break;
        case 'title':
          orderBy = 'b.title ASC';
          break;
        case 'title_desc':
          orderBy = 'b.title DESC';
          break;
        case 'author':
          orderBy = 'author_name ASC';
          break;
        case 'author_desc':
          orderBy = 'author_name DESC';
          break;
        case 'year':
          orderBy = 'b.year ASC NULLS LAST';
          break;
        case 'year_desc':
          orderBy = 'b.year DESC NULLS FIRST';
          break;
        case 'rating':
          orderBy = 'b.rating DESC NULLS LAST';
          break;
        case 'rating_asc':
          orderBy = 'b.rating ASC NULLS LAST';
          break;
        case 'date':
        default:
          orderBy = 'b.bookid DESC';
          break;
      }

      const offset = page * limit;

      // Combine params with orderByParams for relevance sorting
      const finalParams = [...params, ...orderByParams, limit, offset];

      // Main query with author information
      const sql = `
        SELECT DISTINCT b.*,
               (SELECT STRING_AGG(CONCAT(an.lastname, ' ', an.firstname), ', ' ORDER BY a.pos)
                FROM libavtor a
                JOIN libavtorname an ON a.avtorid = an.avtorid
                WHERE a.bookid = b.bookid) as author_name,
               (SELECT COUNT(*) FROM libavtor WHERE bookid = b.bookid) as author_count
               ${sort === 'relevance' && query ? `,
               CASE 
                 WHEN b.title ILIKE $${paramIndex} THEN 1
                 WHEN b.title ILIKE $${paramIndex + 1} THEN 2
                 WHEN b.title ILIKE $${paramIndex + 2} THEN 3
                 ELSE 4
               END as relevance_score` : ''}
        FROM libbook b
        WHERE ${conditions.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT $${finalParams.length - 1} OFFSET $${finalParams.length}
      `;

      const books = await getRows(sql, finalParams);

      // Get total count for pagination
      const countSql = `
        SELECT COUNT(DISTINCT b.bookid) as total
        FROM libbook b
        WHERE ${conditions.join(' AND ')}
      `;
      
      const countParams = params; // Use original params for count query
      const countResult = await getRow(countSql, countParams);
      const total = parseInt(countResult.total);

      // Enhance books with additional data
      const enhancedBooks = await Promise.all(books.map(async (book) => {
        // Get primary author for display
        const primaryAuthor = await getRow(`
          SELECT an.lastname, an.firstname, an.nickname
          FROM libavtor a
          JOIN libavtorname an ON a.avtorid = an.avtorid
          WHERE a.bookid = $1
          ORDER BY a.pos
          LIMIT 1
        `, [book.bookid]);

        // Get genres
        const genres = await getRows(`
          SELECT gl.genredesc
          FROM libgenre g
          JOIN libgenrelist gl ON g.genreid = gl.genreid
          WHERE g.bookid = $1
          ORDER BY gl.genredesc
          LIMIT 3
        `, [book.bookid]);

        return {
          ...book,
          authors: primaryAuthor ? [primaryAuthor] : [],
          genres: genres.map(g => ({ genredesc: g.genredesc })),
          filetype: book.filetype || 'unknown'
        };
      }));

      return {
        books: enhancedBooks,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit) - 1,
          hasPrev: page > 0
        }
      };
    } catch (error) {
      logger.error('Error searching books', { searchParams, error: (error as Error).message });
      throw error;
    }
  }

  async getRecentBooks(limit: number = 20): Promise<Book[]> {
    try {
      const books = await getRows(`
        SELECT b.bookid, b.title, b.year, b.lang, b.filetype, b.filesize, b.time
        FROM libbook b
        WHERE b.deleted = '0'
        ORDER BY b.time DESC
        LIMIT $1
      `, [limit]);

      // Get authors for each book
      for (let book of books) {
        const authors = await getRows(`
          SELECT a.avtorid, an.lastname, an.firstname, an.middlename, an.nickname
          FROM libavtor a
          LEFT JOIN libavtorname an ON a.avtorid = an.avtorid
          WHERE a.bookid = $1
          ORDER BY a.pos
        `, [book.bookid]);
        book.authors = authors;
      }

      return books;
    } catch (error) {
      logger.error('Error getting recent books', { error: (error as Error).message });
      throw error;
    }
  }

  async getBooksByAuthor(authorId: number, page: number = 0, limit: number = this.recordsPerPage): Promise<SearchResult> {
    try {
      const offset = page * limit;

      // Get total count
      const countResult = await getRow(`
        SELECT COUNT(*) as total
        FROM libbook b
        JOIN libavtor a ON b.bookid = a.bookid
        WHERE a.avtorid = $1 AND b.deleted = '0'
      `, [authorId]);

      const total = parseInt(countResult.total);

      // Get books
      const books = await getRows(`
        SELECT b.bookid, b.title, b.year, b.lang, b.filetype, b.filesize, b.time
        FROM libbook b
        JOIN libavtor a ON b.bookid = a.bookid
        WHERE a.avtorid = $1 AND b.deleted = '0'
        ORDER BY b.title
        LIMIT $2 OFFSET $3
      `, [authorId, limit, offset]);

      // Get authors for each book
      for (let book of books) {
        const authors = await getRows(`
          SELECT a.avtorid, an.lastname, an.firstname, an.middlename, an.nickname
          FROM libavtor a
          LEFT JOIN libavtorname an ON a.avtorid = an.avtorid
          WHERE a.bookid = $1
          ORDER BY a.pos
        `, [book.bookid]);
        book.authors = authors;
      }

      return {
        books,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting books by author', { authorId, error: (error as Error).message });
      throw error;
    }
  }

  async getBooksByGenre(genreCode: string, page: number = 0, limit: number = this.recordsPerPage): Promise<SearchResult> {
    try {
      const offset = page * limit;

      // Get total count
      const countResult = await getRow(`
        SELECT COUNT(*) as total
        FROM libbook b
        JOIN libgenre g ON b.bookid = g.bookid
        JOIN libgenrelist gl ON g.genreid = gl.genreid
        WHERE gl.genrecode = $1 AND b.deleted = '0'
      `, [genreCode]);

      const total = parseInt(countResult.total);

      // Get books
      const books = await getRows(`
        SELECT b.bookid, b.title, b.year, b.lang, b.filetype, b.filesize, b.time
        FROM libbook b
        JOIN libgenre g ON b.bookid = g.bookid
        JOIN libgenrelist gl ON g.genreid = gl.genreid
        WHERE gl.genrecode = $1 AND b.deleted = '0'
        ORDER BY b.title
        LIMIT $2 OFFSET $3
      `, [genreCode, limit, offset]);

      // Get authors for each book
      for (let book of books) {
        const authors = await getRows(`
          SELECT a.avtorid, an.lastname, an.firstname, an.middlename, an.nickname
          FROM libavtor a
          LEFT JOIN libavtorname an ON a.avtorid = an.avtorid
          WHERE a.bookid = $1
          ORDER BY a.pos
        `, [book.bookid]);
        book.authors = authors;
      }

      return {
        books,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting books by genre', { genreCode, error: (error as Error).message });
      throw error;
    }
  }

  async getBookFileInfo(bookId: number): Promise<any> {
    try {
      const fileInfo = await getRow(`
        SELECT filename, start_id, end_id, usr
        FROM book_zip
        WHERE $1 BETWEEN start_id AND end_id
      `, [bookId]);

      return fileInfo;
    } catch (error) {
      logger.error('Error getting book file info', { bookId, error: (error as Error).message });
      throw error;
    }
  }
}

export default new BookService();
