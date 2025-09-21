// Flibusta Frontend Application - Modular Version
class FlibustaApp {
    constructor() {
        this.currentPage = 1;
        this.currentSection = 'home';
        
        // Initialize modules
        this.auth = new AuthModule(this);
        this.ui = new UIModule(this);
        this.api = new APIModule(this);
        this.display = new DisplayModule(this);
        this.progressiveLoader = new ProgressiveLoader(this);
        this.enhancedSearch = new EnhancedSearch(this);
        
        this.init();
    }

    init() {
        this.checkAuth();
        this.bindEvents();
        this.handleUrlParameters();
        this.showHome(); // Default view
    }

    bindEvents() {
        // Search input enter key
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });
    }

    handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        
        if (error) {
            let message = 'Произошла ошибка';
            let type = 'error';
            
            switch (error) {
                case 'insufficient_permissions':
                    message = 'Недостаточно прав для доступа к этой странице';
                    break;
                case 'authentication_required':
                    message = 'Необходима авторизация для доступа к этой странице';
                    break;
                default:
                    message = 'Произошла неизвестная ошибка';
            }
            
            this.ui.showToast('Ошибка', message, type);
            
            // Clean up URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        }
    }

    async checkAuth() {
        await this.auth.checkAuth();
    }

    // Navigation Methods
    showHome() {
        this.currentSection = 'home';
        this.ui.updateActiveNavigation('home');
        this.enhancedSearch.hideSearchInterface();
        this.progressiveLoader.stop();
        this.display.displayHome();
    }

    async showBooks() {
        this.currentSection = 'books';
        this.ui.updateActiveNavigation('books');
        this.enhancedSearch.showSearchInterface('books');
        
        // Start progressive loading for books
        this.progressiveLoader.start('books');
    }

    async showAuthors() {
        this.currentSection = 'authors';
        this.ui.updateActiveNavigation('authors');
        this.enhancedSearch.showSearchInterface('authors');
        
        // Start progressive loading for authors
        this.progressiveLoader.start('authors');
    }

    async showGenres() {
        this.currentSection = 'genres';
        this.ui.updateActiveNavigation('genres');
        this.enhancedSearch.hideSearchInterface();
        this.progressiveLoader.stop();
        this.ui.showLoading();

        try {
            const data = await this.api.getGenres();
            this.display.displayGenres(data);
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'showGenres');
            this.ui.showError(errorMessage);
        }
    }

    async showSeries() {
        this.currentSection = 'series';
        this.ui.updateActiveNavigation('series');
        this.enhancedSearch.hideSearchInterface();
        this.progressiveLoader.stop();
        this.ui.showLoading();

        try {
            const data = await this.api.getSeries();
            this.display.displaySeries(data);
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'showSeries');
            this.ui.showError(errorMessage);
        }
    }

    async showAdmin() {
        this.currentSection = 'admin';
        this.ui.updateActiveNavigation('admin');
        this.enhancedSearch.hideSearchInterface();
        this.progressiveLoader.stop();
        this.ui.showLoading();

        try {
            const data = await this.api.getAdminData();
            this.display.displayAdminPanel(data);
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'showAdmin');
            this.ui.showError(errorMessage);
        }
    }

    // Search Methods
    async performSearch() {
        const query = document.getElementById('searchInput').value.trim();
        
        if (!query) {
            this.ui.showToast('Ошибка', 'Введите поисковый запрос', 'error');
            return;
        }

        // Check if we're on books or authors page
        if (this.currentSection === 'books') {
            // Update the books search interface with the query
            const booksQueryInput = document.getElementById('books-search-query');
            if (booksQueryInput) {
                booksQueryInput.value = query;
                this.enhancedSearch.performSearch('books');
            }
        } else if (this.currentSection === 'authors') {
            // Update the authors search interface with the query
            const authorsQueryInput = document.getElementById('authors-search-query');
            if (authorsQueryInput) {
                authorsQueryInput.value = query;
                this.enhancedSearch.performSearch('authors');
            }
        } else {
            // Default search - navigate to books and search
            this.showBooks();
            setTimeout(() => {
                const booksQueryInput = document.getElementById('books-search-query');
                if (booksQueryInput) {
                    booksQueryInput.value = query;
                    this.enhancedSearch.performSearch('books');
                }
            }, 100);
        }
    }

    // Detail Methods
    async showBookDetails(bookId) {
        try {
            const data = await this.api.getBookDetails(bookId);
            this.display.displayBookDetails(data);
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'showBookDetails');
            this.ui.showToast('Ошибка', errorMessage, 'error');
        }
    }

    async downloadBook(bookId) {
        try {
            await this.api.downloadBook(bookId);
            this.ui.showToast('Успех', 'Книга загружается...', 'success');
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'downloadBook');
            this.ui.showToast('Ошибка', errorMessage, 'error');
        }
    }

    // Admin update methods
    async getUpdateStatus() {
        try {
            const status = await this.api.getUpdateStatus();
            return status;
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'getUpdateStatus');
            this.ui.showToast('Ошибка', errorMessage, 'error');
            throw error;
        }
    }

    async updateSqlFiles() {
        try {
            this.ui.showToast('Информация', 'Обновление SQL файлов...', 'info');
            const result = await this.api.updateSqlFiles();
            this.ui.showToast('Успех', `SQL файлы обновлены: ${result.data.summary.success}/${result.data.summary.total}`, 'success');
            return result;
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'updateSqlFiles');
            this.ui.showToast('Ошибка', errorMessage, 'error');
            throw error;
        }
    }

    async updateDailyBooks() {
        try {
            this.ui.showToast('Информация', 'Обновление ежедневных книг...', 'info');
            const result = await this.api.updateDailyBooks();
            this.ui.showToast('Успех', `Книги обновлены: ${result.data.summary.success}/${result.data.summary.total}`, 'success');
            return result;
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'updateDailyBooks');
            this.ui.showToast('Ошибка', errorMessage, 'error');
            throw error;
        }
    }

    async updateCovers() {
        try {
            this.ui.showToast('Информация', 'Обновление обложек...', 'info');
            const result = await this.api.updateCovers();
            this.ui.showToast('Успех', `Обложки обновлены: ${result.data.summary.success}/${result.data.summary.total}`, 'success');
            return result;
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'updateCovers');
            this.ui.showToast('Ошибка', errorMessage, 'error');
            throw error;
        }
    }

    async updateBookMappings() {
        try {
            this.ui.showToast('Информация', 'Обновление маппингов книг...', 'info');
            const result = await this.api.updateBookMappings();
            this.ui.showToast('Успех', 'Маппинги книг обновлены', 'success');
            return result;
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'updateBookMappings');
            this.ui.showToast('Ошибка', errorMessage, 'error');
            throw error;
        }
    }

    async performFullUpdate() {
        try {
            this.ui.showToast('Информация', 'Запуск полного обновления системы...', 'info');
            const result = await this.api.performFullUpdate();
            this.ui.showToast('Успех', 'Полное обновление завершено', 'success');
            return result;
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'performFullUpdate');
            this.ui.showToast('Ошибка', errorMessage, 'error');
            throw error;
        }
    }

    showAdminUpdates() {
        console.log('showAdminUpdates called');
        console.log('this.auth.isAdmin() =', this.auth.isAdmin());
        if (!this.auth.isAdmin()) {
            this.ui.showToast('Ошибка', 'Доступ запрещен. Необходимо войти в систему как администратор.', 'error');
            return;
        }
        console.log('Calling this.display.displayAdminUpdates()');
        this.display.displayAdminUpdates();
    }

    async refreshUpdateStatus() {
        try {
            const status = await this.getUpdateStatus();
            this.display.updateStatusDisplay(status);
        } catch (error) {
            console.error('Failed to refresh update status:', error);
        }
    }

    // Automated update methods
    async getAutomatedUpdateHistory(limit = 50, type = null) {
        try {
            const result = await this.api.getAutomatedUpdateHistory(limit, type);
            return result.data;
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'getAutomatedUpdateHistory');
            this.ui.showToast('Ошибка', errorMessage, 'error');
            throw error;
        }
    }

    async getAutomatedUpdateStats() {
        try {
            const result = await this.api.getAutomatedUpdateStats();
            return result.data;
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'getAutomatedUpdateStats');
            this.ui.showToast('Ошибка', errorMessage, 'error');
            throw error;
        }
    }

    async enableAutomatedSchedule(type) {
        try {
            const result = await this.api.enableAutomatedSchedule(type);
            this.ui.showToast('Успех', `Автоматическое обновление ${type} включено`, 'success');
            return result;
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'enableAutomatedSchedule');
            this.ui.showToast('Ошибка', errorMessage, 'error');
            throw error;
        }
    }

    async disableAutomatedSchedule(type) {
        try {
            const result = await this.api.disableAutomatedSchedule(type);
            this.ui.showToast('Успех', `Автоматическое обновление ${type} отключено`, 'success');
            return result;
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'disableAutomatedSchedule');
            this.ui.showToast('Ошибка', errorMessage, 'error');
            throw error;
        }
    }

    async triggerAutomatedUpdate(type) {
        try {
            this.ui.showToast('Информация', `Запуск автоматического обновления ${type}...`, 'info');
            const result = await this.api.triggerAutomatedUpdate(type);
            this.ui.showToast('Успех', `Автоматическое обновление ${type} запущено`, 'success');
            return result;
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'triggerAutomatedUpdate');
            this.ui.showToast('Ошибка', errorMessage, 'error');
            throw error;
        }
    }

    showAutomatedUpdates() {
        if (!this.auth.isAdmin()) {
            this.ui.showToast('Ошибка', 'Доступ запрещен. Необходимо войти в систему как администратор.', 'error');
            return;
        }
        this.display.displayAutomatedUpdates();
    }

    async refreshAutomatedStatus() {
        try {
            await this.display.loadAutomatedStatus();
        } catch (error) {
            console.error('Failed to refresh automated status:', error);
        }
    }

    async loadAutomatedHistory(limit = 50, type = null) {
        try {
            await this.display.loadAutomatedHistory(limit, type);
        } catch (error) {
            console.error('Failed to load automated history:', error);
        }
    }

    async showAuthorBooks(authorId) {
        this.ui.showLoading();

        try {
            const data = await this.api.getAuthorBooks(authorId);
            this.display.displayBooks(data);
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'showAuthorBooks');
            this.ui.showError(errorMessage);
        }
    }

    async showGenreBooks(genreId) {
        this.ui.showLoading();

        try {
            const data = await this.api.getGenreBooks(genreId);
            this.display.displayBooks(data);
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'showGenreBooks');
            this.ui.showError(errorMessage);
        }
    }

    async showSeriesBooks(seriesId) {
        this.ui.showLoading();

        try {
            const data = await this.api.getSeriesBooks(seriesId);
            this.display.displayBooks(data);
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'showSeriesBooks');
            this.ui.showError(errorMessage);
        }
    }

    // Admin Methods
    editUser(userId) {
        // TODO: Implement user editing
        this.ui.showToast('Информация', 'Редактирование пользователей будет добавлено позже');
    }

    // Utility Methods
    getCurrentSection() {
        return this.currentSection;
    }

    // Public API for global access
    static getInstance() {
        if (!FlibustaApp.instance) {
            FlibustaApp.instance = new FlibustaApp();
        }
        return FlibustaApp.instance;
    }
}

// Global app instance
let app;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app = FlibustaApp.getInstance();
});

// Make app globally accessible
window.app = app;
