// Enhanced Search Module - advanced search with filters and sorting (TypeScript)
class EnhancedSearch {
  app: any;
  currentFilters: any;
  currentSort: any;
  searchTimeout: any;
  constructor(app: any) { this.app = app; this.currentFilters = {}; this.currentSort = {}; this.searchTimeout = null; this.init(); }
  init() { this.createSearchInterface(); this.bindEvents(); }
  createSearchInterface() { this.createBooksSearchInterface(); this.createAuthorsSearchInterface(); }
  createBooksSearchInterface() {
    const booksSearchHtml = `...`;
    const contentArea = document.getElementById('contentArea'); if (contentArea) contentArea.insertAdjacentHTML('afterbegin', booksSearchHtml);
  }
  createAuthorsSearchInterface() {
    const authorsSearchHtml = `...`;
    const contentArea = document.getElementById('contentArea'); if (contentArea) contentArea.insertAdjacentHTML('afterbegin', authorsSearchHtml);
  }
  bindEvents() { this.bindBooksSearchEvents(); this.bindAuthorsSearchEvents(); }
  bindBooksSearchEvents() {
    const q = document.getElementById('books-search-query'); const g = document.getElementById('books-search-genre'); const s = document.getElementById('books-search-series'); const y = document.getElementById('books-search-year'); const sort = document.getElementById('books-sort-select'); const clr = document.getElementById('books-clear-filters');
    q?.addEventListener('input', () => this.debouncedSearch('books')); g?.addEventListener('input', () => this.debouncedSearch('books')); s?.addEventListener('input', () => this.debouncedSearch('books')); y?.addEventListener('input', () => this.debouncedSearch('books')); sort?.addEventListener('change', () => this.debouncedSearch('books')); clr?.addEventListener('click', () => this.clearBooksFilters());
  }
  bindAuthorsSearchEvents() {
    const q = document.getElementById('authors-search-query'); const l = document.getElementById('authors-letter-select'); const sort = document.getElementById('authors-sort-select'); const clr = document.getElementById('authors-clear-filters');
    q?.addEventListener('input', () => this.debouncedSearch('authors')); l?.addEventListener('change', () => this.debouncedSearch('authors')); sort?.addEventListener('change', () => this.debouncedSearch('authors')); clr?.addEventListener('click', () => this.clearAuthorsFilters());
  }
  debouncedSearch(section: string) { clearTimeout(this.searchTimeout); this.searchTimeout = setTimeout(() => this.performSearch(section), 300); }
  async performSearch(section: string) {
    const filters = this.getFilters(section); const sort = this.getSort(section); const smartSort = this.getSmartSortOption(section, filters, sort);
    if (section === 'books') this.app.progressiveLoader.updateSearchParams({ query: filters.query, genre: filters.genre, series: filters.series, year: filters.year, sort: smartSort });
    else if (section === 'authors') this.app.progressiveLoader.updateSearchParams({ query: filters.query, letter: filters.letter, sort: smartSort });
  }
  getSmartSortOption(section: string, filters: any, currentSort: string) {
    if (currentSort && currentSort !== 'relevance') return currentSort;
    if (section === 'books') { if (filters.query) return 'relevance'; if (filters.genre || filters.series || filters.year) return 'date'; return 'date'; }
    if (section === 'authors') { if (filters.query) return 'relevance'; if (filters.letter) return 'name'; return 'books'; }
    return 'relevance';
  }
  getFilters(section: string) {
    if (section === 'books') return { query: (document.getElementById('books-search-query') as HTMLInputElement)?.value || '', genre: (document.getElementById('books-search-genre') as HTMLInputElement)?.value || '', series: (document.getElementById('books-search-series') as HTMLInputElement)?.value || '', year: (document.getElementById('books-search-year') as HTMLInputElement)?.value || '' };
    if (section === 'authors') return { query: (document.getElementById('authors-search-query') as HTMLInputElement)?.value || '', letter: (document.getElementById('authors-letter-select') as HTMLSelectElement)?.value || '' };
    return {};
  }
  getSort(section: string) { if (section === 'books') return (document.getElementById('books-sort-select') as HTMLSelectElement)?.value || 'date'; if (section === 'authors') return (document.getElementById('authors-sort-select') as HTMLSelectElement)?.value || 'name'; return ''; }
  clearBooksFilters() { (document.getElementById('books-search-query') as HTMLInputElement).value = ''; (document.getElementById('books-search-genre') as HTMLInputElement).value = ''; (document.getElementById('books-search-series') as HTMLInputElement).value = ''; (document.getElementById('books-search-year') as HTMLInputElement).value = ''; (document.getElementById('books-sort-select') as HTMLSelectElement).value = 'relevance'; this.performSearch('books'); }
  clearAuthorsFilters() { (document.getElementById('authors-search-query') as HTMLInputElement).value = ''; (document.getElementById('authors-letter-select') as HTMLSelectElement).value = ''; (document.getElementById('authors-sort-select') as HTMLSelectElement).value = 'relevance'; this.performSearch('authors'); }
  showSearchInterface(section: string) { const b = document.getElementById('books-search-interface'); const a = document.getElementById('authors-search-interface'); if (b) b.style.display = 'none'; if (a) a.style.display = 'none'; if (section === 'books') { if (b) b.style.display = 'block'; } else if (section === 'authors') { if (a) a.style.display = 'block'; } }
  hideSearchInterface() { const b = document.getElementById('books-search-interface'); const a = document.getElementById('authors-search-interface'); if (b) b.style.display = 'none'; if (a) a.style.display = 'none'; }
  updateResultsCount(section: string, count: number) { const el = document.getElementById(`${section}-results-count`); if (el) el.textContent = `${count} результатов`; }
}

// Expose globally
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).EnhancedSearch = (window as any).EnhancedSearch || EnhancedSearch;
