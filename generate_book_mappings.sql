-- Script to generate comprehensive book_zip mappings
-- This script creates mappings for all books in the database

-- Clear existing data
DELETE FROM book_zip;

-- Generate book_zip mappings for all books
-- We'll create ranges of 1000 books each for better organization
-- Format: filename, start_id, end_id, usr (0 for FB2, 1 for user format)

-- Create ranges for books 1-100000 (in chunks of 1000)
INSERT INTO book_zip (filename, start_id, end_id, usr)
SELECT 
    'f.fb2.' || LPAD((bookid / 1000)::text, 6, '0') || '-' || LPAD(((bookid / 1000 + 1) * 1000 - 1)::text, 6, '0') || '.zip' as filename,
    (bookid / 1000) * 1000 as start_id,
    ((bookid / 1000 + 1) * 1000 - 1) as end_id,
    0 as usr
FROM (
    SELECT DISTINCT (bookid / 1000) * 1000 as bookid
    FROM libbook 
    WHERE deleted = '0' AND bookid <= 100000
) ranges;

-- Create user format mappings for the same ranges
INSERT INTO book_zip (filename, start_id, end_id, usr)
SELECT 
    'f.n.' || LPAD((bookid / 1000)::text, 6, '0') || '-' || LPAD(((bookid / 1000 + 1) * 1000 - 1)::text, 6, '0') || '.zip' as filename,
    (bookid / 1000) * 1000 as start_id,
    ((bookid / 1000 + 1) * 1000 - 1) as end_id,
    1 as usr
FROM (
    SELECT DISTINCT (bookid / 1000) * 1000 as bookid
    FROM libbook 
    WHERE deleted = '0' AND bookid <= 100000
) ranges;

-- Create ranges for books 100001-500000 (in chunks of 1000)
INSERT INTO book_zip (filename, start_id, end_id, usr)
SELECT 
    'f.fb2.' || LPAD((bookid / 1000)::text, 6, '0') || '-' || LPAD(((bookid / 1000 + 1) * 1000 - 1)::text, 6, '0') || '.zip' as filename,
    (bookid / 1000) * 1000 as start_id,
    ((bookid / 1000 + 1) * 1000 - 1) as end_id,
    0 as usr
FROM (
    SELECT DISTINCT (bookid / 1000) * 1000 as bookid
    FROM libbook 
    WHERE deleted = '0' AND bookid > 100000 AND bookid <= 500000
) ranges;

-- Create user format mappings for the same ranges
INSERT INTO book_zip (filename, start_id, end_id, usr)
SELECT 
    'f.n.' || LPAD((bookid / 1000)::text, 6, '0') || '-' || LPAD(((bookid / 1000 + 1) * 1000 - 1)::text, 6, '0') || '.zip' as filename,
    (bookid / 1000) * 1000 as start_id,
    ((bookid / 1000 + 1) * 1000 - 1) as end_id,
    1 as usr
FROM (
    SELECT DISTINCT (bookid / 1000) * 1000 as bookid
    FROM libbook 
    WHERE deleted = '0' AND bookid > 100000 AND bookid <= 500000
) ranges;

-- Create ranges for books 500001-831788 (in chunks of 1000)
INSERT INTO book_zip (filename, start_id, end_id, usr)
SELECT 
    'f.fb2.' || LPAD((bookid / 1000)::text, 6, '0') || '-' || LPAD(((bookid / 1000 + 1) * 1000 - 1)::text, 6, '0') || '.zip' as filename,
    (bookid / 1000) * 1000 as start_id,
    ((bookid / 1000 + 1) * 1000 - 1) as end_id,
    0 as usr
FROM (
    SELECT DISTINCT (bookid / 1000) * 1000 as bookid
    FROM libbook 
    WHERE deleted = '0' AND bookid > 500000
) ranges;

-- Create user format mappings for the same ranges
INSERT INTO book_zip (filename, start_id, end_id, usr)
SELECT 
    'f.n.' || LPAD((bookid / 1000)::text, 6, '0') || '-' || LPAD(((bookid / 1000 + 1) * 1000 - 1)::text, 6, '0') || '.zip' as filename,
    (bookid / 1000) * 1000 as start_id,
    ((bookid / 1000 + 1) * 1000 - 1) as end_id,
    1 as usr
FROM (
    SELECT DISTINCT (bookid / 1000) * 1000 as bookid
    FROM libbook 
    WHERE deleted = '0' AND bookid > 500000
) ranges;

-- Verify the data
SELECT 'book_zip entries created:' as info;
SELECT COUNT(*) as count FROM book_zip;

SELECT 'Sample book_zip entries:' as info;
SELECT * FROM book_zip ORDER BY start_id LIMIT 10;

-- Check if our target book (584331) is now covered
SELECT 'Checking book 584331 coverage:' as info;
SELECT * FROM book_zip WHERE 584331 BETWEEN start_id AND end_id;
