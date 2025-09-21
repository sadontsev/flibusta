// Enhanced Search Module - Handles advanced search with filters and sorting
class EnhancedSearch {
    constructor(app) {
        this.app = app;
        this.currentFilters = {};
        this.currentSort = {};
        this.searchTimeout = null;
        
        this.init();
    }

    init() {
        this.createSearchInterface();
        this.bindEvents();
    }

    createSearchInterface() {
        // Create search interface for books
        this.createBooksSearchInterface();
        
        // Create search interface for authors
        this.createAuthorsSearchInterface();
    }

    createBooksSearchInterface() {
        const booksSearchHtml = `
            <div class="bg-gray-800 rounded-lg p-4 mb-4 search-interface" id="books-search-interface" style="display: none;">
                <div class="flex flex-wrap items-center gap-3 mb-3">
                    <div class="flex-1 min-w-64">
                        <input type="text" id="books-search-query" placeholder="Название книги или автор..." 
                               class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 enhanced-search-input">
                    </div>
                    <div class="flex items-center gap-2">
                        <select id="books-sort-select" class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 enhanced-search-input text-sm">
                            <option value="relevance">По релевантности</option>
                            <option value="title">По названию (А-Я)</option>
                            <option value="title_desc">По названию (Я-А)</option>
                            <option value="author">По автору (А-Я)</option>
                            <option value="year_desc">По году (новые)</option>
                            <option value="year">По году (старые)</option>
                            <option value="rating">По рейтингу</option>
                            <option value="date">По дате добавления</option>
                        </select>
                        <button id="books-clear-filters" class="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors clear-filters-btn text-sm">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <div class="flex items-center gap-2">
                        <input type="text" id="books-search-genre" placeholder="Жанр..." 
                               class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 enhanced-search-input text-sm w-32">
                        <input type="text" id="books-search-series" placeholder="Серия..." 
                               class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 enhanced-search-input text-sm w-32">
                        <input type="number" id="books-search-year" placeholder="Год..." min="1800" max="2100"
                               class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 enhanced-search-input text-sm w-20">
                    </div>
                    <div class="text-sm text-gray-400 results-count ml-auto">
                        <span id="books-results-count">0 результатов</span>
                    </div>
                </div>
            </div>
        `;

        // Insert at the beginning of the content area
        const contentArea = document.getElementById('contentArea');
        if (contentArea) {
            contentArea.insertAdjacentHTML('afterbegin', booksSearchHtml);
        }
    }

    createAuthorsSearchInterface() {
        const authorsSearchHtml = `
            <div class="bg-gray-800 rounded-lg p-4 mb-4 search-interface" id="authors-search-interface" style="display: none;">
                <div class="flex flex-wrap items-center gap-3 mb-3">
                    <div class="flex-1 min-w-64">
                        <input type="text" id="authors-search-query" placeholder="Имя или фамилия автора..." 
                               class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 enhanced-search-input">
                    </div>
                    <div class="flex items-center gap-2">
                        <select id="authors-letter-select" class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 enhanced-search-input text-sm w-20">
                            <option value="">Все</option>
                            <option value="А">А</option>
                            <option value="Б">Б</option>
                            <option value="В">В</option>
                            <option value="Г">Г</option>
                            <option value="Д">Д</option>
                            <option value="Е">Е</option>
                            <option value="Ё">Ё</option>
                            <option value="Ж">Ж</option>
                            <option value="З">З</option>
                            <option value="И">И</option>
                            <option value="Й">Й</option>
                            <option value="К">К</option>
                            <option value="Л">Л</option>
                            <option value="М">М</option>
                            <option value="Н">Н</option>
                            <option value="О">О</option>
                            <option value="П">П</option>
                            <option value="Р">Р</option>
                            <option value="С">С</option>
                            <option value="Т">Т</option>
                            <option value="У">У</option>
                            <option value="Ф">Ф</option>
                            <option value="Х">Х</option>
                            <option value="Ц">Ц</option>
                            <option value="Ч">Ч</option>
                            <option value="Ш">Ш</option>
                            <option value="Щ">Щ</option>
                            <option value="Э">Э</option>
                            <option value="Ю">Ю</option>
                            <option value="Я">Я</option>
                        </select>
                        <select id="authors-sort-select" class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 enhanced-search-input text-sm">
                            <option value="relevance">По релевантности</option>
                            <option value="name">По фамилии (А-Я)</option>
                            <option value="name_desc">По фамилии (Я-А)</option>
                            <option value="books">По количеству книг</option>
                            <option value="firstname">По имени (А-Я)</option>
                            <option value="recent">По дате добавления</option>
                        </select>
                        <button id="authors-clear-filters" class="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors clear-filters-btn text-sm">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="flex items-center justify-end">
                    <div class="text-sm text-gray-400 results-count">
                        <span id="authors-results-count">0 результатов</span>
                    </div>
                </div>
            </div>
        `;

        // Insert at the beginning of the content area
        const contentArea = document.getElementById('contentArea');
        if (contentArea) {
            contentArea.insertAdjacentHTML('afterbegin', authorsSearchHtml);
        }
    }

    bindEvents() {
        // Books search events
        this.bindBooksSearchEvents();
        
        // Authors search events
        this.bindAuthorsSearchEvents();
    }

    bindBooksSearchEvents() {
        const queryInput = document.getElementById('books-search-query');
        const genreInput = document.getElementById('books-search-genre');
        const seriesInput = document.getElementById('books-search-series');
        const yearInput = document.getElementById('books-search-year');
        const sortSelect = document.getElementById('books-sort-select');
        const clearButton = document.getElementById('books-clear-filters');

        if (queryInput) {
            queryInput.addEventListener('input', () => this.debouncedSearch('books'));
        }
        if (genreInput) {
            genreInput.addEventListener('input', () => this.debouncedSearch('books'));
        }
        if (seriesInput) {
            seriesInput.addEventListener('input', () => this.debouncedSearch('books'));
        }
        if (yearInput) {
            yearInput.addEventListener('input', () => this.debouncedSearch('books'));
        }
        if (sortSelect) {
            sortSelect.addEventListener('change', () => this.debouncedSearch('books'));
        }
        if (clearButton) {
            clearButton.addEventListener('click', () => this.clearBooksFilters());
        }
    }

    bindAuthorsSearchEvents() {
        const queryInput = document.getElementById('authors-search-query');
        const letterSelect = document.getElementById('authors-letter-select');
        const sortSelect = document.getElementById('authors-sort-select');
        const clearButton = document.getElementById('authors-clear-filters');

        if (queryInput) {
            queryInput.addEventListener('input', () => this.debouncedSearch('authors'));
        }
        if (letterSelect) {
            letterSelect.addEventListener('change', () => this.debouncedSearch('authors'));
        }
        if (sortSelect) {
            sortSelect.addEventListener('change', () => this.debouncedSearch('authors'));
        }
        if (clearButton) {
            clearButton.addEventListener('click', () => this.clearAuthorsFilters());
        }
    }

    debouncedSearch(section) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.performSearch(section);
        }, 300);
    }

    async performSearch(section) {
        const filters = this.getFilters(section);
        const sort = this.getSort(section);

        // Smart auto-preset logic
        const smartSort = this.getSmartSortOption(section, filters, sort);

        if (section === 'books') {
            this.app.progressiveLoader.updateSearchParams({
                query: filters.query,
                genre: filters.genre,
                series: filters.series,
                year: filters.year,
                sort: smartSort
            });
        } else if (section === 'authors') {
            this.app.progressiveLoader.updateSearchParams({
                query: filters.query,
                letter: filters.letter,
                sort: smartSort
            });
        }
    }

    getSmartSortOption(section, filters, currentSort) {
        // If user explicitly selected a sort option, respect their choice
        if (currentSort && currentSort !== 'relevance') {
            return currentSort;
        }

        // Auto-preset logic based on search context
        if (section === 'books') {
            if (filters.query) {
                // When searching, prioritize relevance
                return 'relevance';
            } else if (filters.genre || filters.series || filters.year) {
                // When filtering, show newest first
                return 'date';
            } else {
                // Default browsing: show newest first
                return 'date';
            }
        } else if (section === 'authors') {
            if (filters.query) {
                // When searching, prioritize relevance
                return 'relevance';
            } else if (filters.letter) {
                // When filtering by letter, use alphabetical
                return 'name';
            } else {
                // Default browsing: show most popular first
                return 'books';
            }
        }

        return 'relevance';
    }

    getFilters(section) {
        if (section === 'books') {
            return {
                query: document.getElementById('books-search-query')?.value || '',
                genre: document.getElementById('books-search-genre')?.value || '',
                series: document.getElementById('books-search-series')?.value || '',
                year: document.getElementById('books-search-year')?.value || ''
            };
        } else if (section === 'authors') {
            return {
                query: document.getElementById('authors-search-query')?.value || '',
                letter: document.getElementById('authors-letter-select')?.value || ''
            };
        }
        return {};
    }

    getSort(section) {
        if (section === 'books') {
            return document.getElementById('books-sort-select')?.value || 'date';
        } else if (section === 'authors') {
            return document.getElementById('authors-sort-select')?.value || 'name';
        }
        return '';
    }

    clearBooksFilters() {
        document.getElementById('books-search-query').value = '';
        document.getElementById('books-search-genre').value = '';
        document.getElementById('books-search-series').value = '';
        document.getElementById('books-search-year').value = '';
        document.getElementById('books-sort-select').value = 'relevance';
        this.performSearch('books');
    }

    clearAuthorsFilters() {
        document.getElementById('authors-search-query').value = '';
        document.getElementById('authors-letter-select').value = '';
        document.getElementById('authors-sort-select').value = 'relevance';
        this.performSearch('authors');
    }

    showSearchInterface(section) {
        // Hide all search interfaces
        const booksInterface = document.getElementById('books-search-interface');
        const authorsInterface = document.getElementById('authors-search-interface');
        
        if (booksInterface) booksInterface.style.display = 'none';
        if (authorsInterface) authorsInterface.style.display = 'none';

        // Show the appropriate interface
        if (section === 'books') {
            if (booksInterface) booksInterface.style.display = 'block';
        } else if (section === 'authors') {
            if (authorsInterface) authorsInterface.style.display = 'block';
        }
    }

    hideSearchInterface() {
        const booksInterface = document.getElementById('books-search-interface');
        const authorsInterface = document.getElementById('authors-search-interface');
        
        if (booksInterface) booksInterface.style.display = 'none';
        if (authorsInterface) authorsInterface.style.display = 'none';
    }

    updateResultsCount(section, count) {
        const countElement = document.getElementById(`${section}-results-count`);
        if (countElement) {
            countElement.textContent = `${count} результатов`;
        }
    }
}

