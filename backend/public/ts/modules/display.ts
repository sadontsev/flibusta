// @ts-nocheck
// Display Module - Handles data display and rendering (TypeScript)
class DisplayModuleNG {
  app: any;
  _updatePollTimer: any;
  constructor(app: any) { this.app = app; }
  clearUpdatePoll() { if (this._updatePollTimer) { clearInterval(this._updatePollTimer); this._updatePollTimer = null; } }
  startUpdateRun(type: 'sql'|'daily'|'covers'|'mappings'|'full') {
    (async () => {
      try {
        const resp = await this.app.api.startUpdate(type);
        if (resp?.success) {
          this.app.ui.showToast('Запущено', `Операция ${type} запущена`, 'info');
          this.pollUpdateStatus(true);
        } else {
          this.app.ui.showToast('Ошибка', 'Не удалось запустить операцию', 'error');
        }
      } catch (e: any) {
        const msg = String(e?.message || 'Сбой запуска');
        if (msg.includes('409')) {
          this.app.ui.showToast('Занято', 'Уже выполняется другая операция', 'info');
          this.pollUpdateStatus(true);
        } else {
          this.app.api.handleAPIError(e, 'startUpdateRun');
        }
      }
    })();
  }
  renderUpdateProgress(progress: any) {
    const container = document.getElementById('admin-update-progress');
    if (!container) return;
    if (!progress) { container.innerHTML = ''; return; }
    const total = Math.max(1, parseInt(String(progress.total || 0), 10));
    const idx = Math.min(total, parseInt(String(progress.currentIndex || 0), 10));
    const done = !!progress.completedAt;
    const pct = done ? 100 : Math.max(5, Math.min(99, Math.floor((idx / total) * 100)));
    const type = (progress.type || '').toString();
    const step = (progress.step || '').toString();
    const msg = (progress.message || '').toString();
    const ok = parseInt(String(progress.successes || 0), 10);
    const err = parseInt(String(progress.errors || 0), 10);
    const updatedAt = progress.updatedAt ? new Date(progress.updatedAt).toLocaleTimeString() : '';
    container.innerHTML = `
      <div class="mt-4 bg-gray-900 border border-gray-700 rounded p-4">
        <div class="flex items-center justify-between mb-2">
          <div class="text-white font-medium">Текущая операция: ${type || '—'}</div>
          <div class="text-gray-400 text-sm">${updatedAt}</div>
        </div>
        <div class="text-gray-300 text-sm mb-2">Шаг: ${step || '—'}${msg ? ` • ${msg}` : ''}</div>
        <div class="w-full bg-gray-800 rounded h-2 overflow-hidden">
          <div class="h-2 bg-gradient-to-r from-blue-600 to-purple-600" style="width:${pct}%; transition: width .2s ease;"></div>
        </div>
        <div class="flex items-center justify-between text-gray-400 text-sm mt-2">
          <div>Прогресс: ${idx}/${total}</div>
          <div>
            <span class="text-green-400">Успешно: ${ok}</span>
            <span class="ml-3 text-red-400">Ошибки: ${err}</span>
          </div>
        </div>
      </div>`;
  }
  async pollUpdateStatus(immediate = false) {
    this.clearUpdatePoll();
    const tick = async () => {
      try {
        const st = await this.app.api.getUpdateStatus();
        const status = st?.data || st; // API returns { success, data }
        const isRunning = !!status?.isRunning;
        const progress = status?.progress;
        this.renderUpdateProgress(progress);
        const busyBadge = document.getElementById('admin-update-badge');
        if (busyBadge) busyBadge.style.display = isRunning ? 'inline-block' : 'none';
        if (!isRunning) { this.clearUpdatePoll(); }
      } catch {
        this.clearUpdatePoll();
      }
    };
    if (immediate) { tick(); }
    this._updatePollTimer = setInterval(tick, 1500);
  }
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
    const stats = data?.stats || {};
    const schedules = data?.automatedUpdates?.schedules || [];
    const lastDaily = data?.automatedUpdates?.lastDailyUpdate || null;
  const isRunning = !!data?.updateStatus?.isRunning;
  const progress = data?.updateStatus?.progress;
    const recentUsers = Array.isArray(data?.users) ? data.users : [];

    const statCard = (label: string, value: number | string, icon: string) => `
      <div class="bg-gray-800 rounded-lg p-5 border border-gray-700 shadow">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-gray-400 text-sm">${label}</div>
            <div class="text-2xl font-semibold text-white mt-1">${value ?? '-'}</div>
          </div>
          <i class="${icon} text-gray-400 text-2xl"></i>
        </div>
      </div>`;

    const scheduleRow = (s: any) => {
      const type = s.update_type;
      const enabled = !!s.enabled;
      const cron = s.cron_expression || '';
      const lastRun = s.last_run ? new Date(s.last_run).toLocaleString() : '—';
      return `
        <tr>
          <td class="py-2 px-3 text-white">${type}</td>
          <td class="py-2 px-3"><span class="${enabled ? 'text-green-400' : 'text-gray-400'}">${enabled ? 'вкл' : 'выкл'}</span></td>
          <td class="py-2 px-3"><input id="cron-${type}" value="${cron}" class="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-200 w-full" /></td>
          <td class="py-2 px-3 text-gray-300">${lastRun}</td>
          <td class="py-2 px-3">
            <div class="flex gap-2">
              <button class="btn btn-xs bg-gray-800 border border-gray-700 text-white px-3 py-1 rounded" onclick="(async()=>{try{await app.api.${enabled ? 'disableAutomatedSchedule' : 'enableAutomatedSchedule'}('${type}'); app.ui.showToast('Успех','${enabled ? 'Выключено' : 'Включено'}','success'); app.showAdmin();}catch(e){app.api.handleAPIError(e,'toggleSchedule');}})()">${enabled ? 'Откл.' : 'Вкл.'}</button>
              <button class="btn btn-xs bg-gray-800 border border-gray-700 text-white px-3 py-1 rounded" onclick="(async()=>{const el=document.getElementById('cron-${type}'); const v=(el && el['value']) ? el['value'] : ''; if(!v){app.ui.showToast('Ошибка','Cron пустой','error'); return;} try{await app.api.updateAutomatedScheduleCron('${type}', v); app.ui.showToast('Успех','Cron обновлён','success'); app.showAdmin();}catch(e){app.api.handleAPIError(e,'updateCron');}})()">Сохранить</button>
              <button class="btn btn-xs bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 rounded" onclick="(async()=>{try{await app.api.triggerAutomatedUpdate('${type}'); app.ui.showToast('Запущено', 'Обновление ${type} запущено', 'info');}catch(e){app.api.handleAPIError(e,'trigger');}})()">Запустить</button>
            </div>
          </td>
        </tr>`;
    };

    const usersRows = recentUsers.map((u: any) => `
      <tr>
        <td class="py-2 px-3 text-white">${u.username}</td>
        <td class="py-2 px-3 text-gray-300">${u.display_name || ''}</td>
        <td class="py-2 px-3 text-gray-300">${u.email || ''}</td>
        <td class="py-2 px-3 text-gray-300">${u.role}</td>
        <td class="py-2 px-3 text-gray-400">${u.created_at ? new Date(u.created_at).toLocaleString() : ''}</td>
      </tr>
    `).join('');

    const html = `
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-white mb-1">Панель администратора</h2>
          <p class="text-gray-400">${isRunning ? 'Идёт операция обновления…' : 'Готово'}</p>
        </div>
        <div class="flex gap-2">
          <button class="bg-gray-800 hover:bg-gray-700 text-white font-medium px-4 py-2 rounded-lg border border-gray-700" onclick="app.showBooks()">Назад</button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        ${statCard('Пользователи', stats.users ?? '-', 'fas fa-users')}
        ${statCard('Книги', stats.books ?? '-', 'fas fa-book')}
        ${statCard('Авторы', stats.authors ?? '-', 'fas fa-user-pen')}
        ${statCard('Жанры', stats.genres ?? '-', 'fas fa-tags')}
      </div>

      <div class="bg-gray-800 rounded-lg border border-gray-700 p-5 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-semibold text-white">Действия обновления</h3>
          <span id="admin-update-badge" class="px-2 py-1 text-sm rounded bg-yellow-900/50 border border-yellow-700 text-yellow-200" style="display:${isRunning ? 'inline-block' : 'none'};">Занято</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg" onclick="app.display.startUpdateRun('sql')">Обновить SQL</button>
          <button class="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-700" onclick="app.display.startUpdateRun('daily')">Ежедневные</button>
          <button class="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-700" onclick="app.display.startUpdateRun('covers')">Обложки</button>
          <button class="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-700" onclick="app.display.startUpdateRun('mappings')">Сопоставления</button>
          <button class="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-2 rounded-lg" onclick="app.display.startUpdateRun('full')">Полное обновление</button>
        </div>
        <div id="admin-update-progress"></div>
        ${lastDaily ? `<div class="text-gray-400 text-sm mt-3">Последнее успешное ежедневное обновление: ${new Date(lastDaily.started_at || lastDaily.completed_at || lastDaily.created_at || '').toLocaleString()}</div>` : ''}
      </div>

      <div class="bg-gray-800 rounded-lg border border-gray-700 p-5 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-semibold text-white">Автоматические обновления</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr class="text-left text-gray-400">
                <th class="py-2 px-3">Тип</th>
                <th class="py-2 px-3">Статус</th>
                <th class="py-2 px-3">CRON</th>
                <th class="py-2 px-3">Последний запуск</th>
                <th class="py-2 px-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              ${schedules.length ? schedules.map(scheduleRow).join('') : `<tr><td colspan="5" class="py-4 px-3 text-gray-400">Расписания не найдены</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-gray-800 rounded-lg border border-gray-700 p-5 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-semibold text-white">Управление пользователями</h3>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="lg:col-span-2">
            <div class="flex items-center gap-2 mb-3">
              <input id="admin-users-search" class="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-200 w-full" placeholder="Поиск по логину/имени/email">
              <button class="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded border border-gray-700" onclick="(function(){const q=document.getElementById('admin-users-search'); window._adminUsersFilter=(q&&q['value'])?q['value'].trim():''; app.showAdmin(); })()">Найти</button>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full">
                <thead>
                  <tr class="text-left text-gray-400">
                    <th class="py-2 px-3">Логин</th>
                    <th class="py-2 px-3">Имя</th>
                    <th class="py-2 px-3">Email</th>
                    <th class="py-2 px-3">Роль</th>
                    <th class="py-2 px-3">Статус</th>
                    <th class="py-2 px-3">Действия</th>
                  </tr>
                </thead>
                <tbody id="admin-users-tbody"></tbody>
              </table>
            </div>
          </div>
          <div>
            <div class="bg-gray-900 border border-gray-700 rounded p-4">
              <div class="text-white font-medium mb-3">Создать пользователя</div>
              <div class="space-y-2">
                <input id="new-username" class="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-gray-200" placeholder="Логин" minlength="3">
                <input id="new-password" class="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-gray-200" placeholder="Пароль" type="password" minlength="6">
                <input id="new-display" class="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-gray-200" placeholder="Имя">
                <input id="new-email" class="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-gray-200" placeholder="Email" type="email">
                <select id="new-role" class="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-gray-200">
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
                <button class="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-2 rounded" onclick="(async()=>{const u=document.getElementById('new-username'); const p=document.getElementById('new-password'); const dn=document.getElementById('new-display'); const em=document.getElementById('new-email'); const rl=document.getElementById('new-role'); const username=u&&u['value']?u['value'].trim():''; const password=p&&p['value']?p['value']:''; if(!username||username.length<3){app.ui.showToast('Ошибка','Минимум 3 символа в логине','error'); return;} if(!password||password.length<6){app.ui.showToast('Ошибка','Минимум 6 символов в пароле','error'); return;} try{const res=await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({username,password,display_name:(dn&&dn['value'])?dn['value'].trim():undefined,email:(em&&em['value'])?em['value'].trim():undefined,role:(rl&&rl['value'])?rl['value']:'user'})}); const json=await res.json(); if(!json.success){throw new Error(json.error||'Не удалось создать пользователя');} app.ui.showToast('Успех','Пользователь создан','success'); app.showAdmin();}catch(e){app.api.handleAPIError(e,'createUser');}})()">Создать</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-semibold text-white">Недавно созданные пользователи</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr class="text-left text-gray-400">
                <th class="py-2 px-3">Логин</th>
                <th class="py-2 px-3">Имя</th>
                <th class="py-2 px-3">Email</th>
                <th class="py-2 px-3">Роль</th>
                <th class="py-2 px-3">Создан</th>
              </tr>
            </thead>
            <tbody>
              ${usersRows || `<tr><td colspan="5" class="py-4 px-3 text-gray-400">Нет данных</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

  this.app.ui.setContent(html);
  // Render any in-flight progress and begin polling if needed
  if (progress) this.renderUpdateProgress(progress);
  if (isRunning) this.pollUpdateStatus(true); else this.clearUpdatePoll();

    // After render, populate users table with optional search filter
    setTimeout(async () => {
      try {
        const all = await this.app.api.getUsers();
        const users = Array.isArray(all) ? all : (all?.users || []);
        const q = (window as any)._adminUsersFilter || '';
        const filtered = q ? users.filter((u: any) => {
          const t = `${u.username||''} ${u.display_name||''} ${u.email||''}`.toLowerCase();
          return t.includes(q.toLowerCase());
        }) : users;
        const tbody = document.getElementById('admin-users-tbody');
        if (!tbody) return;
        tbody.innerHTML = filtered.length ? filtered.map((u: any) => {
          const id = u.id || u.user_uuid || '';
          const status = u.is_active ? 'активен' : 'неактивен';
          return `<tr>
            <td class="py-2 px-3 text-white">${u.username}</td>
            <td class="py-2 px-3 text-gray-300">${u.display_name || ''}</td>
            <td class="py-2 px-3 text-gray-300">${u.email || ''}</td>
            <td class="py-2 px-3 text-gray-300">${u.role}</td>
            <td class="py-2 px-3 text-gray-400">${status}</td>
            <td class="py-2 px-3">
              <button class="btn btn-xs bg-gray-800 border border-gray-700 text-white px-3 py-1 rounded" onclick="(async()=>{const np=prompt('Новый пароль (мин. 6 символов)'); if(!np||np.length<6){return;} try{const res=await fetch('/api/auth/users/${id}/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include', body: JSON.stringify({ new_password: np })}); const j=await res.json(); if(!j.success) throw new Error(j.error||'Сбой'); app.ui.showToast('Успех','Пароль обновлён','success'); }catch(e){app.api.handleAPIError(e,'resetPassword');}})()">Сбросить пароль</button>
            </td>
          </tr>`;
        }).join('') : `<tr><td colspan="6" class="py-3 px-3 text-gray-400">Нет пользователей</td></tr>`;
      } catch {
        this.app.api.handleAPIError(e, 'loadUsersForAdmin');
      }
    }, 0);
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
  async displayBookDetails(book: any) {
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

    // Build dynamic format buttons using backend-provided targets
    const originalFormat = (book.filetype || '').toLowerCase();
    let formatButtons = '';
    try {
      const fmtData = await this.app.api.getBookFormats(String(book.bookid));
      const targets: string[] = (fmtData?.targets || []).filter((t: string) => !!t && t !== originalFormat);
      const all = [originalFormat, ...targets];
      formatButtons = all.map((fmt: string) => {
        const label = fmt.toUpperCase();
        const primary = fmt === originalFormat;
        const tooltip = primary ? 'Исходный формат' : `Конвертировать в ${label}`;
        const icon = primary ? '<i class="fas fa-download mr-2"></i>' : '';
        return `<button title="${tooltip}" class="${primary ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700' : 'bg-gray-800 hover:bg-gray-700 border border-gray-700'} text-white font-medium py-2 px-4 rounded-lg transition-all duration-200" onclick="app.downloadBook('${book.bookid}'${primary ? '' : `, '${fmt}'`})">${icon}${label}</button>`;
      }).join('');
    } catch {
      formatButtons = `<button class="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg" onclick="app.downloadBook('${book.bookid}')"><i class=\"fas fa-download mr-2\"></i>Скачать</button>`;
    }

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
          <div class="mt-6 flex flex-wrap gap-3 items-center">
            <div class="flex flex-wrap gap-2">${formatButtons}</div>
            <button class="bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg border border-gray-700 transition-all duration-200" onclick="app.showBooks()"><i class="fas fa-arrow-left mr-2"></i>Назад к списку</button>
          </div>
          ${book.annotation ? `<div class="mt-8 prose prose-invert max-w-none"><h2 class="text-xl font-semibold mb-3">Аннотация</h2><div class="text-gray-200">${book.annotation}</div></div>` : ''}
        </div>
      </div>`;

    this.app.ui.setContent(html);
  }
  displayAdminUpdates() { /* omitted */ }
}

// Expose globally
(window as unknown as Record<string, unknown>).DisplayModule = (window as unknown as Record<string, unknown>).DisplayModule || DisplayModuleNG;
