const { getRow, getRows } = require('../database/connection');
const logger = require('../utils/logger');

class AuthorService {
  constructor() {
    this.authorsPerPage = parseInt(process.env.AUTHORS_PER_PAGE) || 50;
  }

  async getAuthorById(authorId) {
    try {
      const author = await getRow(`
        SELECT a.*, ap.file as photo_file
        FROM libavtorname a
        LEFT JOIN libapics ap ON a.avtorid = ap.avtorid
        WHERE a.avtorid = $1
      `, [authorId]);

      if (!author) {
        return null;
      }

      // Get author annotation
      const annotation = await getRow(`
        SELECT title, body
        FROM libaannotations
        WHERE avtorid = $1
        LIMIT 1
      `, [authorId]);

      // Get book count
      const bookCount = await getRow(`
        SELECT COUNT(*) as count
        FROM libavtor a
        JOIN libbook b ON a.bookid = b.bookid
        WHERE a.avtorid = $1 AND b.deleted = '0'
      `, [authorId]);

      return {
        ...author,
        annotation,
        bookCount: parseInt(bookCount.count)
      };
    } catch (error) {
      logger.error('Error getting author by ID', { authorId, error: error.message });
      throw error;
    }
  }

  async searchAuthors(searchParams) {
    try {
      const {
        query = '',
        letter = '',
        sort = 'name',
        page = 0,
        limit = this.authorsPerPage
      } = searchParams;

      let conditions = ['1=1'];
      let params = [];
      let paramIndex = 1;

      // Enhanced search by name with better partial matching
      if (query) {
        conditions.push(`(
          a.lastname ILIKE $${paramIndex} OR 
          a.firstname ILIKE $${paramIndex} OR 
          a.middlename ILIKE $${paramIndex} OR
          a.nickname ILIKE $${paramIndex} OR
          CONCAT(a.lastname, ' ', a.firstname) ILIKE $${paramIndex} OR
          CONCAT(a.firstname, ' ', a.lastname) ILIKE $${paramIndex} OR
          CONCAT(a.lastname, ' ', a.firstname, ' ', a.middlename) ILIKE $${paramIndex}
        )`);
        params.push(`%${query}%`);
        paramIndex++;
      }

      // Filter by first letter of lastname
      if (letter) {
        conditions.push(`a.lastname ILIKE $${paramIndex}`);
        params.push(`${letter}%`);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');
      const offset = page * limit;

      // Build ORDER BY clause based on sort parameter
      let orderBy = 'a.lastname ASC, a.firstname ASC'; // default
      let orderByParams = [];
      
      switch (sort) {
        case 'relevance':
          // For relevance, prioritize exact matches and popular authors
          if (query) {
            orderBy = 'relevance_score ASC, book_count DESC, a.lastname ASC';
            orderByParams = [
              query,                    // exact match
              query + '%',              // starts with
              '%' + query + '%'         // contains
            ];
            paramIndex += 3;
          } else {
            orderBy = 'book_count DESC, a.lastname ASC';
          }
          break;
        case 'name':
          orderBy = 'a.lastname ASC, a.firstname ASC';
          break;
        case 'name_desc':
          orderBy = 'a.lastname DESC, a.firstname DESC';
          break;
        case 'firstname':
          orderBy = 'a.firstname ASC, a.lastname ASC';
          break;
        case 'firstname_desc':
          orderBy = 'a.firstname DESC, a.lastname DESC';
          break;
        case 'books':
          orderBy = 'book_count DESC, a.lastname ASC';
          break;
        case 'books_asc':
          orderBy = 'book_count ASC, a.lastname ASC';
          break;
        case 'recent':
          orderBy = 'a.avtorid DESC';
          break;
        default:
          orderBy = 'a.lastname ASC, a.firstname ASC';
          break;
      }

      // Get total count
      const countResult = await getRow(`
        SELECT COUNT(*) as total
        FROM libavtorname a
        WHERE ${whereClause}
      `, params);

      const total = parseInt(countResult.total);

      // Combine params with orderByParams for relevance sorting
      const finalParams = [...params, ...orderByParams, limit, offset];

      // Get authors with book count in a single query for better performance
      const authors = await getRows(`
        SELECT a.avtorid, a.lastname, a.firstname, a.middlename, a.nickname,
               a.gender, a.email, a.homepage, ap.file as photo_file,
               COALESCE(book_counts.count, 0) as book_count
               ${sort === 'relevance' && query ? `,
               CASE 
                 WHEN a.lastname ILIKE $${paramIndex} THEN 1
                 WHEN a.firstname ILIKE $${paramIndex} THEN 2
                 WHEN a.lastname ILIKE $${paramIndex + 1} THEN 3
                 WHEN a.firstname ILIKE $${paramIndex + 1} THEN 4
                 WHEN a.lastname ILIKE $${paramIndex + 2} THEN 5
                 WHEN a.firstname ILIKE $${paramIndex + 2} THEN 6
                 ELSE 7
               END as relevance_score` : ''}
        FROM libavtorname a
        LEFT JOIN libapics ap ON a.avtorid = ap.avtorid
        LEFT JOIN (
          SELECT av.avtorid, COUNT(b.bookid) as count
          FROM libavtor av
          JOIN libbook b ON av.bookid = b.bookid
          WHERE b.deleted = '0'
          GROUP BY av.avtorid
        ) book_counts ON a.avtorid = book_counts.avtorid
        WHERE ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${finalParams.length - 1} OFFSET $${finalParams.length}
      `, finalParams);

      return {
        authors,
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
      logger.error('Error searching authors', { searchParams, error: error.message });
      throw error;
    }
  }

  async getAuthorsByLetter(letter, page = 0, limit = this.authorsPerPage) {
    try {
      const offset = page * limit;

      // Get total count
      const countResult = await getRow(`
        SELECT COUNT(*) as total
        FROM libavtorname
        WHERE lastname ILIKE $1
      `, [`${letter}%`]);

      const total = parseInt(countResult.total);

      // Get authors
      const authors = await getRows(`
        SELECT a.avtorid, a.lastname, a.firstname, a.middlename, a.nickname,
               a.gender, a.email, a.homepage, ap.file as photo_file
        FROM libavtorname a
        LEFT JOIN libapics ap ON a.avtorid = ap.avtorid
        WHERE a.lastname ILIKE $1
        ORDER BY a.lastname, a.firstname
        LIMIT $2 OFFSET $3
      `, [`${letter}%`, limit, offset]);

      // Get book count for each author
      for (let author of authors) {
        const bookCount = await getRow(`
          SELECT COUNT(*) as count
          FROM libavtor a
          JOIN libbook b ON a.bookid = b.bookid
          WHERE a.avtorid = $1 AND b.deleted = '0'
        `, [author.avtorid]);
        
        author.bookCount = parseInt(bookCount.count);
      }

      return {
        authors,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting authors by letter', { letter, error: error.message });
      throw error;
    }
  }

  async getAuthorStatistics() {
    try {
      const stats = await getRow(`
        SELECT 
          COUNT(*) as total_authors,
          COUNT(DISTINCT gender) as genders,
          COUNT(DISTINCT SUBSTRING(lastname, 1, 1)) as first_letters
        FROM libavtorname
      `);

      return stats;
    } catch (error) {
      logger.error('Error getting author statistics', { error: error.message });
      throw error;
    }
  }

  async getPopularAuthors(limit = 20) {
    try {
      const authors = await getRows(`
        SELECT a.avtorid, a.lastname, a.firstname, a.middlename, a.nickname,
               COUNT(b.bookid) as book_count
        FROM libavtorname a
        JOIN libavtor av ON a.avtorid = av.avtorid
        JOIN libbook b ON av.bookid = b.bookid
        WHERE b.deleted = '0'
        GROUP BY a.avtorid, a.lastname, a.firstname, a.middlename, a.nickname
        ORDER BY book_count DESC
        LIMIT $1
      `, [limit]);

      return authors;
    } catch (error) {
      logger.error('Error getting popular authors', { error: error.message });
      throw error;
    }
  }

  async getAuthorAliases(authorId) {
    try {
      const aliases = await getRows(`
        SELECT a.aliaseid, a.badid, a.goodid,
               bad.lastname as bad_lastname, bad.firstname as bad_firstname,
               good.lastname as good_lastname, good.firstname as good_firstname
        FROM libavtoraliase a
        JOIN libavtorname bad ON a.badid = bad.avtorid
        JOIN libavtorname good ON a.goodid = good.avtorid
        WHERE a.goodid = $1 OR a.badid = $1
      `, [authorId]);

      return aliases;
    } catch (error) {
      logger.error('Error getting author aliases', { authorId, error: error.message });
      throw error;
    }
  }
}

module.exports = new AuthorService();
