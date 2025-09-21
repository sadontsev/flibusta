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
        
        this.init();
    }

    init() {
        this.checkAuth();
        this.bindEvents();
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

    async checkAuth() {
        await this.auth.checkAuth();
    }

    // Navigation Methods
    showHome() {
        this.currentSection = 'home';
        this.ui.updateActiveNavigation('home');
        this.display.displayHome();
    }

    async showBooks() {
        this.currentSection = 'books';
        this.ui.updateActiveNavigation('books');
        this.ui.showLoading();

        try {
            const data = await this.api.getRecentBooks();
            this.display.displayBooks(data);
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'showBooks');
            this.ui.showError(errorMessage);
        }
    }

    async showAuthors() {
        this.currentSection = 'authors';
        this.ui.updateActiveNavigation('authors');
        this.ui.showLoading();

        try {
            const data = await this.api.getAuthors();
            this.display.displayAuthors(data);
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'showAuthors');
            this.ui.showError(errorMessage);
        }
    }

    async showGenres() {
        this.currentSection = 'genres';
        this.ui.updateActiveNavigation('genres');
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
        if (!this.auth.isAdmin()) {
            this.ui.showToast('Ошибка', 'Доступ запрещен', 'error');
            return;
        }

        this.currentSection = 'admin';
        this.ui.updateActiveNavigation('admin');
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

        this.ui.showLoading();

        try {
            const data = await this.api.searchBooks(query);
            this.display.displaySearchResults(data);
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'performSearch');
            this.ui.showError(errorMessage);
        }
    }

    // Detail Methods
    async showBookDetails(bookId) {
        try {
            const data = await this.api.getBookDetails(bookId);
            // TODO: Implement book details display
            this.ui.showToast('Информация', 'Детали книги будут добавлены позже');
        } catch (error) {
            const errorMessage = this.api.handleAPIError(error, 'showBookDetails');
            this.ui.showToast('Ошибка', errorMessage, 'error');
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
