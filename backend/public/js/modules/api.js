// API Module - Handles all API calls and data fetching
class APIModule {
    constructor(app) {
        this.app = app;
        this.baseURL = '';
        this.requestQueue = [];
        this.isProcessing = false;
        this.rateLimitDelay = 100; // 100ms between requests
    }

    // Generic API call method
    async apiCall(endpoint, options = {}) {
        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const finalOptions = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, finalOptions);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Handle API response structure: { success: boolean, data: any, error?: string }
            if (result.success === false) {
                throw new Error(result.error || 'API request failed');
            }
            
            return result;
        } catch (error) {
            console.error(`API call failed for ${endpoint}:`, error);
            throw error;
        }
    }

    // Search API
    async searchBooks(query, page = 0, params = {}) {
        const searchParams = new URLSearchParams({
            q: query || '',
            page: page.toString(),
            limit: params.limit || '12',
            sort: params.sort || 'relevance'
        });

        // Add optional parameters
        if (params.genre) searchParams.append('genre', params.genre);
        if (params.series) searchParams.append('series', params.series);
        if (params.year) searchParams.append('year', params.year);
        if (params.language) searchParams.append('language', params.language);

        const response = await this.apiCall(`/api/books/search?${searchParams}`);
        return response;
    }

    // Books API
    async getRecentBooks() {
        const response = await this.apiCall('/api/books/recent');
        return response.data;
    }

    async getBookDetails(bookId) {
        const response = await this.apiCall(`/api/books/${bookId}`);
        return response.data;
    }

    async getAuthorBooks(authorId) {
        const response = await this.apiCall(`/api/authors/${authorId}/books`);
        return response.data;
    }

    async getGenreBooks(genreId) {
        const response = await this.apiCall(`/api/genres/${genreId}/books`);
        return response.data;
    }

    async getSeriesBooks(seriesId) {
        const response = await this.apiCall(`/api/series/${seriesId}/books`);
        return response.data;
    }

    // Authors API
    async getAuthors(params = {}) {
        const searchParams = new URLSearchParams({
            page: params.page || '0',
            limit: params.limit || '20',
            sort: params.sort || 'relevance'
        });

        if (params.query) searchParams.append('q', params.query);
        if (params.letter) searchParams.append('letter', params.letter);

        const response = await this.apiCall(`/api/authors?${searchParams}`);
        return response;
    }

    async searchAuthors(params = {}) {
        return this.getAuthors(params);
    }

    // Genres API
    async getGenres() {
        const response = await this.apiCall('/api/genres');
        return response.data;
    }

    // Series API
    async getSeries() {
        const response = await this.apiCall('/api/series');
        return response.data;
    }

    // Admin API
    async getAdminData() {
        const response = await this.apiCall('/api/admin/dashboard');
        return response.data;
    }

    async getUsers() {
        const response = await this.apiCall('/api/admin/users');
        return response.data;
    }

    // File download
    async downloadBook(bookId, format = null) {
        try {
            // If no format provided, get book details first to determine filetype
            let filetype = format;
            if (!filetype) {
                const bookDetails = await this.getBookDetails(bookId);
                filetype = bookDetails.filetype || 'fb2';
            }
            
            const response = await fetch(`${this.baseURL}/api/files/book/${bookId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error || `Download failed: ${response.status}`;
                throw new Error(errorMessage);
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `book_${bookId}.${filetype}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download failed:', error);
            throw error;
        }
    }

    // Admin update methods
    async getUpdateStatus() {
        return await this.apiCall('GET', '/api/admin/updates/status');
    }

    async updateSqlFiles() {
        return await this.apiCall('POST', '/api/admin/updates/sql');
    }

    async updateDailyBooks() {
        return await this.apiCall('POST', '/api/admin/updates/daily');
    }

    async updateCovers() {
        return await this.apiCall('POST', '/api/admin/updates/covers');
    }

    async updateBookMappings() {
        return await this.apiCall('POST', '/api/admin/updates/mappings');
    }

    async performFullUpdate() {
        return await this.apiCall('POST', '/api/admin/updates/full');
    }

    async getDailyFilesList() {
        return await this.apiCall('GET', '/api/admin/updates/daily/list');
    }

    // Automated update methods
    async getAutomatedUpdateHistory(limit = 50, type = null) {
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit);
        if (type) params.append('type', type);
        
        return await this.apiCall('GET', `/api/admin/automated/history?${params.toString()}`);
    }

    async getAutomatedUpdateStats() {
        return await this.apiCall('GET', '/api/admin/automated/stats');
    }

    async getAutomatedUpdateSchedules() {
        return await this.apiCall('GET', '/api/admin/automated/schedules');
    }

    async enableAutomatedSchedule(type) {
        return await this.apiCall('POST', `/api/admin/automated/schedules/${type}/enable`);
    }

    async disableAutomatedSchedule(type) {
        return await this.apiCall('POST', `/api/admin/automated/schedules/${type}/disable`);
    }

    async updateAutomatedScheduleCron(type, cronExpression) {
        return await this.apiCall('PUT', `/api/admin/automated/schedules/${type}/cron`, {
            body: JSON.stringify({ cronExpression })
        });
    }

    async triggerAutomatedUpdate(type) {
        return await this.apiCall('POST', `/api/admin/automated/trigger/${type}`);
    }

    // Cache management
    async getCachedData(key) {
        const cached = localStorage.getItem(`flibusta_cache_${key}`);
        if (cached) {
            const data = JSON.parse(cached);
            // Check if cache is still valid (24 hours)
            if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
                return data.value;
            }
        }
        return null;
    }

    async setCachedData(key, value) {
        const cacheData = {
            value: value,
            timestamp: Date.now()
        };
        localStorage.setItem(`flibusta_cache_${key}`, JSON.stringify(cacheData));
    }

    clearCache() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('flibusta_cache_')) {
                localStorage.removeItem(key);
            }
        });
    }

    // Error handling
    handleAPIError(error, context = '') {
        console.error(`API Error in ${context}:`, error);
        
        let userMessage = 'Произошла ошибка при загрузке данных';
        
        if (error.message.includes('Unexpected token') && error.message.includes('<!DOCTYPE')) {
            userMessage = 'Необходима авторизация. Пожалуйста, войдите в систему.';
            // Redirect to login page
            window.location.href = '/login';
        } else if (error.message.includes('401')) {
            userMessage = 'Необходима авторизация';
            this.app.auth.logout();
        } else if (error.message.includes('403')) {
            userMessage = 'Доступ запрещен. Необходимы права администратора.';
        } else if (error.message.includes('404')) {
            userMessage = 'Данные не найдены';
        } else if (error.message.includes('500')) {
            userMessage = 'Ошибка сервера';
        } else if (error.message.includes('NetworkError')) {
            userMessage = 'Ошибка соединения с сервером';
        }
        
        this.app.ui.showToast('Ошибка', userMessage, 'error');
        return userMessage;
    }

    // Rate limiting

    async throttledApiCall(endpoint, options = {}) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ endpoint, options, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            
            try {
                const result = await this.apiCall(request.endpoint, request.options);
                request.resolve(result);
            } catch (error) {
                request.reject(error);
            }

            // Add delay between requests
            if (this.requestQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
            }
        }

        this.isProcessing = false;
    }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIModule;
}
