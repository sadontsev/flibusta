#!/bin/bash

# Script to create test ZIP files for books in the database
# This creates placeholder ZIP files for testing the download functionality

echo "Creating test ZIP files for database books..."

# Create the flibusta directory if it doesn't exist
mkdir -p flibusta

# Get the range of books in the database
echo "Getting book ranges from database..."
BOOK_RANGES=$(docker exec -i flibusta-postgres-1 psql -U flibusta -d flibusta -t -c "
SELECT DISTINCT 
    (bookid / 1000) * 1000 as start_range,
    ((bookid / 1000 + 1) * 1000 - 1) as end_range
FROM libbook 
WHERE deleted = '0' 
ORDER BY start_range;
")

# Create ZIP files for each range
echo "$BOOK_RANGES" | while read -r line; do
    if [ ! -z "$line" ]; then
        # Parse the range
        start_range=$(echo $line | awk '{print $1}')
        end_range=$(echo $line | awk '{print $2}')
        
        # Create FB2 format ZIP
        filename="f.fb2.$(printf "%06d" $start_range)-$(printf "%06d" $end_range).zip"
        echo "Creating: $filename"
        
        # Create a simple test file inside the ZIP
        echo "This is a test book file for range $start_range-$end_range" > test_content.txt
        
        # Create the ZIP file
        zip -j "flibusta/$filename" test_content.txt
        
        # Create user format ZIP
        filename="f.n.$(printf "%06d" $start_range)-$(printf "%06d" $end_range).zip"
        echo "Creating: $filename"
        zip -j "flibusta/$filename" test_content.txt
    fi
done

# Clean up
rm -f test_content.txt

echo "Test ZIP files created successfully!"
echo "Note: These are placeholder files for testing only."
