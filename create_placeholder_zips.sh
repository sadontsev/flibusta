#!/bin/bash

# Script to create placeholder ZIP files for testing
# This creates empty ZIP files with the correct names for the book_zip mappings

echo "Creating placeholder ZIP files for testing..."

# Create the flibusta directory if it doesn't exist
mkdir -p flibusta

# Get the list of ZIP filenames from the database
echo "Getting ZIP filenames from database..."
docker exec -i flibusta-postgres-1 psql -U flibusta -d flibusta -t -c "SELECT DISTINCT filename FROM book_zip ORDER BY filename;" | while read filename; do
    if [ ! -z "$filename" ]; then
        echo "Creating placeholder: $filename"
        # Create an empty ZIP file
        zip -j "flibusta/$filename" /dev/null
    fi
done

echo "Placeholder ZIP files created successfully!"
echo "Note: These are empty ZIP files for testing only."
echo "In production, you would need the actual book ZIP files."
