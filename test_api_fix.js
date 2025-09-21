// Test script for API fix
console.log('Testing API Fix...');

// Test 1: Test basic books search without query
async function testBasicBooksSearch() {
    console.log('Test 1: Testing basic books search without query...');
    
    try {
        const response = await fetch('/api/books/search?q=&page=0&limit=12&sort=relevance');
        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ Basic books search successful');
            console.log(`✅ Found ${result.data.length} books`);
            console.log(`✅ Total: ${result.pagination.total} books`);
        } else {
            console.log('❌ Basic books search failed:', result);
        }
    } catch (error) {
        console.log('❌ Basic books search error:', error.message);
    }
}

// Test 2: Test books search with query
async function testBooksSearchWithQuery() {
    console.log('\nTest 2: Testing books search with query...');
    
    try {
        const response = await fetch('/api/books/search?q=test&page=0&limit=12&sort=relevance');
        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ Books search with query successful');
            console.log(`✅ Found ${result.data.length} books`);
        } else {
            console.log('❌ Books search with query failed:', result);
        }
    } catch (error) {
        console.log('❌ Books search with query error:', error.message);
    }
}

// Test 3: Test different sort options
async function testSortOptions() {
    console.log('\nTest 3: Testing different sort options...');
    
    const sortOptions = ['relevance', 'title', 'date', 'year_desc'];
    
    for (const sort of sortOptions) {
        try {
            const response = await fetch(`/api/books/search?q=&page=0&limit=5&sort=${sort}`);
            const result = await response.json();
            
            if (response.ok) {
                console.log(`✅ Sort option '${sort}' works`);
            } else {
                console.log(`❌ Sort option '${sort}' failed:`, result);
            }
        } catch (error) {
            console.log(`❌ Sort option '${sort}' error:`, error.message);
        }
    }
}

// Test 4: Test authors search
async function testAuthorsSearch() {
    console.log('\nTest 4: Testing authors search...');
    
    try {
        const response = await fetch('/api/authors?page=0&limit=20&sort=relevance');
        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ Authors search successful');
            console.log(`✅ Found ${result.data.length} authors`);
            console.log(`✅ Total: ${result.pagination.total} authors`);
        } else {
            console.log('❌ Authors search failed:', result);
        }
    } catch (error) {
        console.log('❌ Authors search error:', error.message);
    }
}

// Test 5: Test combined query parsing
async function testCombinedQueryParsing() {
    console.log('\nTest 5: Testing combined query parsing...');
    
    const testQueries = [
        'book by author',
        'книга автор писатель',
        'simple query'
    ];
    
    for (const query of testQueries) {
        try {
            const encodedQuery = encodeURIComponent(query);
            const response = await fetch(`/api/books/search?q=${encodedQuery}&page=0&limit=5&sort=relevance`);
            const result = await response.json();
            
            if (response.ok) {
                console.log(`✅ Combined query '${query}' works`);
            } else {
                console.log(`❌ Combined query '${query}' failed:`, result);
            }
        } catch (error) {
            console.log(`❌ Combined query '${query}' error:`, error.message);
        }
    }
}

// Run all tests
async function runAPITests() {
    await testBasicBooksSearch();
    await testBooksSearchWithQuery();
    await testSortOptions();
    await testAuthorsSearch();
    await testCombinedQueryParsing();
    
    console.log('\n🎉 API tests completed!');
    console.log('\nIf all tests pass, the books should now load properly.');
    console.log('Try navigating to the Books page again.');
}

// Export for use in browser console
window.testAPIFix = runAPITests;

// Auto-run if this script is loaded
if (typeof window !== 'undefined') {
    setTimeout(runAPITests, 1000);
}
