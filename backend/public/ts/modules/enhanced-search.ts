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
    const booksSearchHtml = `
      <div id="books-search-interface" class="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
        <div class="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
          <div class="flex-1">
            <label class="block text-sm text-gray-300 mb-1" for="books-search-query">Запрос</label>
            <input id="books-search-query" placeholder="Название, автор..." class="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm text-gray-300 mb-1" for="books-search-genre">Жанр</label>
            <input id="books-search-genre" placeholder="например, Фантастика" class="w-44 px-3 py-2 rounded bg-gray-900 border border-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm text-gray-300 mb-1" for="books-search-series">Серия</label>
            <input id="books-search-series" placeholder="например, Ведьмак" class="w-44 px-3 py-2 rounded bg-gray-900 border border-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm text-gray-300 mb-1" for="books-search-year">Год</label>
            <input id="books-search-year" type="number" min="1800" max="2100" placeholder="Год" class="w-28 px-3 py-2 rounded bg-gray-900 border border-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm text-gray-300 mb-1" for="books-sort-select">Сортировка</label>
            <select id="books-sort-select" class="w-44 px-3 py-2 rounded bg-gray-900 border border-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="relevance">По релевантности</option>
              <option value="date">По дате (новые)</option>
              <option value="title">Название A→Z</option>
              <option value="title_desc">Название Z→A</option>
              <option value="author">Автор A→Z</option>
              <option value="author_desc">Автор Z→A</option>
              <option value="year">Год ↑</option>
              <option value="year_desc">Год ↓</option>
              <option value="rating">Рейтинг ↓</option>
              <option value="rating_asc">Рейтинг ↑</option>
            </select>
          </div>
          <div class="flex gap-2">
            <button id="books-clear-filters" class="px-3 py-2 rounded bg-gray-900 border border-gray-700 text-gray-200 hover:bg-gray-700">Сброс</button>
            <button id="books-search-button" class="px-3 py-2 rounded bg-gradient-to-r from-blue-600 to-purple-600 text-white" type="button">Найти</button>
          </div>
        </div>
        <div class="text-sm text-gray-400 mt-2">Найдено: <span id="books-results-count">—</span></div>
      </div>`;
    const contentArea = document.getElementById('contentArea'); if (contentArea) contentArea.insertAdjacentHTML('afterbegin', booksSearchHtml);
  }
  createAuthorsSearchInterface() {
    const authorsSearchHtml = `
      <div id="authors-search-interface" class="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4" style="display:none;">
        <div class="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
          <div class="flex-1">
            <label class="block text-sm text-gray-300 mb-1" for="authors-search-query">Запрос</label>
            <input id="authors-search-query" placeholder="Имя автора" class="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm text-gray-300 mb-1" for="authors-letter-select">Буква</label>
            <select id="authors-letter-select" class="w-32 px-3 py-2 rounded bg-gray-900 border border-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Все</option>
              <option>A</option><option>B</option><option>C</option><option>D</option><option>E</option>
              <option>F</option><option>G</option><option>H</option><option>I</option><option>J</option>
              <option>K</option><option>L</option><option>M</option><option>N</option><option>O</option>
              <option>P</option><option>Q</option><option>R</option><option>S</option><option>T</option>
              <option>U</option><option>V</option><option>W</option><option>X</option><option>Y</option><option>Z</option>
              <option>А</option><option>Б</option><option>В</option><option>Г</option><option>Д</option><option>Е</option><option>Ж</option><option>З</option><option>И</option><option>Й</option>
              <option>К</option><option>Л</option><option>М</option><option>Н</option><option>О</option><option>П</option><option>Р</option><option>С</option><option>Т</option>
              <option>У</option><option>Ф</option><option>Х</option><option>Ц</option><option>Ч</option><option>Ш</option><option>Щ</option><option>Э</option><option>Ю</option><option>Я</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-300 mb-1" for="authors-sort-select">Сортировка</label>
            <select id="authors-sort-select" class="w-44 px-3 py-2 rounded bg-gray-900 border border-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="relevance">По релевантности</option>
              <option value="name">Имя A→Z</option>
              <option value="books">По количеству книг</option>
            </select>
          </div>
          <div class="flex gap-2">
            <button id="authors-clear-filters" class="px-3 py-2 rounded bg-gray-900 border border-gray-700 text-gray-200 hover:bg-gray-700">Сброс</button>
            <button id="authors-search-button" class="px-3 py-2 rounded bg-gradient-to-r from-blue-600 to-purple-600 text-white" type="button">Найти</button>
          </div>
        </div>
        <div class="text-sm text-gray-400 mt-2">Найдено: <span id="authors-results-count">—</span></div>
      </div>`;
    const contentArea = document.getElementById('contentArea'); if (contentArea) contentArea.insertAdjacentHTML('afterbegin', authorsSearchHtml);
  }
  bindEvents() { this.bindBooksSearchEvents(); this.bindAuthorsSearchEvents(); }
  bindBooksSearchEvents() {
    const q = document.getElementById('books-search-query'); const g = document.getElementById('books-search-genre'); const s = document.getElementById('books-search-series'); const y = document.getElementById('books-search-year'); const sort = document.getElementById('books-sort-select'); const clr = document.getElementById('books-clear-filters'); const btn = document.getElementById('books-search-button');
    q?.addEventListener('input', () => this.debouncedSearch('books'));
    g?.addEventListener('input', () => this.debouncedSearch('books'));
    s?.addEventListener('input', () => this.debouncedSearch('books'));
    y?.addEventListener('input', () => this.debouncedSearch('books'));
    sort?.addEventListener('change', () => this.debouncedSearch('books'));
    clr?.addEventListener('click', (e) => { e.preventDefault(); this.clearBooksFilters(); });
    btn?.addEventListener('click', (e) => { e.preventDefault(); this.performSearch('books'); });
  }
  bindAuthorsSearchEvents() {
    const q = document.getElementById('authors-search-query'); const l = document.getElementById('authors-letter-select'); const sort = document.getElementById('authors-sort-select'); const clr = document.getElementById('authors-clear-filters'); const btn = document.getElementById('authors-search-button');
    q?.addEventListener('input', () => this.debouncedSearch('authors'));
    l?.addEventListener('change', () => this.debouncedSearch('authors'));
    sort?.addEventListener('change', () => this.debouncedSearch('authors'));
    clr?.addEventListener('click', (e) => { e.preventDefault(); this.clearAuthorsFilters(); });
    btn?.addEventListener('click', (e) => { e.preventDefault(); this.performSearch('authors'); });
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
