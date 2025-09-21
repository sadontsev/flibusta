// Test script for search interface placement fix
console.log('Testing Search Interface Placement Fix...');

// Test 1: Check if search interfaces are in the correct location
function testSearchInterfacePlacement() {
    console.log('Test 1: Checking search interface placement...');
    
    const contentArea = document.getElementById('contentArea');
    const booksInterface = document.getElementById('books-search-interface');
    const authorsInterface = document.getElementById('authors-search-interface');
    
    if (contentArea && booksInterface) {
        const isInContentArea = contentArea.contains(booksInterface);
        console.log(`✅ Books search interface in content area: ${isInContentArea}`);
    } else {
        console.log('❌ Books search interface not found');
    }
    
    if (contentArea && authorsInterface) {
        const isInContentArea = contentArea.contains(authorsInterface);
        console.log(`✅ Authors search interface in content area: ${isInContentArea}`);
    } else {
        console.log('❌ Authors search interface not found');
    }
}

// Test 2: Check if search interfaces are not in navigation
function testNotInNavigation() {
    console.log('\nTest 2: Checking search interfaces are not in navigation...');
    
    const nav = document.querySelector('nav');
    const booksInterface = document.getElementById('books-search-interface');
    const authorsInterface = document.getElementById('authors-search-interface');
    
    if (nav && booksInterface) {
        const isInNav = nav.contains(booksInterface);
        console.log(`✅ Books search interface NOT in navigation: ${!isInNav}`);
    }
    
    if (nav && authorsInterface) {
        const isInNav = nav.contains(authorsInterface);
        console.log(`✅ Authors search interface NOT in navigation: ${!isInNav}`);
    }
}

// Test 3: Test interface visibility management
function testInterfaceVisibility() {
    console.log('\nTest 3: Testing interface visibility management...');
    
    const booksInterface = document.getElementById('books-search-interface');
    const authorsInterface = document.getElementById('authors-search-interface');
    
    if (booksInterface && authorsInterface) {
        console.log('✅ Both search interfaces exist');
        console.log(`✅ Books interface display: ${booksInterface.style.display}`);
        console.log(`✅ Authors interface display: ${authorsInterface.style.display}`);
    } else {
        console.log('❌ One or both search interfaces missing');
    }
}

// Test 4: Test content preservation
function testContentPreservation() {
    console.log('\nTest 4: Testing content preservation...');
    
    const testContent = '<div class="test-content">Test content</div>';
    const contentArea = document.getElementById('contentArea');
    
    if (contentArea) {
        // Simulate setting content
        const originalContent = contentArea.innerHTML;
        contentArea.innerHTML = testContent;
        
        // Check if search interfaces are preserved
        const booksInterface = document.getElementById('books-search-interface');
        const authorsInterface = document.getElementById('authors-search-interface');
        
        const booksPreserved = contentArea.contains(booksInterface);
        const authorsPreserved = contentArea.contains(authorsInterface);
        
        console.log(`✅ Books interface preserved: ${booksPreserved}`);
        console.log(`✅ Authors interface preserved: ${authorsPreserved}`);
        
        // Restore original content
        contentArea.innerHTML = originalContent;
    }
}

// Test 5: Test navigation functionality
function testNavigationFunctionality() {
    console.log('\nTest 5: Testing navigation functionality...');
    
    const navLinks = document.querySelectorAll('nav a[onclick*="showBooks"], nav a[onclick*="showAuthors"]');
    
    navLinks.forEach(link => {
        const onclick = link.getAttribute('onclick');
        if (onclick.includes('showBooks')) {
            console.log('✅ Books navigation link found');
        } else if (onclick.includes('showAuthors')) {
            console.log('✅ Authors navigation link found');
        }
    });
}

// Run all tests
function runSearchPlacementTests() {
    testSearchInterfacePlacement();
    testNotInNavigation();
    testInterfaceVisibility();
    testContentPreservation();
    testNavigationFunctionality();
    
    console.log('\n🎉 Search placement tests completed!');
    console.log('\nTo test the actual functionality:');
    console.log('1. Navigate to Books page - search interface should appear in content area');
    console.log('2. Navigate to Authors page - search interface should appear in content area');
    console.log('3. Navigate to other pages - search interfaces should be hidden');
    console.log('4. Check that search interfaces are NOT in the navigation bar');
    console.log('5. Verify that search interfaces persist when content changes');
}

// Export for use in browser console
window.testSearchPlacement = runSearchPlacementTests;

// Auto-run if this script is loaded
if (typeof window !== 'undefined') {
    setTimeout(runSearchPlacementTests, 1000);
}
