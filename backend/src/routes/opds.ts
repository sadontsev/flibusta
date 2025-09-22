import express, { Response, NextFunction } from 'express';
import { query, param, validationResult } from 'express-validator';
import { getRows } from '../database/connection';
import xml2js from 'xml2js';
import { buildErrorResponse } from '../types/api';
import { ExtendedRequest } from '../types';

const router = express.Router();

// Validation middleware
const validate = (req: ExtendedRequest, res: Response, next: NextFunction): Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(buildErrorResponse('Validation failed'));
  }
  next();
};

// OPDS main catalog
router.get('/', async (req, res, next) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const now = new Date().toISOString();

    const opdsFeed = {
      feed: {
        $: {
          xmlns: 'http://www.w3.org/2005/Atom',
          'xmlns:dc': 'http://purl.org/dc/terms/',
          'xmlns:os': 'http://a9.com/-/spec/opensearch/1.1/',
          'xmlns:opds': 'https://specs.opds.io/opds-1.2'
        },
        id: 'tag:root',
        title: 'Домашняя библиотека',
        updated: now,
        icon: `${baseUrl}/favicon.svg`,
        link: [
          {
            $: {
              href: `${baseUrl}/opds-opensearch.xml`,
              rel: 'search',
              type: 'application/opensearchdescription+xml'
            }
          },
          {
            $: {
              href: `${baseUrl}/opds/search?q={searchTerms}`,
              rel: 'search',
              type: 'application/atom+xml'
            }
          },
          {
            $: {
              href: `${baseUrl}/opds/`,
              rel: 'start',
              type: 'application/atom+xml;profile=opds-catalog'
            }
          },
          {
            $: {
              href: `${baseUrl}/opds/`,
              rel: 'self',
              type: 'application/atom+xml;profile=opds-catalog'
            }
          }
        ],
        entry: [
          {
            updated: now,
            id: 'tag:root:new',
            title: 'Новинки',
            content: {
              $: { type: 'text' },
              _: 'Последние поступления в библиотеку'
            },
            link: [
              {
                $: {
                  href: `${baseUrl}/opds/list/`,
                  rel: 'http://opds-spec.org/sort/new',
                  type: 'application/atom+xml;profile=opds-catalog'
                }
              },
              {
                $: {
                  href: `${baseUrl}/opds/list/`,
                  type: 'application/atom+xml;profile=opds-catalog'
                }
              }
            ]
          },
          {
            updated: now,
            id: 'tag:root:shelf',
            title: 'Книжные полки',
            content: {
              $: { type: 'text' },
              _: 'Избранное'
            },
            link: {
              $: {
                href: `${baseUrl}/opds/favs/`,
                type: 'application/atom+xml;profile=opds-catalog'
              }
            }
          },
          {
            updated: now,
            id: 'tag:root:genre',
            title: 'По жанрам',
            content: {
              $: { type: 'text' },
              _: 'Поиск книг по жанрам'
            },
            link: {
              $: {
                href: `${baseUrl}/opds/genres`,
                type: 'application/atom+xml;profile=opds-catalog'
              }
            }
          },
          {
            updated: now,
            id: 'tag:root:authors',
            title: 'По авторам',
            content: {
              $: { type: 'text' },
              _: 'Поиск книг по авторам'
            },
            link: {
              $: {
                href: `${baseUrl}/opds/authorsindex`,
                type: 'application/atom+xml;profile=opds-catalog'
              }
            }
          }
        ]
      }
    };

    const builder = new xml2js.Builder({
      rootName: 'feed',
      headless: true,
      renderOpts: { pretty: true, indent: '  ', newline: '\n' }
    });

    const xml = builder.buildObject(opdsFeed);
    
    res.setHeader('Content-Type', 'application/atom+xml;profile=opds-catalog;charset=utf-8');
    res.send(xml);
  } catch (error) {
    next(error);
  }
});

// OPDS search
router.get('/search', [
  query('q').optional().isString().trim(),
  query('searchType').optional().isIn(['books', 'authors']),
  query('pageNumber').optional().isInt({ min: 0 })
], validate, async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || '');
    const searchType = String(req.query.searchType || 'books');
    const pageNumber = parseInt(String(req.query.pageNumber || '0'));
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const now = new Date().toISOString();
    const limit = parseInt(process.env.OPDS_FEED_COUNT || '100') || 100;
    const offset = pageNumber * limit;

    const entries = [];

    if (searchType === 'books' && q) {
      // Search books
      const books = await getRows(`
        SELECT b.bookid, b.title, b.year, b.lang, b.filetype, b.filesize, b.time
        FROM libbook b
        WHERE b.title ILIKE $1 AND b.deleted = '0'
        ORDER BY b.title
        LIMIT $2 OFFSET $3
      `, [`%${q}%`, limit, offset]);

      for (const book of books) {
        // Get authors
        const authors = await getRows(`
          SELECT a.avtorid, a.lastname, a.firstname, a.middlename, a.nickname
          FROM libavtor a
          LEFT JOIN libavtorname USING(avtorid)
          WHERE a.bookid = $1
          ORDER BY a.pos
        `, [book.bookid]);

        // Get genres
        const genres = await getRows(`
          SELECT g.genrecode, g.genredesc
          FROM libgenre
          JOIN libgenrelist g USING(genreid)
          WHERE bookid = $1
          ORDER BY g.genredesc
        `, [book.bookid]);

        const authorNames = authors.map(a => `${a.lastname} ${a.firstname}`).join(', ');
        
        entries.push({
          updated: now,
          id: `tag:book:${book.bookid}`,
          title: book.title,
          content: {
            $: { type: 'text' },
            _: `Автор: ${authorNames}${book.year ? `, Год: ${book.year}` : ''}`
          },
          author: authors.map(a => ({
            name: `${a.lastname} ${a.firstname}`
          })),
          category: genres.map(g => ({
            $: {
              term: `/subject/${g.genrecode}`,
              label: g.genredesc
            }
          })),
          link: [
            {
              $: {
                href: `${baseUrl}/api/files/book/${book.bookid}`,
                rel: 'http://opds-spec.org/acquisition',
                type: getOpdsContentType(book.filetype)
              }
            },
            {
              $: {
                href: `${baseUrl}/api/books/${book.bookid}`,
                rel: 'alternate',
                type: 'application/json'
              }
            }
          ],
          'dc:language': book.lang,
          ...(book.year && { 'dc:issued': book.year })
        });
      }
    } else if (searchType === 'authors' && q) {
      // Search authors
      const authors = await getRows(`
        SELECT a.avtorid, a.lastname, a.firstname, a.middlename, a.nickname
        FROM libavtorname a
        WHERE (a.lastname ILIKE $1 OR a.firstname ILIKE $1)
        ORDER BY a.lastname, a.firstname
        LIMIT $2 OFFSET $3
      `, [`%${q}%`, limit, offset]);

      for (const author of authors) {
        entries.push({
          updated: now,
          id: `tag:author:${author.avtorid}`,
          title: `${author.lastname} ${author.firstname}`,
          content: {
            $: { type: 'text' },
            _: `Автор: ${author.lastname} ${author.firstname}`
          },
          link: {
            $: {
              href: `${baseUrl}/opds/author/${author.avtorid}`,
              rel: 'subsection',
              type: 'application/atom+xml;profile=opds-catalog'
            }
          }
        });
      }
    }

    const opdsFeed = {
      feed: {
        $: {
          xmlns: 'http://www.w3.org/2005/Atom',
          'xmlns:dc': 'http://purl.org/dc/terms/',
          'xmlns:os': 'http://a9.com/-/spec/opensearch/1.1/',
          'xmlns:opds': 'https://specs.opds.io/opds-1.2'
        },
        id: `tag:search:${searchType}`,
        title: `Поиск: ${q}`,
        updated: now,
        link: [
          {
            $: {
              href: `${baseUrl}/opds/search?q=${q}&searchType=${searchType}`,
              rel: 'self',
              type: 'application/atom+xml;profile=opds-catalog'
            }
          }
        ],
        entry: entries
      }
    };

    const builder = new xml2js.Builder({
      rootName: 'feed',
      headless: true,
      renderOpts: { pretty: true, indent: '  ', newline: '\n' }
    });

    const xml = builder.buildObject(opdsFeed);
    
    res.setHeader('Content-Type', 'application/atom+xml;profile=opds-catalog;charset=utf-8');
    res.send(xml);
  } catch (error) {
    next(error);
  }
});

// OPDS genres
router.get('/genres', async (req, res, next) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const now = new Date().toISOString();

    const genres = await getRows(`
      SELECT DISTINCT genremeta as category
      FROM libgenrelist
      ORDER BY genremeta
    `);

    const entries = genres.map(genre => ({
      updated: now,
      id: `tag:genre:${genre.category}`,
      title: genre.category,
      content: {
        $: { type: 'text' },
        _: `Жанр: ${genre.category}`
      },
      link: {
        $: {
          href: `${baseUrl}/opds/genre/${genre.category}`,
          rel: 'subsection',
          type: 'application/atom+xml;profile=opds-catalog'
        }
      }
    }));

    const opdsFeed = {
      feed: {
        $: {
          xmlns: 'http://www.w3.org/2005/Atom',
          'xmlns:dc': 'http://purl.org/dc/terms/',
          'xmlns:os': 'http://a9.com/-/spec/opensearch/1.1/',
          'xmlns:opds': 'https://specs.opds.io/opds-1.2'
        },
        id: 'tag:genres',
        title: 'Жанры',
        updated: now,
        link: {
          $: {
            href: `${baseUrl}/opds/genres`,
            rel: 'self',
            type: 'application/atom+xml;profile=opds-catalog'
          }
        },
        entry: entries
      }
    };

    const builder = new xml2js.Builder({
      rootName: 'feed',
      headless: true,
      renderOpts: { pretty: true, indent: '  ', newline: '\n' }
    });

    const xml = builder.buildObject(opdsFeed);
    
    res.setHeader('Content-Type', 'application/atom+xml;profile=opds-catalog;charset=utf-8');
    res.send(xml);
  } catch (error) {
    next(error);
  }
});

// OPDS genre books
router.get('/genre/:category', [
  param('category').isString().trim().notEmpty()
], validate, async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  try {
    const category = req.params.category;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const now = new Date().toISOString();
    const limit = parseInt(process.env.OPDS_FEED_COUNT || '100') || 100;

    const books = await getRows(`
      SELECT DISTINCT b.bookid, b.title, b.year, b.lang, b.filetype, b.filesize, b.time
      FROM libbook b
      JOIN libgenre g ON b.bookid = g.bookid
      JOIN libgenrelist gl ON g.genreid = gl.genreid
      WHERE gl.genremeta = $1 AND b.deleted = '0'
      ORDER BY b.title
      LIMIT $2
    `, [category, limit]);

    const entries = [];

    for (const book of books) {
      // Get authors
      const authors = await getRows(`
        SELECT a.avtorid, a.lastname, a.firstname, a.middlename, a.nickname
        FROM libavtor a
        LEFT JOIN libavtorname USING(avtorid)
        WHERE a.bookid = $1
        ORDER BY a.pos
      `, [book.bookid]);

      const authorNames = authors.map(a => `${a.lastname} ${a.firstname}`).join(', ');
      
      entries.push({
        updated: now,
        id: `tag:book:${book.bookid}`,
        title: book.title,
        content: {
          $: { type: 'text' },
          _: `Автор: ${authorNames}${book.year ? `, Год: ${book.year}` : ''}`
        },
        author: authors.map(a => ({
          name: `${a.lastname} ${a.firstname}`
        })),
        link: [
          {
            $: {
              href: `${baseUrl}/api/files/book/${book.bookid}`,
              rel: 'http://opds-spec.org/acquisition',
              type: getOpdsContentType(book.filetype)
            }
          },
          {
            $: {
              href: `${baseUrl}/api/books/${book.bookid}`,
              rel: 'alternate',
              type: 'application/json'
            }
          }
        ],
        'dc:language': book.lang,
        ...(book.year && { 'dc:issued': book.year })
      });
    }

    const opdsFeed = {
      feed: {
        $: {
          xmlns: 'http://www.w3.org/2005/Atom',
          'xmlns:dc': 'http://purl.org/dc/terms/',
          'xmlns:os': 'http://a9.com/-/spec/opensearch/1.1/',
          'xmlns:opds': 'https://specs.opds.io/opds-1.2'
        },
        id: `tag:genre:${category}`,
        title: `Жанр: ${category}`,
        updated: now,
        link: {
          $: {
            href: `${baseUrl}/opds/genre/${category}`,
            rel: 'self',
            type: 'application/atom+xml;profile=opds-catalog'
          }
        },
        entry: entries
      }
    };

    const builder = new xml2js.Builder({
      rootName: 'feed',
      headless: true,
      renderOpts: { pretty: true, indent: '  ', newline: '\n' }
    });

    const xml = builder.buildObject(opdsFeed);
    
    res.setHeader('Content-Type', 'application/atom+xml;profile=opds-catalog;charset=utf-8');
    res.send(xml);
  } catch (error) {
    next(error);
  }
});

// Helper function to get OPDS content type
function getOpdsContentType(fileType: string): string {
  const contentTypes: Record<string, string> = {
    'fb2': 'application/x-fictionbook+xml',
    'epub': 'application/epub+zip',
    'pdf': 'application/pdf',
    'mobi': 'application/x-mobipocket-ebook',
    'txt': 'text/plain',
    'html': 'text/html',
    'htm': 'text/html',
    'rtf': 'application/rtf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'djvu': 'image/vnd.djvu',
    'djv': 'image/vnd.djvu'
  };

  return contentTypes[fileType.toLowerCase()] || 'application/octet-stream';
}

export default router;
