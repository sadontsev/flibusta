#!/bin/bash

# Script to create realistic test ZIP files for books in the database
# This creates ZIP files with properly named book files inside

echo "Creating realistic test ZIP files for database books..."

# Create the flibusta directory if it doesn't exist
mkdir -p flibusta

# Get some sample books from the database
echo "Getting sample books from database..."
SAMPLE_BOOKS=$(docker exec -i flibusta-postgres-1 psql -U flibusta -d flibusta -t -c "
SELECT bookid, title, filetype 
FROM libbook 
WHERE deleted = '0' 
ORDER BY bookid 
LIMIT 10;
")

# Create ZIP files for different ranges
echo "Creating ZIP files with sample books..."

# Create a ZIP for the 831000-831999 range
echo "Creating f.fb2.831000-831999.zip..."
rm -f flibusta/f.fb2.831000-831999.zip
echo "$SAMPLE_BOOKS" | while read -r line; do
    if [ ! -z "$line" ]; then
        bookid=$(echo $line | awk '{print $1}')
        title=$(echo $line | awk '{for(i=2;i<NF;i++) printf "%s ", $i; print $NF}')
        filetype=$(echo $line | awk '{print $NF}')
        
        if [ "$bookid" -ge 831000 ] && [ "$bookid" -le 831999 ]; then
            echo "Adding book $bookid to ZIP..."
            echo "This is a test book file for: $title" > "${bookid}.${filetype}"
            zip -j "flibusta/f.fb2.831000-831999.zip" "${bookid}.${filetype}"
            rm -f "${bookid}.${filetype}"
        fi
    fi
done

# Create user format ZIP
echo "Creating f.n.831000-831999.zip..."
rm -f flibusta/f.n.831000-831999.zip
echo "$SAMPLE_BOOKS" | while read -r line; do
    if [ ! -z "$line" ]; then
        bookid=$(echo $line | awk '{print $1}')
        title=$(echo $line | awk '{for(i=2;i<NF;i++) printf "%s ", $i; print $NF}')
        filetype=$(echo $line | awk '{print $NF}')
        
        if [ "$bookid" -ge 831000 ] && [ "$bookid" -le 831999 ]; then
            echo "Adding book $bookid to user format ZIP..."
            echo "This is a test user format book file for: $title" > "${bookid}.${filetype}"
            zip -j "flibusta/f.n.831000-831999.zip" "${bookid}.${filetype}"
            rm -f "${bookid}.${filetype}"
        fi
    fi
done

echo "Realistic test ZIP files created successfully!"
echo "Note: These contain test book files with proper names for testing."
