-- Script to populate book_zip and libfilename tables
-- This script creates mappings for the available ZIP files

-- Clear existing data
DELETE FROM book_zip;
DELETE FROM libfilename;

-- Insert book_zip mappings for available ZIP files
-- Format: filename, start_id, end_id, usr (0 for FB2, 1 for user format)

-- Recent books (831716-831788 range)
INSERT INTO book_zip (filename, start_id, end_id, usr) VALUES 
('f.fb2.831716-831788.zip', 831716, 831788, 0),
('f.n.831716-831788.zip', 831716, 831788, 1);

-- Earlier books (831656-831715 range)
INSERT INTO book_zip (filename, start_id, end_id, usr) VALUES 
('f.fb2.831656-831715.zip', 831656, 831715, 0),
('f.n.831656-831715.zip', 831656, 831715, 1);

-- Earlier books (831526-831655 range)
INSERT INTO book_zip (filename, start_id, end_id, usr) VALUES 
('f.fb2.831526-831655.zip', 831526, 831655, 0),
('f.n.831526-831655.zip', 831526, 831655, 1);

-- Earlier books (831463-831525 range)
INSERT INTO book_zip (filename, start_id, end_id, usr) VALUES 
('f.fb2.831463-831525.zip', 831463, 831525, 0),
('f.n.831463-831525.zip', 831463, 831525, 1);

-- Insert some sample filename mappings for books that exist in the ZIP files
-- These are example mappings - you may need to adjust based on actual ZIP contents

-- For the 831716-831788 range (FB2 files)
INSERT INTO libfilename (bookid, filename) VALUES 
(831777, '831777.fb2'),
(831776, '831776.fb2'),
(831775, '831775.fb2'),
(831774, '831774.fb2'),
(831773, '831773.fb2'),
(831772, '831772.fb2'),
(831771, '831771.fb2'),
(831770, '831770.fb2');

-- Note: You can add more mappings by checking the actual contents of each ZIP file
-- and inserting the corresponding bookid and filename pairs

-- Verify the data
SELECT 'book_zip entries:' as info;
SELECT COUNT(*) as count FROM book_zip;

SELECT 'libfilename entries:' as info;
SELECT COUNT(*) as count FROM libfilename;

SELECT 'Sample book_zip entries:' as info;
SELECT * FROM book_zip ORDER BY start_id LIMIT 5;

SELECT 'Sample libfilename entries:' as info;
SELECT * FROM libfilename ORDER BY bookid LIMIT 5;
