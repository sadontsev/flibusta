// @ts-nocheck
// Display Module - Handles data display and rendering (TypeScript)
class DisplayModuleNG {
  app: any;
  constructor(app: any) { this.app = app; }
  generatePlaceholderSVG(title: string) {
    const shortTitle = title.substring(0, 20);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" preserveAspectRatio="xMidYMid meet">
        <rect width="200" height="300" fill="#374151"/>
        <rect x="10" y="10" width="180" height="280" fill="#4B5563" stroke="#6B7280" stroke-width="2"/>
        <text x="100" y="150" font-family="Arial, sans-serif" font-size="14" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle">${shortTitle}</text>
        <text x="100" y="170" font-family="Arial, sans-serif" font-size="12" fill="#9CA3AF" text-anchor="middle" dominant-baseline="middle">Обложка</text>
        <text x="100" y="190" font-family="Arial, sans-serif" font-size="12" fill="#9CA3AF" text-anchor="middle" dominant-baseline="middle">недоступна</text>
      </svg>
    `)}`;
  }
  displayBooks(data: any[]) {
    if (!data || data.length === 0) { this.app.ui.setContent(`<div class="text-center py-12"><i class="fas fa-book-open text-gray-500 text-4xl mb-4"></i><h3 class="text-xl font-semibold text-white mb-2">Книги не найдены</h3><p class="text-gray-400">Попробуйте изменить параметры поиска</p></div>`); return; }
    let html = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">`;
    data.forEach((book: any) => {
      const authorName = book.authors && book.authors.length > 0 ? `${book.authors[0].lastname} ${book.authors[0].firstname}`.trim() : 'Неизвестный автор';
      const formatBadge = book.filetype ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">${book.filetype.toUpperCase()}</span>` : '';
      const coverUrl = book.cover_url || this.generatePlaceholderSVG(book.title);
      const fileSize = book.filesize ? (parseInt(book.filesize) / 1024 / 1024).toFixed(1) + ' MB' : '';
  html += `<div class="bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"><div class="relative bg-gray-900 cover-aspect"><img src="${coverUrl}" alt="${book.title}" class="w-full h-full object-contain" onerror="this.src='${this.generatePlaceholderSVG(book.title)}'"><div class="absolute top-2 right-2">${formatBadge}</div></div><div class="p-4"><h3 class="text-lg font-semibold text-white mb-2 line-clamp-2" title="${book.title}">${book.title}</h3><p class="text-gray-300 text-sm mb-2">${authorName}</p><div class="flex items-center justify-between text-sm text-gray-400 mb-3"><span>${book.year || 'Год не указан'}</span><span>${fileSize}</span></div><button class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105" onclick="app.showBookDetails('${book.bookid}')"><i class="fas fa-eye mr-2"></i>Подробнее</button></div></div>`;
    });
    html += '</div>'; this.app.ui.setContent(html);
  }
  displaySearchResults(data: any[]) {
    if (!data || data.length === 0) { this.app.ui.setContent(`<div class=\"text-center py-12\"><i class=\"fas fa-search text-gray-500 text-4xl mb-4\"></i><h3 class=\"text-xl font-semibold text-white mb-2\">Результаты не найдены</h3><p class=\"text-gray-400\">Попробуйте изменить поисковый запрос</p></div>`); return; }
    let html = `<div class="mb-6"><h2 class="text-2xl font-bold text-white mb-2">Результаты поиска</h2><p class="text-gray-400">Найдено книг: ${data.length}</p></div><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">`;
    data.forEach((book: any) => {
      const authorName = book.authors && book.authors.length > 0 ? `${book.authors[0].lastname} ${book.authors[0].firstname}`.trim() : 'Неизвестный автор';
      const formatBadge = book.filetype ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">${book.filetype.toUpperCase()}</span>` : '';
      const coverUrl = book.cover_url || this.generatePlaceholderSVG(book.title);
      const fileSize = book.filesize ? (parseInt(book.filesize) / 1024 / 1024).toFixed(1) + ' MB' : '';
  html += `<div class=\"bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden\"><div class=\"relative bg-gray-900\"><img src=\"${coverUrl}\" alt=\"${book.title}\" class=\"w-full h-64 object-contain\" onerror=\"this.src='${this.generatePlaceholderSVG(book.title)}'\"><div class=\"absolute top-2 right-2\">${formatBadge}</div></div><div class=\"p-4\"><h3 class=\"text-lg font-semibold text-white mb-2 line-clamp-2\" title=\"${book.title}\">${book.title}</h3><p class=\"text-gray-300 text-sm mb-2\">${authorName}</p><div class=\"flex items-center justify-between text-sm text-gray-400 mb-3\"><span>${book.year || 'Год не указан'}</span><span>${fileSize}</span></div><button class=\"w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105\" onclick=\"app.showBookDetails('${book.bookid}')\"><i class=\"fas fa-eye mr-2\"></i>Подробнее</button></div></div>`;
    });
    html += '</div>'; this.app.ui.setContent(html);
  }
  displayAuthors(data: any[]) {
    if (!data || data.length === 0) {
      this.app.ui.setContent(`<div class="text-center py-12"><i class="fas fa-user text-gray-500 text-4xl mb-4"></i><h3 class="text-xl font-semibold text-white mb-2">Авторы не найдены</h3><p class="text-gray-400">Попробуйте изменить параметры поиска</p></div>`);
      return;
    }
    let html = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">`;
    data.forEach((author: any) => {
      const authorName = `${author.lastname || ''} ${author.firstname || ''} ${author.nickname || ''}`.trim() || 'Неизвестный автор';
      const count = author.book_count || 0;
      html += `<div class="bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6">
        <div class="text-center">
          <div class="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-user text-white text-2xl"></i>
          </div>
          <h3 class="text-lg font-semibold text-white mb-2 line-clamp-2" title="${authorName}">${authorName}</h3>
          <p class="text-gray-400 text-sm mb-4">Книг: ${count}</p>
          <button class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg" onclick="app.showAuthorBooks('${author.avtorid}')">
            <i class="fas fa-books mr-2"></i>Книги автора
          </button>
        </div>
      </div>`;
    });
    html += '</div>';
    this.app.ui.setContent(html);
  }
  displayGenres(data: any[]) {
    if (!data || data.length === 0) {
      this.app.ui.setContent(`<div class="text-center py-12"><i class="fas fa-tags text-gray-500 text-4xl mb-4"></i><h3 class="text-xl font-semibold text-white mb-2">Жанры не найдены</h3></div>`);
      return;
    }
    // If items have 'category', treat these as genre categories; clicking shows sub-genres list
    const looksLikeCategories = data.length > 0 && Object.prototype.hasOwnProperty.call(data[0], 'category') && !Object.prototype.hasOwnProperty.call(data[0], 'genrecode');
    let html = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">`;
    data.forEach((genre: any) => {
      const name = genre.category || genre.genredesc || genre.genre || 'Без названия';
      const safeName = String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const count = genre.book_count || genre.count || 0;
      const primaryAction = looksLikeCategories
        ? `<button class=\"w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg\" onclick=\"app.showGenresInCategory('${safeName}')\">Открыть</button>`
        : `<button class=\"w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg\" onclick=\"app.progressiveLoader.start('books', { genre: '${safeName}' })\">Показать книги</button>`;
      html += `<div class="bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
        <h3 class="text-lg font-semibold text-white mb-2">${name}</h3>
        <p class="text-gray-400 text-sm mb-4">Книг: ${count}</p>
        ${primaryAction}
      </div>`;
    });
    html += '</div>';
    this.app.ui.setContent(html);
  }
  displayGenresInCategory(category: string, data: any[]) {
    const safeCategory = String(category || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = `<div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-white mb-1">Жанры: ${safeCategory}</h2>
        <p class="text-gray-400">Выберите конкретный жанр или показывайте все книги в категории</p>
      </div>
      <div class="flex gap-2">
        <button class="bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg border border-gray-700" onclick="app.showGenres()">Назад</button>
        <button class="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg" onclick="app.progressiveLoader.start('books', { genre: '${safeCategory}' })">Все книги категории</button>
      </div>
    </div>`;
    if (!data || data.length === 0) {
      html += `<div class=\"text-gray-400\">В этой категории жанры не найдены.</div>`;
      this.app.ui.setContent(html);
      return;
    }
    html += `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">`;
    data.forEach((g: any) => {
      const name = g.genredesc || g.genre || 'Без названия';
      const safeName = String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const count = g.book_count || g.count || 0;
      html += `<div class="bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
        <h3 class="text-lg font-semibold text-white mb-2">${name}</h3>
        <p class="text-gray-400 text-sm mb-4">Книг: ${count}</p>
        <button class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg" onclick="app.progressiveLoader.start('books', { genre: '${safeName}' })">Показать книги</button>
      </div>`;
    });
    html += '</div>';
    this.app.ui.setContent(html);
  }
  displaySeries(data: any[]) {
    if (!data || data.length === 0) {
      this.app.ui.setContent(`<div class="text-center py-12"><i class="fas fa-layer-group text-gray-500 text-4xl mb-4"></i><h3 class="text-xl font-semibold text-white mb-2">Серии не найдены</h3></div>`);
      return;
    }
    let html = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">`;
    data.forEach((series: any) => {
      const name = series.seqname || series.name || series.seq || 'Без названия';
      const count = series.book_count || series.count || 0;
      const id = series.seqid || series.id || '';
      const safeName = String(name).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html += `<div class="bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
        <h3 class="text-lg font-semibold text-white mb-2">${safeName}</h3>
        <p class="text-gray-400 text-sm mb-4">Книг: ${count}</p>
        <div class="flex gap-2">
          <button class="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg" onclick="app.progressiveLoader.start('books', { series: '${safeName}' })">Показать книги</button>
          ${id ? `<button class="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg border border-gray-700" onclick="app.showSeriesDetails('${id}')">Подробнее</button>` : ''}
        </div>
      </div>`;
    });
    html += '</div>';
    this.app.ui.setContent(html);
  }
  displaySeriesDetails(series: any) {
    if (!series) { this.app.ui.showError('Серия не найдена'); return; }
    const safeName = String(series.seqname || series.name || 'Без названия').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = `<div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-white mb-1">Серия: ${safeName}</h2>
        <p class="text-gray-400">Книг в серии: ${series.bookCount || series.book_count || (series.books?.length || 0)}</p>
      </div>
      <div>
        <button class="bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg border border-gray-700" onclick="app.showSeries()">Назад</button>
      </div>
    </div>`;
    const books = Array.isArray(series.books) ? series.books : [];
    if (books.length === 0) {
      html += `<div class=\"text-gray-400\">Для этой серии книги не найдены.</div>`;
      this.app.ui.setContent(html); return;
    }
    html += `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">`;
    books.forEach((book: any) => {
      const authorName = book.lastname || book.firstname ? `${book.lastname || ''} ${book.firstname || ''}`.trim() : '';
      const coverUrl = book.cover_url || this.generatePlaceholderSVG(book.title || '');
      const size = book.filesize ? (parseInt(book.filesize, 10) / 1024 / 1024).toFixed(1) + ' MB' : '';
      const fmt = book.filetype ? `<span class=\"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800\">${String(book.filetype).toUpperCase()}</span>` : '';
  html += `<div class="bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"><div class="relative bg-gray-900 cover-aspect"><img src="${coverUrl}" alt="${book.title || ''}" class="w-full h-full object-contain" onerror="this.src='${this.generatePlaceholderSVG(book.title || '')}'"><div class="absolute top-2 right-2">${fmt}</div></div><div class="p-4"><h3 class="text-lg font-semibold text-white mb-2 line-clamp-2" title="${book.title || ''}">${book.title || ''}</h3><p class="text-gray-300 text-sm mb-2">${authorName || 'Неизвестный автор'}</p><div class="flex items-center justify-between text-sm text-gray-400 mb-3"><span>${book.year || 'Год не указан'}</span><span>${size}</span></div><button class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105" onclick="app.showBookDetails('${book.bookid}')"><i class="fas fa-eye mr-2"></i>Подробнее</button></div></div>`;
    });
    html += '</div>';
    this.app.ui.setContent(html);
  }
  displayAdminPanel(data: any) {
    // Minimal placeholder; can be expanded.
    this.app.ui.setContent(`<div class="text-center py-12"><i class="fas fa-user-shield text-gray-500 text-4xl mb-4"></i><h3 class="text-xl font-semibold text-white mb-2">Панель администратора</h3><p class="text-gray-400">Данные загружены.</p></div>`);
  }
  displayHome() {
    const html = `
      <div class="text-center py-16">
        <i class="fas fa-book text-blue-400 text-6xl mb-4"></i>
        <h1 class="text-3xl font-bold text-white mb-2">Добро пожаловать</h1>
        <p class="text-gray-300 mb-6">Начните с поиска или откройте раздел "Книги". Подсказка: нажмите Enter в поле поиска.</p>
        <div class="flex items-center justify-center gap-3">
          <button class="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg" onclick="app.showBooks()">Книги</button>
          <button class="bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg border border-gray-700" onclick="app.showAuthors()">Авторы</button>
        </div>
      </div>`;
    this.app.ui.setContent(html);
  }
  displayBookDetails(book: any) {
    if (!book) {
      this.app.ui.showError('Детали книги недоступны');
      return;
    }

    const authors = Array.isArray(book.authors) && book.authors.length > 0
      ? book.authors.map((a: any) => [a.lastname, a.firstname, a.nickname].filter(Boolean).join(' ')).join(', ')
      : 'Неизвестный автор';

    const genres = Array.isArray(book.genres) && book.genres.length > 0
      ? book.genres.map((g: any) => g.name || g.genre || '').filter(Boolean).join(', ')
      : '';

    const series = Array.isArray(book.series) && book.series.length > 0
      ? book.series.map((s: any) => s.name || s.seq || '').filter(Boolean).join(', ')
      : '';

    const filetype = (book.filetype || '').toString();
    const original = (book.original_filetype || '').toString();
    const showFormatHint = original && filetype && original.toLowerCase() !== filetype.toLowerCase();

    const coverUrl = book.cover_url || this.generatePlaceholderSVG(book.title || '');
    const fileSize = book.filesize ? `${(parseInt(book.filesize, 10) / 1024 / 1024).toFixed(1)} MB` : '';

    const formatHintHtml = showFormatHint ? `
      <div class="mt-4 p-3 rounded bg-yellow-900/50 border border-yellow-700 text-yellow-200">
        <div class="flex items-center gap-2">
          <i class="fas fa-info-circle"></i>
          <div>
            <div class="font-medium">Доступный формат отличается от исходного</div>
            <div class="text-sm">Исходный: <b>${original.toUpperCase()}</b>, доступный к скачиванию: <b>${filetype.toUpperCase()}</b>.</div>
          </div>
        </div>
      </div>` : '';

    const html = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div class="bg-gray-900 rounded-lg shadow-lg cover-aspect">
            <img src="${coverUrl}" alt="${book.title}" class="w-full h-full object-contain" onerror="this.src='${this.generatePlaceholderSVG(book.title || '')}'">
          </div>
        </div>
        <div class="md:col-span-2">
          <h1 class="text-3xl font-bold text-white mb-2">${book.title || 'Без названия'}</h1>
          <div class="text-gray-300 mb-4">${authors}</div>
          <div class="flex flex-wrap items-center gap-3 mb-4 text-sm">
            ${book.year ? `<span class="px-2 py-1 bg-gray-800 rounded border border-gray-700 text-gray-300">Год: ${book.year}</span>` : ''}
            ${genres ? `<span class="px-2 py-1 bg-gray-800 rounded border border-gray-700 text-gray-300">Жанры: ${genres}</span>` : ''}
            ${series ? `<span class="px-2 py-1 bg-gray-800 rounded border border-gray-700 text-gray-300">Серии: ${series}</span>` : ''}
            ${fileSize ? `<span class="px-2 py-1 bg-gray-800 rounded border border-gray-700 text-gray-300">Размер: ${fileSize}</span>` : ''}
            ${filetype ? `<span class="px-2 py-1 bg-blue-900/50 rounded border border-blue-700 text-blue-200">Формат: ${filetype.toUpperCase()}</span>` : ''}
          </div>
          ${formatHintHtml}
          <div class="mt-6 flex flex-wrap gap-3">
            <button class="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200" onclick="app.downloadBook('${book.bookid}')">
              <i class="fas fa-download mr-2"></i>Скачать
            </button>
            <button class="bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg border border-gray-700 transition-all duration-200" onclick="app.showBooks()">
              <i class="fas fa-arrow-left mr-2"></i>Назад к списку
            </button>
          </div>
          ${book.annotation ? `<div class="mt-8 prose prose-invert max-w-none"><h2 class="text-xl font-semibold mb-3">Аннотация</h2><div class="text-gray-200">${book.annotation}</div></div>` : ''}
        </div>
      </div>`;

    this.app.ui.setContent(html);
  }
  displayAdminUpdates() { /* omitted */ }
}

// Expose globally
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).DisplayModule = (window as any).DisplayModule || DisplayModuleNG;
