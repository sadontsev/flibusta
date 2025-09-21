#!/bin/bash

# Comprehensive Flibusta Setup Script
# This script integrates all existing tools to set up the complete system

set -e

echo "🚀 Flibusta Complete Setup Script"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
print_status "Checking Docker status..."
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi
print_success "Docker is running"

# Step 1: Download SQL files
print_status "Step 1: Downloading SQL files..."
if [ -f "getsql.sh" ]; then
    chmod +x getsql.sh
    ./getsql.sh
    print_success "SQL files downloaded"
else
    print_error "getsql.sh not found"
    exit 1
fi

# Step 2: Download cover files
print_status "Step 2: Downloading cover files..."
if [ -f "getcovers.sh" ]; then
    chmod +x getcovers.sh
    ./getcovers.sh
    print_success "Cover files downloaded"
else
    print_error "getcovers.sh not found"
    exit 1
fi

# Step 3: Create required directories
print_status "Step 3: Creating required directories..."
mkdir -p flibusta
mkdir -p cache/authors
mkdir -p cache/covers
print_success "Directories created"

# Step 4: Start Docker services
print_status "Step 4: Starting Docker services..."
docker-compose up -d postgres
print_success "PostgreSQL started"

# Wait for PostgreSQL to be ready
print_status "Waiting for PostgreSQL to be ready..."
sleep 10

# Step 5: Import SQL data
print_status "Step 5: Importing SQL data..."
if [ -f "backend/tools/app_import_sql.sh" ]; then
    # Run the import script inside the backend container
    docker-compose up -d backend
    sleep 5
    
    # Execute the import script
    docker exec -it flibusta-backend-1 /app/tools/app_import_sql.sh
    print_success "SQL data imported"
else
    print_error "app_import_sql.sh not found"
    exit 1
fi

# Step 6: Download daily book files
print_status "Step 6: Downloading daily book files..."
if [ -f "update_daily.sh" ]; then
    # Modify the script to use the correct path
    sed 's|/library/flibusta/Flibusta.Net|./flibusta|g' update_daily.sh > update_daily_local.sh
    chmod +x update_daily_local.sh
    ./update_daily_local.sh
    print_success "Daily book files downloaded"
else
    print_warning "update_daily.sh not found - skipping daily book download"
fi

# Step 7: Update book mappings
print_status "Step 7: Updating book mappings..."
if [ -f "generate_book_mappings.sql" ]; then
    docker exec -i flibusta-postgres-1 psql -U flibusta -d flibusta < generate_book_mappings.sql
    print_success "Book mappings updated"
else
    print_warning "generate_book_mappings.sql not found - using existing mappings"
fi

# Step 8: Restart services
print_status "Step 8: Restarting services..."
docker-compose restart backend
docker-compose up -d nginx
print_success "Services restarted"

# Step 9: Verify setup
print_status "Step 9: Verifying setup..."
sleep 5

# Check if the API is responding
if curl -s http://localhost:27102/health > /dev/null; then
    print_success "API is responding"
else
    print_warning "API is not responding yet - it may take a moment to start"
fi

# Check book count
BOOK_COUNT=$(docker exec -i flibusta-postgres-1 psql -U flibusta -d flibusta -t -c "SELECT COUNT(*) FROM libbook WHERE deleted = '0';" | tr -d ' ')
print_success "Database contains $BOOK_COUNT books"

# Check ZIP files
ZIP_COUNT=$(find ./flibusta -name "*.zip" -type f | wc -l | tr -d ' ')
print_success "Found $ZIP_COUNT ZIP files in ./flibusta"

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Access your Flibusta application at:"
echo "  🌐 http://localhost:27102"
echo ""
echo "Default admin credentials:"
echo "  👤 Username: max"
echo "  🔑 Password: hitthat"
echo ""
echo "To download additional book files:"
echo "  1. Log in as admin"
echo "  2. Go to Admin Panel"
echo "  3. Use 'Update Daily Books' to download new books"
echo "  4. Use 'Update Book Mappings' to update file mappings"
echo ""
echo "For manual book file management:"
echo "  📁 Book files location: ./flibusta/"
echo "  📁 SQL files location: ./FlibustaSQL/"
echo "  📁 Cache location: ./cache/"
echo ""
print_success "Setup completed successfully! The application is ready for use."
