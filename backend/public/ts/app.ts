// @ts-nocheck
// Flibusta Frontend Application - Modular Version (TypeScript)
class FlibustaAppNG {
  currentPage: number;
  currentSection: string;
  auth: any;
  ui: any;
  api: any;
  display: any;
  progressiveLoader: any;
  enhancedSearch: any;
  static instance: FlibustaAppNG | undefined;

  constructor() {
    this.currentPage = 1;
    this.currentSection = 'home';

    this.auth = new (window as any).AuthModule(this);
    this.ui = new (window as any).UIModule(this);
    this.api = new (window as any).APIModule(this);
    this.display = new (window as any).DisplayModule(this);
    this.progressiveLoader = new (window as any).ProgressiveLoader(this);
    this.enhancedSearch = new (window as any).EnhancedSearch(this);

    this.init();
  }

  init() {
    this.checkAuth();
    this.bindEvents();
    this.handleUrlParameters();
    this.showBooks();
  }

  bindEvents() {
    const search = document.getElementById('searchInput') as HTMLInputElement | null;
    search?.addEventListener('keypress', (e: KeyboardEvent) => {
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
      this.ui.showToast('Ошибка', message, 'error');
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }

  async checkAuth() { await this.auth.checkAuth(); }

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
    this.progressiveLoader.start('books');
  }

  async showAuthors() {
    this.currentSection = 'authors';
    this.ui.updateActiveNavigation('authors');
    this.enhancedSearch.showSearchInterface('authors');
    this.progressiveLoader.start('authors');
  }

  async showAuthorBooks(authorId: string) {
    this.currentSection = 'books';
    this.ui.updateActiveNavigation('books');
    this.enhancedSearch.hideSearchInterface();
    this.progressiveLoader.stop();
    this.ui.showLoading();
    try {
      const data = await this.api.getAuthorBooks(authorId);
      this.display.displayBooks(data);
    } catch (error: any) {
      const msg = this.api.handleAPIError(error, 'showAuthorBooks');
      this.ui.showError(msg);
    }
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
    } catch (error: any) {
      const msg = this.api.handleAPIError(error, 'showGenres');
      this.ui.showError(msg);
    }
  }

  async showGenresInCategory(category: string) {
    this.currentSection = 'genres';
    this.ui.updateActiveNavigation('genres');
    this.enhancedSearch.hideSearchInterface();
    this.progressiveLoader.stop();
    this.ui.showLoading();
    try {
      const data = await this.api.getGenresByCategory(category);
      this.display.displayGenresInCategory(category, data);
    } catch (error: any) {
      const msg = this.api.handleAPIError(error, 'showGenresInCategory');
      this.ui.showError(msg);
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
    } catch (error: any) {
      const msg = this.api.handleAPIError(error, 'showSeries');
      this.ui.showError(msg);
    }
  }

  async showSeriesDetails(seriesId: string | number) {
    this.currentSection = 'series';
    this.ui.updateActiveNavigation('series');
    this.enhancedSearch.hideSearchInterface();
    this.progressiveLoader.stop();
    this.ui.showLoading();
    try {
      const data = await this.api.getSeriesById(seriesId);
      this.display.displaySeriesDetails(data);
    } catch (error: any) {
      const msg = this.api.handleAPIError(error, 'showSeriesDetails');
      this.ui.showError(msg);
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
    } catch (error: any) {
      const msg = this.api.handleAPIError(error, 'showAdmin');
      this.ui.showError(msg);
    }
  }

  async performSearch() {
    const input = document.getElementById('searchInput') as HTMLInputElement | null;
    const query = (input?.value || '').trim();
    if (!query) {
      this.ui.showToast('Ошибка', 'Введите поисковый запрос', 'error');
      return;
    }
    if (this.currentSection === 'books') {
      const booksQueryInput = document.getElementById('books-search-query') as HTMLInputElement | null;
      if (booksQueryInput) {
        booksQueryInput.value = query;
        this.enhancedSearch.performSearch('books');
      }
    } else if (this.currentSection === 'authors') {
      const authorsQueryInput = document.getElementById('authors-search-query') as HTMLInputElement | null;
      if (authorsQueryInput) {
        authorsQueryInput.value = query;
        this.enhancedSearch.performSearch('authors');
      }
    } else {
      this.showBooks();
      setTimeout(() => {
        const booksQueryInput = document.getElementById('books-search-query') as HTMLInputElement | null;
        if (booksQueryInput) {
          booksQueryInput.value = query;
          this.enhancedSearch.performSearch('books');
        }
      }, 100);
    }
  }

  async showBookDetails(bookId: string) {
    try {
      const data = await this.api.getBookDetails(bookId);
      this.display.displayBookDetails(data);
    } catch (error: any) {
      const msg = this.api.handleAPIError(error, 'showBookDetails');
      this.ui.showToast('Ошибка', msg, 'error');
    }
  }

  async downloadBook(bookId: string, format: string | null = null) {
    try {
      await this.api.downloadBook(bookId, format);
      this.ui.showToast('Успех', 'Книга загружается...', 'success');
    } catch (error: any) {
      const msg = this.api.handleAPIError(error, 'downloadBook');
      this.ui.showToast('Ошибка', msg, 'error');
    }
  }

  static getInstance(): FlibustaAppNG {
    if (!FlibustaAppNG.instance) FlibustaAppNG.instance = new FlibustaAppNG();
    return FlibustaAppNG.instance;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  (window as any).app = FlibustaAppNG.getInstance();
});
