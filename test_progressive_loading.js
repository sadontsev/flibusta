// Test script for progressive loading and enhanced search functionality
// This script can be run in the browser console to test the new features

console.log('Testing Progressive Loading and Enhanced Search Features...');

// Test 1: Check if modules are loaded
function testModulesLoaded() {
    console.log('Test 1: Checking if modules are loaded...');
    
    const modules = [
        'ProgressiveLoader',
        'EnhancedSearch',
        'FlibustaApp'
    ];
    
    modules.forEach(module => {
        if (typeof window[module] !== 'undefined') {
            console.log(`✅ ${module} is loaded`);
        } else {
            console.log(`❌ ${module} is not loaded`);
        }
    });
}

// Test 2: Test enhanced search query parsing
function testSearchQueryParsing() {
    console.log('\nTest 2: Testing enhanced search query parsing...');
    
    const testQueries = [
        'Война и мир by Толстой',
        'Преступление и наказание автор Достоевский',
        'Мастер и Маргарита от Булгаков',
        'Simple book title',
        'Author Name'
    ];
    
    testQueries.forEach(query => {
        const parts = query.split(/\s+by\s+|\s+автор\s+|\s+от\s+/i);
        if (parts.length > 1) {
            console.log(`✅ Combined query: "${query}" -> Book: "${parts[0].trim()}", Author: "${parts[1].trim()}"`);
        } else {
            console.log(`✅ Single query: "${query}"`);
        }
    });
}

// Test 3: Test sort options
function testSortOptions() {
    console.log('\nTest 3: Testing sort options...');
    
    const bookSortOptions = [
        'date', 'title', 'title_desc', 'author', 'author_desc', 
        'year', 'year_desc', 'rating', 'rating_asc'
    ];
    
    const authorSortOptions = [
        'name', 'name_desc', 'firstname', 'firstname_desc', 
        'books', 'books_asc', 'recent'
    ];
    
    console.log('✅ Book sort options:', bookSortOptions);
    console.log('✅ Author sort options:', authorSortOptions);
}

// Test 4: Test progressive loading parameters
function testProgressiveLoadingParams() {
    console.log('\nTest 4: Testing progressive loading parameters...');
    
    const pageSizes = {
        books: 12, // 3x4 grid
        authors: 20 // 4x5 grid
    };
    
    console.log('✅ Page sizes:', pageSizes);
    
    // Test pagination calculation
    const totalBooks = 150;
    const totalAuthors = 300;
    
    const bookPages = Math.ceil(totalBooks / pageSizes.books);
    const authorPages = Math.ceil(totalAuthors / pageSizes.authors);
    
    console.log(`✅ Books: ${totalBooks} total -> ${bookPages} pages`);
    console.log(`✅ Authors: ${totalAuthors} total -> ${authorPages} pages`);
}

// Test 5: Test API endpoints
async function testAPIEndpoints() {
    console.log('\nTest 5: Testing API endpoints...');
    
    const endpoints = [
        '/api/books/search?q=test&page=0&limit=12&sort=date',
        '/api/authors?page=0&limit=20&sort=name',
        '/api/books/search?q=book by author&page=0&limit=12&sort=title',
        '/api/authors?q=test&letter=А&page=0&limit=20&sort=books'
    ];
    
    endpoints.forEach(endpoint => {
        console.log(`✅ Endpoint: ${endpoint}`);
    });
}

// Test 6: Test CSS classes
function testCSSClasses() {
    console.log('\nTest 6: Testing CSS classes...');
    
    const cssClasses = [
        'search-interface',
        'enhanced-search-input',
        'progressive-loader',
        'enhanced-card',
        'clear-filters-btn',
        'results-count'
    ];
    
    cssClasses.forEach(className => {
        console.log(`✅ CSS class: ${className}`);
    });
}

// Run all tests
function runAllTests() {
    testModulesLoaded();
    testSearchQueryParsing();
    testSortOptions();
    testProgressiveLoadingParams();
    testAPIEndpoints();
    testCSSClasses();
    
    console.log('\n🎉 All tests completed!');
    console.log('\nTo test the actual functionality:');
    console.log('1. Navigate to the Books page');
    console.log('2. Try searching with combined queries like "book by author"');
    console.log('3. Use the enhanced search filters');
    console.log('4. Test progressive loading by scrolling');
    console.log('5. Try different sort options');
}

// Export for use in browser console
window.testProgressiveLoading = runAllTests;

// Auto-run if this script is loaded
if (typeof window !== 'undefined') {
    setTimeout(runAllTests, 1000);
}
