import express, { Response, NextFunction } from 'express';
import { param, validationResult } from 'express-validator';
import path from 'path';
import fs from 'fs/promises';
import AdmZip from 'adm-zip';
// const sharp = require('sharp'); // Temporarily disabled for ARM64 compatibility
import { getRow } from '../database/connection';
import logger from '../utils/logger';
import { 
  createTypeSafeHandler
} from '../middleware/validation';
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

// Serve book file
router.get('/book/:bookId', [
  param('bookId').isInt({ min: 1 }).withMessage('Book ID must be a positive integer')
], validate, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response | void> => {
  const bookId = parseInt(req.params.bookId!);

    // Get book info
    const book = await getRow(`
      SELECT b.bookid, b.title, b.filetype, lf.filename,
             CONCAT(a.lastname, ' ', a.firstname) as author_name
      FROM libbook b
      JOIN libavtor av ON b.bookid = av.bookid
      JOIN libavtorname a ON av.avtorid = a.avtorid
      LEFT JOIN libfilename lf ON b.bookid = lf.bookid
      WHERE b.bookid = $1 AND b.deleted = '0'
      LIMIT 1
    `, [bookId]);

  if (!book) {
    return res.status(404).json(buildErrorResponse('Book not found'));
  }    console.log('Book info:', { bookId, title: book.title, filetype: book.filetype, filename: book.filename });

    // Get file info
    console.log('Querying book_zip table for bookId:', bookId);
    const fileInfo = await getRow(`
      SELECT filename, start_id, end_id, usr
      FROM book_zip
      WHERE $1 BETWEEN start_id AND end_id
        AND filename LIKE 'f.${book.filetype.trim()}.%'
      ORDER BY usr ASC
      LIMIT 1
    `, [bookId]);

  if (!fileInfo) {
    return res.status(404).json(buildErrorResponse('Book file not found. This book may not be available for download or the file mapping is missing.'));
  }    console.log('File info:', { filename: fileInfo.filename, start_id: fileInfo.start_id, end_id: fileInfo.end_id });

    const zipPath = path.join(process.env.BOOKS_PATH || '/application/flibusta', fileInfo.filename);
    console.log('ZIP path:', zipPath);
    
    try {
      await fs.access(zipPath);
      console.log('ZIP file exists');
    } catch (error) {
      console.error('ZIP file not found:', (error as Error).message);
      return res.status(404).json(buildErrorResponse(`Book archive not found: ${fileInfo.filename}`));
    }

    // Extract file from ZIP
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();
    console.log('ZIP entries count:', zipEntries.length);
    
    // Find the book file in the ZIP
    let bookEntry = null;
    
    if (book.filename) {
      // Try to find by exact filename first
      bookEntry = zipEntries.find(entry => {
        const entryName = entry.entryName.toLowerCase();
        const bookFileName = book.filename.toLowerCase();
        return entryName.includes(bookFileName);
      });
    }
    
    // If not found by filename, try to find by book ID and filetype
    if (!bookEntry) {
      bookEntry = zipEntries.find(entry => {
        const entryName = entry.entryName.toLowerCase();
        return entryName.includes(`${bookId}.`) && entryName.endsWith(`.${book.filetype.toLowerCase()}`);
      });
    }
    
    // If still not found, try to find any file with the correct extension
    if (!bookEntry) {
      bookEntry = zipEntries.find(entry => {
        const entryName = entry.entryName.toLowerCase();
        return entryName.endsWith(`.${book.filetype.toLowerCase()}`);
      });
    }

    if (!bookEntry) {
      console.error('Book file not found in archive. Available entries:', zipEntries.map(e => e.entryName).slice(0, 10));
      return res.status(404).json(buildErrorResponse('Book file not found in archive'));
    }

    console.log('Found book entry:', bookEntry.entryName);

    // Set appropriate headers
    const fileName = `${book.author_name} - ${book.title}.${book.filetype}`;
    res.setHeader('Content-Type', getContentType(book.filetype));
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', bookEntry.header.size);

    // Send file
    res.send(bookEntry.getData());
    
    logger.info('Book file served successfully', { 
      bookId, 
      title: book.title, 
      fileType: book.filetype, 
      fileSize: bookEntry.header.size 
    });
}));

// Serve author image
router.get('/author/:authorId', [
  param('authorId').isInt({ min: 1 }).withMessage('Author ID must be a positive integer')
], validate, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response | void> => {
  const authorId = parseInt(req.params.authorId!);

    // Get author image info
    const authorImage = await getRow(`
      SELECT file FROM libapics WHERE avtorid = $1 LIMIT 1
    `, [authorId]);

  if (!authorImage) {
    return res.status(404).json(buildErrorResponse('Author image not found'));
  }    // Check if cached image exists
    const cachePath = path.join(process.env.AUTHORS_CACHE_PATH || '/application/cache/authors', `${authorId}.jpg`);
    
    try {
      await fs.access(cachePath);
      // Serve cached image
      res.sendFile(cachePath);
    } catch (error) {
      // Try to extract from ZIP archive
      const zipPath = path.join(process.env.CACHE_PATH || '/application/cache', 'lib.a.attached.zip');
      
      try {
        await fs.access(zipPath);
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();
        
        const imageEntry = zipEntries.find(entry => 
          entry.entryName.includes(authorImage.file)
        );

        if (!imageEntry) {
          return res.status(404).json(buildErrorResponse('Author image not found in archive'));
        }

        // Process and cache the image
        const imageBuffer = imageEntry.getData();
        // Temporarily disable sharp processing for ARM64 compatibility
        // const processedImage = await sharp(imageBuffer)
        //   .resize(200, 200, { fit: 'cover' })
        //   .jpeg({ quality: 80 })
        //   .toBuffer();
        const processedImage = imageBuffer; // Serve original image for now

        // Save to cache
        await fs.writeFile(cachePath, processedImage);

        // Set headers and send
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
        res.send(processedImage);
      } catch (zipError) {
        return res.status(404).json(buildErrorResponse('Author image archive not found'));
      }
    }
}));

// Serve book cover
router.get('/cover/:bookId', [
  param('bookId').isInt({ min: 1 }).withMessage('Book ID must be a positive integer')
], validate, createTypeSafeHandler(async (req: ExtendedRequest, res: Response): Promise<Response | void> => {
  const bookId = parseInt(req.params.bookId!);

    // Get book cover info
    const bookCover = await getRow(`
      SELECT file FROM libbpics WHERE bookid = $1 LIMIT 1
    `, [bookId]);

  if (!bookCover) {
    return res.status(404).json(buildErrorResponse('Book cover not found'));
  }    // Check if cached cover exists
    const cachePath = path.join(process.env.COVERS_CACHE_PATH || '/application/cache/covers', `${bookId}.jpg`);
    
    try {
      await fs.access(cachePath);
      // Serve cached cover
      res.sendFile(cachePath);
    } catch (error) {
      // Try to extract from ZIP archive
      const zipPath = path.join(process.env.CACHE_PATH || '/application/cache', 'lib.b.attached.zip');
      
      try {
        await fs.access(zipPath);
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();
        
        const coverEntry = zipEntries.find(entry => 
          entry.entryName.includes(bookCover.file)
        );

        if (!coverEntry) {
          return res.status(404).json(buildErrorResponse('Book cover not found in archive'));
        }

        // Process and cache the cover
        const coverBuffer = coverEntry.getData();
        // Temporarily disable sharp processing for ARM64 compatibility
        // const processedCover = await sharp(coverBuffer)
        //   .resize(300, 400, { fit: 'inside' })
        //   .jpeg({ quality: 85 })
        //   .toBuffer();
        const processedCover = coverBuffer; // Serve original cover for now

        // Save to cache
        await fs.writeFile(cachePath, processedCover);

        // Set headers and send
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
        res.send(processedCover);
      } catch (zipError) {
        return res.status(404).json(buildErrorResponse('Book cover archive not found'));
      }
    }
}));

// Helper function to get content type
function getContentType(fileType: string): string {
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
