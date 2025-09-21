// Progressive Loader Module - Handles infinite scrolling and progressive loading
class ProgressiveLoader {
    constructor(app) {
        this.app = app;
        this.currentPage = 0;
        this.isLoading = false;
        this.hasMore = true;
        this.currentSection = null;
        this.searchParams = {};
        this.observer = null;
        this.loadingElement = null;
        
        this.init();
    }

    init() {
        this.createLoadingElement();
        this.setupIntersectionObserver();
    }

    createLoadingElement() {
        this.loadingElement = document.createElement('div');
        this.loadingElement.id = 'progressive-loader';
        this.loadingElement.className = 'text-center py-8';
        this.loadingElement.innerHTML = `
            <div class="inline-flex items-center px-4 py-2 font-semibold leading-6 text-white transition ease-in-out duration-150">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Загрузка...
            </div>
        `;
    }

    setupIntersectionObserver() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isLoading && this.hasMore) {
                    this.loadMore();
                }
            });
        }, {
            rootMargin: '100px'
        });
    }

    start(section, searchParams = {}) {
        this.currentSection = section;
        this.searchParams = { ...searchParams };
        this.currentPage = 0;
        this.isLoading = false;
        this.hasMore = true;
        
        // Clear existing content but preserve search interfaces
        this.clearContentPreservingSearch();
        
        // Load first page
        this.loadMore(true);
    }

    clearContentPreservingSearch() {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;

        // Get search interfaces to preserve them
        const booksInterface = document.getElementById('books-search-interface');
        const authorsInterface = document.getElementById('authors-search-interface');
        
        // Clear all content
        contentArea.innerHTML = '';
        
        // Re-add search interfaces if they exist
        if (booksInterface) {
            contentArea.appendChild(booksInterface);
        }
        if (authorsInterface) {
            contentArea.appendChild(authorsInterface);
        }
    }

    async loadMore(isFirstPage = false) {
        if (this.isLoading || (!isFirstPage && !this.hasMore)) {
            return;
        }

        this.isLoading = true;
        this.showLoadingIndicator();

        try {
            const params = {
                ...this.searchParams,
                page: this.currentPage,
                limit: this.getPageSize()
            };

            let result;
            switch (this.currentSection) {
                case 'books':
                    result = await this.app.api.searchBooks(params.query || '', this.currentPage, params);
                    break;
                case 'authors':
                    result = await this.app.api.searchAuthors(params);
                    break;
                default:
                    throw new Error(`Unknown section: ${this.currentSection}`);
            }

            if (isFirstPage) {
                this.app.ui.setContent(this.renderContent(result.data));
            } else {
                this.appendContent(result.data);
            }

            this.updatePagination(result.pagination);
            this.currentPage++;

            // Update results count
            if (result.pagination && result.pagination.total !== undefined) {
                this.app.enhancedSearch.updateResultsCount(this.currentSection, result.pagination.total);
            }

        } catch (error) {
            console.error('Error loading more content:', error);
            this.app.ui.showToast('Ошибка', 'Не удалось загрузить данные', 'error');
        } finally {
            this.isLoading = false;
            this.hideLoadingIndicator();
        }
    }

    renderContent(data) {
        switch (this.currentSection) {
            case 'books':
                return this.renderBooksGrid(data);
            case 'authors':
                return this.renderAuthorsGrid(data);
            default:
                return '';
        }
    }

    renderBooksGrid(books) {
        if (!books || books.length === 0) {
            return `
                <div class="text-center py-12">
                    <i class="fas fa-book-open text-gray-500 text-4xl mb-4"></i>
                    <h3 class="text-xl font-semibold text-white mb-2">Книги не найдены</h3>
                    <p class="text-gray-400">Попробуйте изменить параметры поиска</p>
                </div>
            `;
        }

        let html = `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" id="books-grid">
        `;

        books.forEach(book => {
            html += this.renderBookCard(book);
        });

        html += '</div>';
        return html;
    }

    renderAuthorsGrid(authors) {
        if (!authors || authors.length === 0) {
            return `
                <div class="text-center py-12">
                    <i class="fas fa-user text-gray-500 text-4xl mb-4"></i>
                    <h3 class="text-xl font-semibold text-white mb-2">Авторы не найдены</h3>
                    <p class="text-gray-400">Попробуйте изменить параметры поиска</p>
                </div>
            `;
        }

        let html = `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" id="authors-grid">
        `;

        authors.forEach(author => {
            html += this.renderAuthorCard(author);
        });

        html += '</div>';
        return html;
    }

    renderBookCard(book) {
        const authorName = book.authors && book.authors.length > 0 
            ? `${book.authors[0].lastname} ${book.authors[0].firstname}`.trim()
            : 'Неизвестный автор';
        
        const formatBadge = book.filetype ? 
            `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">${book.filetype.toUpperCase()}</span>` : '';
        
        const coverUrl = book.cover_url || this.app.display.generatePlaceholderSVG(book.title);
        
        const fileSize = book.filesize ? 
            (parseInt(book.filesize) / 1024 / 1024).toFixed(1) + ' MB' : '';

        return `
            <div class="bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden enhanced-card">
                <div class="relative">
                    <img src="${coverUrl}" alt="${book.title}" class="w-full h-64 object-cover" 
                         onerror="this.src='${this.app.display.generatePlaceholderSVG(book.title)}'">
                    <div class="absolute top-2 right-2">
                        ${formatBadge}
                    </div>
                </div>
                <div class="p-4">
                    <h3 class="text-lg font-semibold text-white mb-2 line-clamp-2" title="${book.title}">${book.title}</h3>
                    <p class="text-gray-300 text-sm mb-2">${authorName}</p>
                    <div class="flex items-center justify-between text-sm text-gray-400 mb-3">
                        <span>${book.year || 'Год не указан'}</span>
                        <span>${fileSize}</span>
                    </div>
                    <button class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105" 
                            onclick="app.showBookDetails('${book.bookid}')">
                        <i class="fas fa-eye mr-2"></i>Подробнее
                    </button>
                </div>
            </div>
        `;
    }

    renderAuthorCard(author) {
        const authorName = `${author.lastname} ${author.firstname} ${author.nickname || ''}`.trim();
        
        return `
            <div class="bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6 enhanced-card">
                <div class="text-center">
                    <div class="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-user text-white text-2xl"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-white mb-2 line-clamp-2" title="${authorName}">${authorName}</h3>
                    <p class="text-gray-400 text-sm mb-4">Книг: ${author.book_count || 0}</p>
                    <button class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105" 
                            onclick="app.showAuthorBooks('${author.avtorid}')">
                        <i class="fas fa-books mr-2"></i>Книги автора
                    </button>
                </div>
            </div>
        `;
    }

    appendContent(data) {
        const container = document.getElementById(`${this.currentSection}-grid`);
        if (!container) return;

        data.forEach(item => {
            const cardHtml = this.currentSection === 'books' 
                ? this.renderBookCard(item) 
                : this.renderAuthorCard(item);
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cardHtml;
            container.appendChild(tempDiv.firstElementChild);
        });
    }

    updatePagination(pagination) {
        this.hasMore = pagination.hasNext;
        
        if (this.hasMore) {
            this.observeLoadingElement();
        } else {
            this.unobserveLoadingElement();
        }
    }

    showLoadingIndicator() {
        const container = document.getElementById(`${this.currentSection}-grid`);
        if (container) {
            container.appendChild(this.loadingElement);
        }
    }

    hideLoadingIndicator() {
        if (this.loadingElement.parentNode) {
            this.loadingElement.parentNode.removeChild(this.loadingElement);
        }
    }

    observeLoadingElement() {
        if (this.loadingElement && this.observer) {
            this.observer.observe(this.loadingElement);
        }
    }

    unobserveLoadingElement() {
        if (this.loadingElement && this.observer) {
            this.observer.unobserve(this.loadingElement);
        }
    }

    getPageSize() {
        switch (this.currentSection) {
            case 'books':
                return 12; // 3x4 grid
            case 'authors':
                return 20; // 4x5 grid
            default:
                return 10;
        }
    }

    stop() {
        this.unobserveLoadingElement();
        this.isLoading = false;
        this.hasMore = false;
        this.currentSection = null;
    }

    updateSearchParams(newParams) {
        this.searchParams = { ...newParams };
        this.currentPage = 0;
        this.hasMore = true;
        this.loadMore(true);
    }
}
