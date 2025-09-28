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

    // Bind global admin create-user handler early so inline onclick works reliably
    (window as any)._adminCreateUser = async () => {
      console.log('[Admin] Create user button clicked');
      try { this.ui?.showToast?.('Создание','Обработка формы…','info'); } catch {}
      const btn = document.getElementById('admin-create-user-btn') as HTMLButtonElement | null;
      const u = document.getElementById('new-username') as HTMLInputElement | null;
      const p = document.getElementById('new-password') as HTMLInputElement | null;
      const dn = document.getElementById('new-display') as HTMLInputElement | null;
      const em = document.getElementById('new-email') as HTMLInputElement | null;
      const rl = document.getElementById('new-role') as HTMLSelectElement | null;
      const username = (u?.value || '').trim();
      const password = p?.value || '';
      if (!username || username.length < 3) {
        this.ui?.showToast?.('Ошибка','Минимум 3 символа в логине','error');
        alert('Минимум 3 символа в логине');
        return;
      }
      if (!password || password.length < 6) {
        this.ui?.showToast?.('Ошибка','Минимум 6 символов в пароле','error');
        alert('Минимум 6 символов в пароле');
        return;
      }
      try {
        if (btn) { btn.disabled = true; btn.textContent = 'Создание...'; }
        const payload: any = { username, password };
        if (dn?.value) payload.display_name = dn.value.trim();
        if (em?.value) payload.email = em.value.trim();
        payload.role = (rl?.value) || 'user';
        const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Не удалось создать пользователя');
        this.ui?.showToast?.('Успех','Пользователь создан','success');
        this.showAdmin();
      } catch (e: any) {
        const msg = (e?.message || e || 'Ошибка создания пользователя').toString();
        try { this.api?.handleAPIError?.(e, 'createUser'); } catch {}
        if (!(document.getElementById('toast') as HTMLElement)?.style?.display) { alert(msg); }
      } finally { if (btn) { btn.disabled = false; btn.textContent = 'Создать'; } }
    };

    // Delegated click handler as a safety net (captures events even if inline handler fails)
    document.addEventListener('click', (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const btn = target.id === 'admin-create-user-btn' ? target : target.closest?.('#admin-create-user-btn');
      if (btn) {
        ev.preventDefault();
        (window as any)._adminCreateUser?.();
      }
    }, true);

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
      // Wire click listener directly to button element (no inline onclick needed)
      setTimeout(() => {
        const btn = document.getElementById('admin-create-user-btn');
        if (btn && !(btn as any)._wired) {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[Admin] Direct click listener fired');
            (window as any)._adminCreateUser?.();
          });
          (btn as any)._wired = true;
        }
      }, 100);
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
      this.enhancedSearch.hideSearchInterface();
      this.progressiveLoader.stop();
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
