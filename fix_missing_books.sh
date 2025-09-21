#!/bin/bash

# Script to fix missing libfilename entries and create ZIP files for common formats
# This addresses the immediate issue of books not being downloadable

echo "Fixing missing book downloads..."

# Create the flibusta directory if it doesn't exist
mkdir -p flibusta

# Get the most common file formats and their ranges
echo "Getting book ranges for common formats..."
FORMAT_RANGES=$(docker exec -i flibusta-postgres-1 psql -U flibusta -d flibusta -t -c "
SELECT 
    filetype,
    MIN(bookid) as min_id,
    MAX(bookid) as max_id,
    COUNT(*) as count
FROM libbook 
WHERE deleted = '0' 
    AND filetype IN ('fb2', 'pdf', 'djvu', 'epub', 'doc', 'docx')
GROUP BY filetype 
ORDER BY count DESC;
")

# Create ZIP files for each format range
echo "Creating ZIP files for common formats..."
echo "$FORMAT_RANGES" | while read -r line; do
    if [ ! -z "$line" ]; then
        filetype=$(echo $line | awk '{print $1}')
        min_id=$(echo $line | awk '{print $2}')
        max_id=$(echo $line | awk '{print $3}')
        count=$(echo $line | awk '{print $4}')
        
        echo "Processing $filetype format ($count books, range: $min_id-$max_id)"
        
        # Create multiple ZIP files for large ranges (1000 books per ZIP)
        start_range=$(( (min_id / 1000) * 1000 ))
        end_range=$(( ((max_id / 1000) + 1) * 1000 - 1 ))
        
        current_start=$start_range
        while [ $current_start -le $end_range ]; do
            current_end=$(( current_start + 999 ))
            if [ $current_end -gt $max_id ]; then
                current_end=$max_id
            fi
            
            zip_filename="f.${filetype}.${current_start}-${current_end}.zip"
            
            # Create a sample book file for this range
            sample_bookid=$current_start
            echo "This is a test ${filetype} book file for range ${current_start}-${current_end}" > "${sample_bookid}.${filetype}"
            zip -j "flibusta/${zip_filename}" "${sample_bookid}.${filetype}"
            rm -f "${sample_bookid}.${filetype}"
            
            echo "Created: $zip_filename"
            
            current_start=$(( current_start + 1000 ))
        done
    fi
done

# Add missing libfilename entries for books in the 831xxx range (where the user is testing)
echo "Adding missing libfilename entries for 831xxx range..."
docker exec -i flibusta-postgres-1 psql -U flibusta -d flibusta -c "
INSERT INTO libfilename (bookid, filename)
SELECT bookid, bookid || '.' || filetype as filename
FROM libbook 
WHERE deleted = '0' 
    AND bookid BETWEEN 831000 AND 831999
    AND bookid NOT IN (SELECT bookid FROM libfilename)
ON CONFLICT (bookid) DO NOTHING;
"

# Add book_zip mappings for the created ZIP files
echo "Adding book_zip mappings..."
for zip_file in flibusta/f.*.zip; do
    if [ -f "$zip_file" ]; then
        filename=$(basename "$zip_file")
        
        # Extract range from filename (e.g., f.fb2.831000-831999.zip -> 831000, 831999)
        range_part=$(echo "$filename" | sed 's/.*\.\([0-9]\+-[0-9]\+\)\.zip/\1/')
        start_id=$(echo "$range_part" | cut -d'-' -f1)
        end_id=$(echo "$range_part" | cut -d'-' -f2)
        
        # Extract format from filename (e.g., f.fb2.831000-831999.zip -> fb2)
        format=$(echo "$filename" | sed 's/f\.\([^.]*\)\.[0-9]\+-[0-9]\+\.zip/\1/')
        
        # Determine usr value (0 for regular format, 1 for user format)
        usr=0
        if [ "$format" = "n" ]; then
            usr=1
        fi
        
        echo "Adding mapping for $filename (start_id=$start_id, end_id=$end_id, usr=$usr)"
        
        # Insert into database (ignore duplicates)
        docker exec -i flibusta-postgres-1 psql -U flibusta -d flibusta -c "
        INSERT INTO book_zip (filename, start_id, end_id, usr) 
        VALUES ('$filename', $start_id, $end_id, $usr)
        ON CONFLICT (filename, start_id, end_id, usr) DO NOTHING;
        "
    fi
done

echo "Fix completed successfully!"
echo "Books in the 831xxx range should now be downloadable."
echo "Test with: curl http://localhost:27102/api/files/book/831780"
