// @ts-nocheck
// API Module - Handles all API calls and data fetching (TypeScript)
class APIModuleNG {
  app: any;
  baseURL: string;
  requestQueue: any[];
  isProcessing: boolean;
  rateLimitDelay: number;
  _inflight: number;

  constructor(app: any) {
    this.app = app;
    this.baseURL = '';
    this.requestQueue = [];
    this.isProcessing = false;
    this.rateLimitDelay = 100; // 100ms between requests
    // Simple top progress bar state
    this._inflight = 0;
    this._ensureTopbar();
  }

  async apiCall(endpoint: string, options: RequestInit = {}) {
    const defaultOptions: RequestInit = {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    } as any;
    const finalOptions = { ...defaultOptions, ...options } as RequestInit;
    try {
      this._startTopbar();
      const response = await fetch(`${this.baseURL}${endpoint}`, finalOptions);
      if (!response.ok) {
        let serverText = '';
        try { serverText = await response.text(); } catch {}
        const msg = serverText && serverText.length < 500 ? `${response.status} ${serverText}` : `HTTP error! status: ${response.status}`;
        throw new Error(msg);
      }
      const result = await response.json();
      if ((result as any).success === false) {
        throw new Error((result as any).error || 'API request failed');
      }
      return result;
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error);
      throw error;
    } finally {
      this._stopTopbar();
    }
  }

  _ensureTopbar() {
    if (document.getElementById('top-progress-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'top-progress-bar';
    Object.assign(bar.style, {
      position: 'fixed', top: '0', left: '0', height: '3px', width: '0%',
      background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)',
      boxShadow: '0 0 10px rgba(59,130,246,0.6)',
      transition: 'width 0.2s ease, opacity 0.3s ease',
      opacity: '0', zIndex: '9999'
    } as CSSStyleDeclaration);
    document.body.appendChild(bar);
  }
  _startTopbar() {
    this._inflight++;
    const bar = document.getElementById('top-progress-bar') as HTMLDivElement | null;
    if (!bar) return;
    bar.style.opacity = '1';
    const current = parseFloat(bar.style.width) || 0;
    const next = Math.min(current + 30, 80);
    bar.style.width = `${next}%`;
  }
  _stopTopbar() {
    this._inflight = Math.max(0, this._inflight - 1);
    const bar = document.getElementById('top-progress-bar') as HTMLDivElement | null;
    if (!bar) return;
    if (this._inflight === 0) {
      bar.style.width = '100%';
      setTimeout(() => { bar.style.opacity = '0'; bar.style.width = '0%'; }, 200);
    } else {
      const current = parseFloat(bar.style.width) || 0;
      const next = Math.min(current + 10, 90);
      bar.style.width = `${next}%`;
    }
  }

  async searchBooks(query: string, page = 0, params: any = {}) {
    const searchParams = new URLSearchParams({ q: query || '', page: page.toString(), limit: params.limit || '12', sort: params.sort || 'relevance' });
    if (params.genre) searchParams.append('genre', params.genre);
    if (params.series) searchParams.append('series', params.series);
    if (params.year) searchParams.append('year', params.year);
    if (params.language) searchParams.append('language', params.language);
    const response: any = await this.apiCall(`/api/books/search?${searchParams}`);
    if (response?.data && Array.isArray(response.data) && response.data.length === 0) {
      this.app.ui.showToast('Подсказка', 'Ничего не найдено. Измените запрос или фильтры.', 'info');
    }
    return response;
  }

  async getRecentBooks() { const response: any = await this.apiCall('/api/books/recent'); return response.data; }
  async getBookDetails(bookId: string) { const response: any = await this.apiCall(`/api/books/${bookId}`); return response.data; }
  async getAuthorBooks(authorId: string) { const response: any = await this.apiCall(`/api/authors/${authorId}/books`); return response.data; }
  async getGenreBooks(genreId: string) { const response: any = await this.apiCall(`/api/genres/${genreId}/books`); return response.data; }
  async getSeriesBooks(seriesId: string) { const response: any = await this.apiCall(`/api/series/${seriesId}/books`); return response.data; }

  async getAuthors(params: any = {}) {
    const searchParams = new URLSearchParams({ page: params.page || '0', limit: params.limit || '20', sort: params.sort || 'relevance' });
    if (params.query) searchParams.append('q', params.query);
    if (params.letter) searchParams.append('letter', params.letter);
    return await this.apiCall(`/api/authors?${searchParams}`);
  }
  async searchAuthors(params: any = {}) { return this.getAuthors(params); }
  async getGenres() { const response: any = await this.apiCall('/api/genres'); return response.data; }
  async getGenresByCategory(category: string) { const response: any = await this.apiCall(`/api/genres/category/${encodeURIComponent(category)}`); return response.data; }
  async getSeries() { const response: any = await this.apiCall('/api/series'); return response.data; }
  async getSeriesById(seriesId: string | number) { const response: any = await this.apiCall(`/api/series/${seriesId}`); return response.data; }
  async getAdminData() { const response: any = await this.apiCall('/api/admin/dashboard'); return response.data; }
  async getUsers() { const response: any = await this.apiCall('/api/admin/users'); return response.data; }

  async downloadBook(bookId: string, format: string | null = null) {
    try {
      const response = await fetch(`${this.baseURL}/api/files/book/${bookId}`, { credentials: 'include' as RequestCredentials });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = (errorData as any).error || `Download failed: ${response.status}`;
        throw new Error(errorMessage);
      }
      const cd = response.headers.get('Content-Disposition') || response.headers.get('content-disposition') || '';
      let filename: string | null = null;
      const fnStarMatch = /filename\*=(?:UTF-8''|utf-8'')([^;\r\n]+)/i.exec(cd || '');
      if (fnStarMatch && fnStarMatch[1]) { try { filename = decodeURIComponent(fnStarMatch[1].trim().replace(/\"/g, '')); } catch { filename = fnStarMatch[1].trim(); } }
      if (!filename) {
        const fnMatch = /filename="?([^";\r\n]+)"?/i.exec(cd || '');
        if (fnMatch && fnMatch[1]) { const raw = fnMatch[1].trim(); try { filename = decodeURIComponent(raw); } catch { filename = raw; } }
      }
      const ct = (response.headers.get('Content-Type') || '').toLowerCase();
      const ctToExt: Record<string,string> = {
        'application/x-fictionbook+xml': 'fb2', 'application/epub+zip': 'epub', 'image/vnd.djvu': 'djvu', 'application/pdf': 'pdf',
        'application/x-mobipocket-ebook': 'mobi', 'text/plain': 'txt', 'text/html': 'html', 'application/rtf': 'rtf'
      };
      const ext = Object.entries(ctToExt).find(([k]) => ct.indexOf(k) !== -1)?.[1] || 'bin';
      if (!filename) { filename = `book_${bookId}.${ext}`; } else { if (!/\.[a-z0-9]{2,5}$/i.test(filename)) filename = `${filename}.${ext}`; }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch (error) { console.error('Download failed:', error); throw error; }
  }

  async getUpdateStatus() { return await this.apiCall('/api/admin/updates/status', { method: 'GET' }); }
  async startUpdate(type: 'sql'|'daily'|'covers'|'mappings'|'full') { return await this.apiCall(`/api/admin/updates/run/${type}`, { method: 'POST' }); }
  async updateSqlFiles() { return await this.apiCall('/api/admin/updates/sql', { method: 'POST' }); }
  async updateDailyBooks() { return await this.apiCall('/api/admin/updates/daily', { method: 'POST' }); }
  async updateCovers() { return await this.apiCall('/api/admin/updates/covers', { method: 'POST' }); }
  async updateBookMappings() { return await this.apiCall('/api/admin/updates/mappings', { method: 'POST' }); }
  async performFullUpdate() { return await this.apiCall('/api/admin/updates/full', { method: 'POST' }); }
  async getDailyFilesList() { return await this.apiCall('/api/admin/updates/daily/list', { method: 'GET' }); }
  async getAutomatedUpdateHistory(limit = 50, type: string | null = null) { const params = new URLSearchParams(); if (limit) params.append('limit', String(limit)); if (type) params.append('type', type); return await this.apiCall(`/api/admin/automated/history?${params.toString()}`, { method: 'GET' }); }
  async getAutomatedUpdateStats() { return await this.apiCall('/api/admin/automated/stats', { method: 'GET' }); }
  async getAutomatedUpdateSchedules() { return await this.apiCall('/api/admin/automated/schedules', { method: 'GET' }); }
  async enableAutomatedSchedule(type: string) { return await this.apiCall(`/api/admin/automated/schedules/${type}/enable`, { method: 'POST' }); }
  async disableAutomatedSchedule(type: string) { return await this.apiCall(`/api/admin/automated/schedules/${type}/disable`, { method: 'POST' }); }
  async updateAutomatedScheduleCron(type: string, cronExpression: string) { return await this.apiCall(`/api/admin/automated/schedules/${type}/cron`, { method: 'PUT', body: JSON.stringify({ cronExpression }) }); }
  async triggerAutomatedUpdate(type: string) { return await this.apiCall(`/api/admin/automated/trigger/${type}`, { method: 'POST' }); }

  async getCachedData(key: string) { const cached = localStorage.getItem(`flibusta_cache_${key}`); if (cached) { const data = JSON.parse(cached); if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) return data.value; } return null; }
  async setCachedData(key: string, value: any) { const cacheData = { value, timestamp: Date.now() }; localStorage.setItem(`flibusta_cache_${key}`, JSON.stringify(cacheData)); }
  clearCache() { Object.keys(localStorage).forEach(key => { if (key.startsWith('flibusta_cache_')) localStorage.removeItem(key); }); }

  handleAPIError(error: any, context = '') {
    console.error(`API Error in ${context}:`, error);
    let userMessage = 'Произошла ошибка при загрузке данных';
    if (error.message?.includes('Unexpected token') && error.message?.includes('<!DOCTYPE')) {
      userMessage = 'Необходима авторизация. Пожалуйста, войдите в систему.'; window.location.href = '/login';
    } else if (error.message?.includes('401')) { userMessage = 'Необходима авторизация'; this.app.auth.logout(); }
    else if (error.message?.includes('403')) { userMessage = 'Доступ запрещен. Необходимы права администратора.'; }
    else if (error.message?.includes('404')) { userMessage = 'Данные не найдены'; }
    else if (error.message?.includes('500')) { userMessage = 'Ошибка сервера'; }
    else if (error.message?.includes('NetworkError')) { userMessage = 'Ошибка соединения с сервером'; }
    this.app.ui.showToast('Ошибка', userMessage, 'error');
    return userMessage;
  }

  async throttledApiCall(endpoint: string, options: RequestInit = {}) {
    return new Promise((resolve, reject) => { this.requestQueue.push({ endpoint, options, resolve, reject }); this.processQueue(); });
  }

  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return;
    this.isProcessing = true;
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      try { const result = await this.apiCall(request.endpoint, request.options); request.resolve(result); }
      catch (error) { request.reject(error); }
      if (this.requestQueue.length > 0) { await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay)); }
    }
    this.isProcessing = false;
  }
}

// Expose globally for non-module usage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).APIModule = (window as any).APIModule || APIModuleNG;
