import { getRow, getRows } from '../database/connection';
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
  rating?: number;
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
  // Simple in-memory LRU-ish cache (time + size constrained)
  private searchCache: Map<string, { time: number; data: SearchResult }> = new Map();
  private cacheTTLms = 30_000; // 30s
  private cacheMaxEntries = 200;

  constructor() {
    this.recordsPerPage = parseInt(process.env.RECORDS_PER_PAGE || '10');
  }

  // Determine the actually available filetype for a book by consulting book_zip
  private async getAvailableFiletype(bookId: number, requestedType?: string): Promise<string> {
    try {
      const requested = (requestedType || '').toLowerCase().trim();
      const row = await getRow(`
        SELECT filename
        FROM book_zip
        WHERE $1 BETWEEN start_id AND end_id
        ORDER BY
          (CASE WHEN $2 <> '' AND filename ILIKE ('f.' || $2 || '.%') THEN 1 ELSE 0 END) DESC,
          (CASE WHEN filename ILIKE 'f.fb2.%' THEN 1 ELSE 0 END) DESC,
          (CASE WHEN filename ILIKE 'f.epub.%' THEN 1 ELSE 0 END) DESC,
          (CASE WHEN filename ILIKE 'f.djvu.%' THEN 1 ELSE 0 END) DESC,
          usr ASC,
          filename ASC
        LIMIT 1
      `, [bookId, requested]);
      if (!row || !row.filename) {
        return requested || 'unknown';
      }
      const m = /^f\.(\w+)\./i.exec(row.filename as string);
      return (m && m[1]) ? m[1].toLowerCase() : (requested || 'unknown');
    } catch (e) {
      logger.warn('getAvailableFiletype failed, falling back', { bookId, requestedType, error: (e as Error).message });
      return (requestedType || 'unknown');
    }
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

      // Determine effective/available filetype for display
      const effectiveType = await this.getAvailableFiletype(bookId, (book as any).filetype);

      return {
        ...(book as any),
        original_filetype: (book as any).filetype,
        filetype: effectiveType,
  cover_url: `/api/files/cover/${bookId}?fast=1`,
        authors: authors as any,
        genres: genres as any,
        series: series as any,
        reviews: reviews as any
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

      // Build cache key (avoid caching pages with high page index to limit memory)
      const cacheKey = JSON.stringify({ q: query, author, genre, series, year, language, sort, page, limit, v: 2 });
      if (page < 5) { // only cache early pages
        const cached = this.searchCache.get(cacheKey);
        if (cached && (Date.now() - cached.time) < this.cacheTTLms) {
          return cached.data;
        }
      }

  // Base conditions & parameter tracking
  const conditions: string[] = ['b.deleted = $1'];
  const params: any[] = ['0'];
      let p = 2; // next param index

      // Combined title + author logic (keep semantics of previous implementation)
      // Full-text search for title if query provided. Fallback to trigram ILIKE if short or no lexemes.
      if (query) {
        // Russian FTS primary match + tokenized fallback across title and author names
        const ftsParam = p;
        params.push(query); p++;

        // Tokenize query to handle cases like "Война и мир толстой":
        // require that each token appears either in title or any author field
        const stopwords = new Set(['и','в','на','с','к','по','за','о','от','до','из','у','над','под','для','как','что','это','не','а','но','же','ли']);
        const tokens = query
          .split(/\s+/)
          .map(t => t.trim())
          .filter(t => t.length >= 2 && !stopwords.has(t.toLowerCase()))
          .slice(0, 6);

        const tokenConds: string[] = [];
        for (const _t of tokens) {
          const likeIdx = p;
          params.push(`%${_t}%`); p++;
          tokenConds.push(`(
            b.title ILIKE $${likeIdx}
            OR EXISTS (
              SELECT 1 FROM libavtor a
              JOIN libavtorname an ON a.avtorid = an.avtorid
              WHERE a.bookid = b.bookid AND (
                an.lastname ILIKE $${likeIdx}
                OR an.firstname ILIKE $${likeIdx}
                OR an.nickname ILIKE $${likeIdx}
                OR (an.lastname || ' ' || an.firstname) ILIKE $${likeIdx}
              )
            )
          )`);
        }

        // Combine FTS and tokenized fallback (AND across tokens)
        const fallback = tokenConds.length ? tokenConds.join(' AND ') : '';
        const combined = fallback ? `(${fallback})` : 'TRUE';
        conditions.push(`(b.search_vector @@ websearch_to_tsquery('russian', $${ftsParam}) OR ${combined})`);
      }
      if (author) {
        // Use trigram index on concatenated author fields via expression index (already created)
        conditions.push(`EXISTS (
          SELECT 1 FROM libavtor a
          JOIN libavtorname an ON a.avtorid = an.avtorid
          WHERE a.bookid = b.bookid
            AND ( (an.lastname || ' ' || an.firstname || ' ' || coalesce(an.nickname,'')) ILIKE $${p} )
        )`);
        params.push(`%${author}%`); p++;
      }
      if (genre) {
        conditions.push(`EXISTS (
          SELECT 1 FROM libgenre g
          JOIN libgenrelist gl ON g.genreid = gl.genreid
          WHERE g.bookid = b.bookid AND gl.genredesc ILIKE $${p}
        )`);
        params.push(`%${genre}%`); p++;
      }
      if (series) {
        conditions.push(`EXISTS (
          SELECT 1 FROM libseq seq
          JOIN libseqname s ON seq.seqid = s.seqid
          WHERE seq.bookid = b.bookid AND s.seqname ILIKE $${p}
        )`);
        params.push(`%${series}%`); p++;
      }
      if (year) {
        conditions.push(`b.year = $${p}`);
        params.push(year); p++;
      }
      if (language) {
        conditions.push(`LOWER(TRIM(b.lang)) = LOWER($${p})`);
        params.push(language.trim()); p++;
      }

      // Sorting logic
      // Use aliases available in the outer SELECT:
      // - Columns from "base" CTE are referenced as base.* in ORDER BY
      // - LATERAL-selected aliases like primary_author_* are available directly
      let orderBy = 'base.bookid DESC';
      let relevanceBase: number | null = null;
      if (sort === 'relevance' && query) {
        // Relevance with FTS rank + simple fallback scoring
        relevanceBase = p;
        // Using ts_rank for ordering (lower rank first if we invert? We'll use DESC to show highest relevance first)
        // relevance_score is selected into the base CTE via relevanceSelect below
        orderBy = 'base.relevance_score DESC, base.bookid DESC';
        params.push(query); p++;
      } else {
        switch (sort) {
          case 'title': orderBy = 'base.title ASC'; break;
          case 'title_desc': orderBy = 'base.title DESC'; break;
          case 'author': orderBy = 'primary_author_lastname ASC NULLS LAST, primary_author_firstname ASC NULLS LAST'; break;
          case 'author_desc': orderBy = 'primary_author_lastname DESC NULLS LAST, primary_author_firstname DESC NULLS LAST'; break;
          case 'year': orderBy = 'base.year ASC NULLS LAST'; break;
          case 'year_desc': orderBy = 'base.year DESC NULLS FIRST'; break;
          case 'rating': orderBy = 'base.bookid DESC'; break; // fallback: no rating column in schema
          case 'rating_asc': orderBy = 'base.bookid ASC'; break; // fallback
          case 'date':
          default: orderBy = 'base.bookid DESC'; break;
        }
      }

      const offset = page * limit;
      params.push(limit, offset); // for LIMIT / OFFSET
      const limitParamIndex = p;
      const offsetParamIndex = p + 1;

  const relevanceSelect = (sort === 'relevance' && query) ? ', ts_rank(b.search_vector, websearch_to_tsquery(\'russian\', $' + (relevanceBase as number) + ')) AS relevance_score' : '';

      // Single-pass query with lateral joins to avoid N+1
      const sql = `
        WITH base AS (
          SELECT b.bookid, b.title, b.year, b.lang, b.filetype, b.filesize, b.time,
                 COUNT(*) OVER() AS total_count${relevanceSelect}
          FROM libbook b
          WHERE ${conditions.join(' AND ')}
        )
        SELECT base.*, 
               pa.lastname AS primary_author_lastname,
               pa.firstname AS primary_author_firstname,
               pa.nickname AS primary_author_nickname,
               g3.genres AS genres_array,
               ef.effective_filetype
        FROM base
        LEFT JOIN LATERAL (
          SELECT an.lastname, an.firstname, an.nickname
          FROM libavtor a
          JOIN libavtorname an ON a.avtorid = an.avtorid
          WHERE a.bookid = base.bookid
          ORDER BY a.pos
          LIMIT 1
        ) pa ON TRUE
        LEFT JOIN LATERAL (
          SELECT array_agg(gl.genredesc ORDER BY gl.genredesc) AS genres
          FROM libgenre g
          JOIN libgenrelist gl ON g.genreid = gl.genreid
          WHERE g.bookid = base.bookid
          LIMIT 3
        ) g3 ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            CASE
              WHEN filename ILIKE 'f.fb2.%' THEN 'fb2'
              WHEN filename ILIKE 'f.epub.%' THEN 'epub'
              WHEN filename ILIKE 'f.djvu.%' THEN 'djvu'
              WHEN filename ILIKE 'f.pdf.%' THEN 'pdf'
              WHEN filename ILIKE 'f.mobi.%' THEN 'mobi'
              WHEN filename ILIKE 'f.txt.%' THEN 'txt'
              WHEN filename ILIKE 'f.rtf.%' THEN 'rtf'
              WHEN filename ILIKE 'f.html.%' OR filename ILIKE 'f.htm.%' THEN 'html'
              ELSE lower(split_part(filename, '.', 2))
            END AS effective_filetype
          FROM book_zip
          WHERE base.bookid BETWEEN start_id AND end_id
          ORDER BY
            (CASE WHEN coalesce(base.filetype,'') <> '' AND filename ILIKE ('f.' || lower(base.filetype) || '.%') THEN 1 ELSE 0 END) DESC,
            (CASE WHEN filename ILIKE 'f.fb2.%' THEN 1 ELSE 0 END) DESC,
            (CASE WHEN filename ILIKE 'f.epub.%' THEN 1 ELSE 0 END) DESC,
            (CASE WHEN filename ILIKE 'f.djvu.%' THEN 1 ELSE 0 END) DESC,
            usr ASC,
            filename ASC
          LIMIT 1
        ) ef ON TRUE
        ORDER BY ${orderBy}
        LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex};
      `;

      const rows = await getRows(sql, params);
      const total = rows.length ? parseInt((rows[0] as any).total_count, 10) : 0;

      const books = rows.map(r => {
        const authorsArr = (r as any).primary_author_lastname ? [{
          lastname: (r as any).primary_author_lastname,
          firstname: (r as any).primary_author_firstname,
          nickname: (r as any).primary_author_nickname
        }] : [];
        const genres = Array.isArray((r as any).genres_array) ? (r as any).genres_array.map((g: string) => ({ genredesc: g })) : [];
        const effectiveType = (r as any).effective_filetype || (r as any).filetype || 'unknown';
        return {
          ...r,
            authors: authorsArr,
            genres,
            filetype: effectiveType,
            cover_url: `/api/files/cover/${(r as any).bookid}?fast=1`
        };
      });

      const result: SearchResult = {
        books: books as any,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit) - 1,
          hasPrev: page > 0
        }
      };

      // Insert into cache (LRU-ish eviction)
      if (page < 5) {
        this.searchCache.set(cacheKey, { time: Date.now(), data: result });
        if (this.searchCache.size > this.cacheMaxEntries) {
          // Evict oldest
            const entries = Array.from(this.searchCache.entries()).sort((a,b)=> a[1].time - b[1].time);
            const evictCount = Math.ceil(this.cacheMaxEntries * 0.1);
            for (let i = 0; i < evictCount && i < entries.length; i++) {
              const entry = entries[i];
              if (entry) this.searchCache.delete(entry[0]);
            }
        }
      }

      return result;
    } catch (error) {
      logger.error('Error searching books (refactored query)', { searchParams, error: (error as Error).message });
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
      for (const book of books) {
        const authors = await getRows(`
          SELECT a.avtorid, an.lastname, an.firstname, an.middlename, an.nickname
          FROM libavtor a
          LEFT JOIN libavtorname an ON a.avtorid = an.avtorid
          WHERE a.bookid = $1
          ORDER BY a.pos
        `, [book.bookid]);
        book.authors = authors;
        // Override filetype with actually available one
        const effectiveType = await this.getAvailableFiletype(book.bookid, book.filetype);
        (book as any).filetype = effectiveType || book.filetype;
  (book as any).cover_url = `/api/files/cover/${book.bookid}?fast=1`;
      }

      return books as any;
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

      const total = parseInt((countResult?.total as string) || '0');

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
      for (const book of books) {
        const authors = await getRows(`
          SELECT a.avtorid, an.lastname, an.firstname, an.middlename, an.nickname
          FROM libavtor a
          LEFT JOIN libavtorname an ON a.avtorid = an.avtorid
          WHERE a.bookid = $1
          ORDER BY a.pos
        `, [book.bookid]);
        book.authors = authors;
        const effectiveType = await this.getAvailableFiletype(book.bookid, book.filetype);
        (book as any).filetype = effectiveType || book.filetype;
  (book as any).cover_url = `/api/files/cover/${book.bookid}?fast=1`;
      }

      return {
        books: books as any,
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

      const total = parseInt((countResult?.total as string) || '0');

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
      for (const book of books) {
        const authors = await getRows(`
          SELECT a.avtorid, an.lastname, an.firstname, an.middlename, an.nickname
          FROM libavtor a
          LEFT JOIN libavtorname an ON a.avtorid = an.avtorid
          WHERE a.bookid = $1
          ORDER BY a.pos
        `, [book.bookid]);
        book.authors = authors;
        const effectiveType = await this.getAvailableFiletype(book.bookid, book.filetype);
        (book as any).filetype = effectiveType || book.filetype;
  (book as any).cover_url = `/api/files/cover/${book.bookid}?fast=1`;
      }

      return {
        books: books as any,
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

  async getBookFileInfo(bookId: number): Promise<Record<string, unknown> | null> {
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
