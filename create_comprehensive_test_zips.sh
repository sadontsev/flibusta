#!/bin/bash

# Script to create comprehensive test ZIP files for all books in the database
# This creates ZIP files with properly named book files for all formats

echo "Creating comprehensive test ZIP files for all database books..."

# Create the flibusta directory if it doesn't exist
mkdir -p flibusta

# Get all books from the database with their filetypes
echo "Getting all books from database..."
ALL_BOOKS=$(docker exec -i flibusta-postgres-1 psql -U flibusta -d flibusta -t -c "
SELECT bookid, title, filetype 
FROM libbook 
WHERE deleted = '0' 
ORDER BY bookid;
")

# Initialize arrays for different file types
declare -A zip_files
declare -A processed_books

# Process each book
echo "Processing books and creating ZIP files..."
echo "$ALL_BOOKS" | while read -r line; do
    if [ ! -z "$line" ]; then
        bookid=$(echo $line | awk '{print $1}')
        title=$(echo $line | awk '{for(i=2;i<NF;i++) printf "%s ", $i; print $NF}')
        filetype=$(echo $line | awk '{print $NF}' | tr -d ' ')
        
        if [ ! -z "$bookid" ] && [ ! -z "$filetype" ]; then
            # Calculate the range for this book
            start_range=$(( (bookid / 1000) * 1000 ))
            end_range=$(( ((bookid / 1000 + 1) * 1000) - 1 ))
            
            # Create filename for this range and format
            zip_filename="f.${filetype}.${start_range}-${end_range}.zip"
            
            # Create test book file
            echo "This is a test ${filetype} book file for book ${bookid}: ${title}" > "${bookid}.${filetype}"
            
            # Add to ZIP file
            zip -j "flibusta/${zip_filename}" "${bookid}.${filetype}"
            
            # Clean up
            rm -f "${bookid}.${filetype}"
            
            # Track processed books
            processed_books["${bookid}"]=1
            
            echo "Added book ${bookid} (${filetype}) to ${zip_filename}"
        fi
    fi
done

echo "Comprehensive test ZIP files created successfully!"
echo "Note: These contain test book files for all formats and books in the database."

# Create database mappings for all ZIP files
echo "Creating database mappings..."
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
        
        echo "Creating mapping for $filename (start_id=$start_id, end_id=$end_id, usr=$usr)"
        
        # Insert into database (ignore duplicates)
        docker exec -i flibusta-postgres-1 psql -U flibusta -d flibusta -c "
        INSERT INTO book_zip (filename, start_id, end_id, usr) 
        VALUES ('$filename', $start_id, $end_id, $usr)
        ON CONFLICT (filename, start_id, end_id, usr) DO NOTHING;
        "
    fi
done

# Create libfilename entries for all books
echo "Creating libfilename entries..."
echo "$ALL_BOOKS" | while read -r line; do
    if [ ! -z "$line" ]; then
        bookid=$(echo $line | awk '{print $1}')
        filetype=$(echo $line | awk '{print $NF}' | tr -d ' ')
        
        if [ ! -z "$bookid" ] && [ ! -z "$filetype" ]; then
            filename="${bookid}.${filetype}"
            
            # Insert into database (ignore duplicates)
            docker exec -i flibusta-postgres-1 psql -U flibusta -d flibusta -c "
            INSERT INTO libfilename (bookid, filename) 
            VALUES ($bookid, '$filename')
            ON CONFLICT (bookid) DO NOTHING;
            "
        fi
    fi
done

echo "Database mappings created successfully!"
echo "All books should now be downloadable for testing."
