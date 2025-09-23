// Flibusta Frontend Application
class FlibustaApp {
    constructor() {
        this.currentUser = null;
        this.currentPage = 1;
        this.currentSection = 'home';
        this.toast = null;
        this.init();
    }

    init() {
        this.checkAuth();
        this.bindEvents();
        this.showHome(); // Default view
        this.initToast();
    }

    initToast() {
        this.toast = new bootstrap.Toast(document.getElementById('toast'));
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
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });
            if (response.ok) {
                const result = await response.json();
                this.currentUser = result.data;
                this.updateUIForAuthenticatedUser();
            } else {
                this.updateUIForUnauthenticatedUser();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.updateUIForUnauthenticatedUser();
        }
    }

    updateUIForAuthenticatedUser() {
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('userDropdown').style.display = 'block';
        document.getElementById('userDisplayName').textContent = this.currentUser.display_name || this.currentUser.username;
        
        // Show admin section for admin/superadmin users
        if (this.currentUser.role === 'admin' || this.currentUser.role === 'superadmin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        }
    }

    updateUIForUnauthenticatedUser() {
        document.getElementById('loginBtn').style.display = 'block';
        document.getElementById('userDropdown').style.display = 'none';
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        this.currentUser = null;
    }

    showToast(title, message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastTitle = document.getElementById('toastTitle');
        const toastBody = document.getElementById('toastBody');
        
        toastTitle.textContent = title;
        toastBody.textContent = message;
        
        // Update toast styling based on type
        if (type === 'error') {
            toast.className = 'fixed bottom-4 right-4 bg-red-800 border border-red-700 rounded-lg shadow-xl z-50 max-w-sm';
        } else {
            toast.className = 'fixed bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-w-sm';
        }
        
        toast.classList.remove('hidden');
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            this.hideToast();
        }, 5000);
    }

    async login() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');

        if (!username || !password) {
            errorDiv.textContent = 'Пожалуйста, заполните все поля';
            errorDiv.classList.remove('hidden');
            return;
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (result.success) {
                this.currentUser = result.data;
                this.updateUIForAuthenticatedUser();
                this.showToast('Успешно', 'Вы успешно вошли в систему');
                this.hideLoginModal();
                document.getElementById('loginForm').reset();
                errorDiv.classList.add('hidden');
            } else {
                errorDiv.textContent = result.error || 'Ошибка входа';
                errorDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Login error:', error);
            errorDiv.textContent = 'Ошибка соединения';
            errorDiv.classList.remove('hidden');
        }
    }

    async logout() {
        try {
            await fetch('/api/auth/logout', { 
                method: 'POST',
                credentials: 'include'
            });
            this.updateUIForUnauthenticatedUser();
            this.showToast('Успешно', 'Вы вышли из системы');
            this.showHome();
        } catch (error) {
            console.error('Logout error:', error);
            this.showToast('Ошибка', 'Ошибка при выходе из системы', 'error');
        }
    }

    showLoginModal() {
        document.getElementById('loginModal').classList.remove('hidden');
    }

    hideLoginModal() {
        document.getElementById('loginModal').classList.add('hidden');
    }

    showChangePassword() {
        document.getElementById('changePasswordModal').classList.remove('hidden');
    }

    hideChangePasswordModal() {
        document.getElementById('changePasswordModal').classList.add('hidden');
    }

    hideProfileModal() {
        document.getElementById('profileModal').classList.add('hidden');
    }

    hideCreateUserModal() {
        document.getElementById('createUserModal').classList.add('hidden');
    }

    hideToast() {
        document.getElementById('toast').classList.add('hidden');
    }

    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorDiv = document.getElementById('changePasswordError');

        if (!currentPassword || !newPassword || !confirmPassword) {
            errorDiv.textContent = 'Пожалуйста, заполните все поля';
            errorDiv.style.display = 'block';
            return;
        }

        if (newPassword !== confirmPassword) {
            errorDiv.textContent = 'Новые пароли не совпадают';
            errorDiv.style.display = 'block';
            return;
        }

        if (newPassword.length < 6) {
            errorDiv.textContent = 'Новый пароль должен содержать минимум 6 символов';
            errorDiv.style.display = 'block';
            return;
        }

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
            });

            const result = await response.json();

            if (result.success) {
                this.showToast('Успешно', 'Пароль изменен');
                this.hideChangePasswordModal();
                document.getElementById('changePasswordForm').reset();
                errorDiv.style.display = 'none';
            } else {
                errorDiv.textContent = result.error || 'Ошибка изменения пароля';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Change password error:', error);
            errorDiv.textContent = 'Ошибка соединения';
            errorDiv.style.display = 'block';
        }
    }

    showProfile() {
        document.getElementById('profileUsername').value = this.currentUser.username;
        document.getElementById('profileEmail').value = this.currentUser.email || '';
        document.getElementById('profileDisplayName').value = this.currentUser.display_name || '';
        
        document.getElementById('profileModal').classList.remove('hidden');
    }

    async updateProfile() {
        const email = document.getElementById('profileEmail').value;
        const displayName = document.getElementById('profileDisplayName').value;
        const errorDiv = document.getElementById('profileError');

        try {
            const response = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ email, display_name: displayName })
            });

            const result = await response.json();

            if (result.success) {
                this.currentUser = result.data;
                this.updateUIForAuthenticatedUser();
                this.showToast('Успешно', 'Профиль обновлен');
                this.hideProfileModal();
                errorDiv.style.display = 'none';
            } else {
                errorDiv.textContent = result.error || 'Ошибка обновления профиля';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Update profile error:', error);
            errorDiv.textContent = 'Ошибка соединения';
            errorDiv.style.display = 'block';
        }
    }

    async createUser() {
        const username = document.getElementById('newUserUsername').value;
        const password = document.getElementById('newUserPassword').value;
        const email = document.getElementById('newUserEmail').value;
        const displayName = document.getElementById('newUserDisplayName').value;
        const role = document.getElementById('newUserRole').value;
        const errorDiv = document.getElementById('createUserError');

        if (!username || !password) {
            errorDiv.textContent = 'Имя пользователя и пароль обязательны';
            errorDiv.style.display = 'block';
            return;
        }

        if (username.length < 3) {
            errorDiv.textContent = 'Имя пользователя должно содержать минимум 3 символа';
            errorDiv.style.display = 'block';
            return;
        }

        if (password.length < 6) {
            errorDiv.textContent = 'Пароль должен содержать минимум 6 символов';
            errorDiv.style.display = 'block';
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ 
                    username, 
                    password, 
                    email: email || undefined, 
                    display_name: displayName || undefined,
                    role 
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showToast('Успешно', 'Пользователь создан');
                this.hideCreateUserModal();
                document.getElementById('createUserForm').reset();
                errorDiv.style.display = 'none';
                this.loadUsers(); // Refresh user list
            } else {
                errorDiv.textContent = result.error || 'Ошибка создания пользователя';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Create user error:', error);
            errorDiv.textContent = 'Ошибка соединения';
            errorDiv.style.display = 'block';
        }
    }

    async performSearch() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) return;

        this.showLoading();
        try {
            const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}&page=0&limit=20`, {
                credentials: 'include'
            });
            const result = await response.json();
            
            if (result.success) {
                this.displaySearchResults(result.data);
            } else {
                this.showError('Ошибка поиска: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Ошибка соединения');
        }
    }

    displaySearchResults(data) {
        const contentArea = document.getElementById('contentArea');
        
        if (!data || data.length === 0) {
            contentArea.innerHTML = `
                <div class="text-center">
                    <h3>Результаты поиска</h3>
                    <p>По вашему запросу ничего не найдено.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="row">
                <div class="col-12">
                    <h3>Результаты поиска (${data.length} книг)</h3>
                </div>
            </div>
            <div class="row">
        `;

        data.forEach(book => {
            const authorName = book.authors && book.authors.length > 0 
                ? `${book.authors[0].lastname} ${book.authors[0].firstname}`.trim()
                : 'Неизвестный автор';
            
            html += `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card bg-dark border-secondary h-100">
                        <div class="card-body">
                            <h5 class="card-title">${book.title}</h5>
                            <p class="card-text text-muted">${authorName}</p>
                            <p class="card-text small">Год: ${book.year || 'Не указан'}</p>
                        </div>
                        <div class="card-footer bg-transparent border-secondary">
                            <button class="btn btn-primary btn-sm" onclick="app.showBookDetails('${book.bookid}')">
                                <i class="fas fa-eye"></i> Подробнее
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        contentArea.innerHTML = html;
    }

    showHome() {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="text-center mb-12">
                <h1 class="text-5xl font-bold text-white mb-4">
                    <i class="fas fa-book-open text-blue-400"></i> Добро пожаловать в Флибуста
                </h1>
                <p class="text-xl text-gray-300">Ваша домашняя библиотека</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6 text-center">
                    <i class="fas fa-books text-4xl mb-4 text-white"></i>
                    <h5 class="text-xl font-bold text-white mb-2">Книги</h5>
                    <p class="text-blue-100 mb-4">Просмотр и поиск книг</p>
                    <button class="bg-white text-blue-600 hover:bg-gray-100 px-6 py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105" onclick="app.showBooks()">
                        <i class="fas fa-arrow-right mr-2"></i>Перейти
                    </button>
                </div>
                <div class="bg-gradient-to-br from-green-600 to-green-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6 text-center">
                    <i class="fas fa-user-edit text-4xl mb-4 text-white"></i>
                    <h5 class="text-xl font-bold text-white mb-2">Авторы</h5>
                    <p class="text-green-100 mb-4">Поиск по авторам</p>
                    <button class="bg-white text-green-600 hover:bg-gray-100 px-6 py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105" onclick="app.showAuthors()">
                        <i class="fas fa-arrow-right mr-2"></i>Перейти
                    </button>
                </div>
                <div class="bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6 text-center">
                    <i class="fas fa-tags text-4xl mb-4 text-white"></i>
                    <h5 class="text-xl font-bold text-white mb-2">Жанры</h5>
                    <p class="text-cyan-100 mb-4">Поиск по жанрам</p>
                    <button class="bg-white text-cyan-600 hover:bg-gray-100 px-6 py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105" onclick="app.showGenres()">
                        <i class="fas fa-arrow-right mr-2"></i>Перейти
                    </button>
                </div>
                <div class="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6 text-center">
                    <i class="fas fa-layer-group text-4xl mb-4 text-white"></i>
                    <h5 class="text-xl font-bold text-white mb-2">Серии</h5>
                    <p class="text-yellow-100 mb-4">Поиск по сериям</p>
                    <button class="bg-white text-yellow-600 hover:bg-gray-100 px-6 py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105" onclick="app.showSeries()">
                        <i class="fas fa-arrow-right mr-2"></i>Перейти
                    </button>
                </div>
            </div>
        `;
    }

    async showBooks() {
        console.log('showBooks called');
        this.showLoading();
        try {
            const response = await fetch('/api/books/recent?limit=20', {
                credentials: 'include'
            });
            const result = await response.json();
            console.log('Books API response:', result);
            
            if (result.success) {
                this.displayBooks(result.data);
            } else {
                console.error('Books API error:', result.error);
                this.showError('Ошибка загрузки книг');
            }
        } catch (error) {
            console.error('Books error:', error);
            this.showError('Ошибка соединения');
        }
    }

    displayBooks(data) {
        console.log('displayBooks called with data:', data);
        const contentArea = document.getElementById('contentArea');
        
        if (!data || data.length === 0) {
            console.log('No data found, showing empty message');
            contentArea.innerHTML = `
                <div class="text-center py-12">
                    <h3 class="text-2xl font-bold text-gray-300 mb-4">Книги</h3>
                    <p class="text-gray-400">Книги не найдены.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="mb-8">
                <h2 class="text-3xl font-bold text-white mb-2">Последние книги</h2>
                <p class="text-gray-400">Найдено ${data.length} книг</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        `;

        data.forEach(book => {
            const authorName = book.authors && book.authors.length > 0 
                ? `${book.authors[0].lastname} ${book.authors[0].firstname}`.trim()
                : 'Неизвестный автор';
            
            const formatBadge = book.filetype ? 
                `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    ${book.filetype.toUpperCase()}
                </span>` : '';
            
            const coverUrl = book.cover_url || `https://via.placeholder.com/200x300/374151/FFFFFF?text=${encodeURIComponent(book.title.substring(0, 20))}`;
            
            html += `
                <div class="bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                    <div class="relative">
                        <img src="${coverUrl}" alt="${book.title}" class="w-full h-64 object-cover" onerror="this.src='https://via.placeholder.com/200x300/374151/FFFFFF?text=${encodeURIComponent(book.title.substring(0, 20))}'">
                        <div class="absolute top-2 right-2">
                            ${formatBadge}
                        </div>
                    </div>
                    <div class="p-4">
                        <h3 class="text-lg font-semibold text-white mb-2 line-clamp-2" title="${book.title}">${book.title}</h3>
                        <p class="text-gray-300 text-sm mb-2">${authorName}</p>
                        <div class="flex items-center justify-between text-sm text-gray-400 mb-3">
                            <span>${book.year || 'Год не указан'}</span>
                            <span>${book.filesize ? (parseInt(book.filesize) / 1024 / 1024).toFixed(1) + ' MB' : ''}</span>
                        </div>
                        <button class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105" onclick="app.showBookDetails('${book.bookid}')">
                            <i class="fas fa-eye mr-2"></i>Подробнее
                        </button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        console.log('Setting contentArea HTML:', html);
        contentArea.innerHTML = html;
        console.log('ContentArea after setting HTML:', contentArea.innerHTML);
        console.log('ContentArea children count:', contentArea.children.length);
    }

    async showAuthors() {
        this.showLoading();
        try {
            const response = await fetch('/api/authors?limit=20', {
                credentials: 'include'
            });
            const result = await response.json();
            
            if (result.success) {
                this.displayAuthors(result.data);
            } else {
                this.showError('Ошибка загрузки авторов');
            }
        } catch (error) {
            console.error('Authors error:', error);
            this.showError('Ошибка соединения');
        }
    }

    displayAuthors(data) {
        const contentArea = document.getElementById('contentArea');
        
        if (!data || data.length === 0) {
            contentArea.innerHTML = `
                <div class="text-center">
                    <h3>Авторы</h3>
                    <p>Авторы не найдены.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="row">
                <div class="col-12">
                    <h3>Авторы</h3>
                </div>
            </div>
            <div class="row">
        `;

        data.forEach(author => {
            const authorName = `${author.lastname} ${author.firstname}`.trim() || author.nickname || 'Неизвестный автор';
            
            html += `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card bg-dark border-secondary h-100">
                        <div class="card-body">
                            <h5 class="card-title">${authorName}</h5>
                            <p class="card-text text-muted">Книг: ${author.bookCount || 0}</p>
                        </div>
                        <div class="card-footer bg-transparent border-secondary">
                            <button class="btn btn-primary btn-sm" onclick="app.showAuthorBooks('${author.avtorid}')">
                                <i class="fas fa-books"></i> Книги автора
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        contentArea.innerHTML = html;
    }

    async showGenres() {
        this.showLoading();
        try {
            const response = await fetch('/api/genres', {
                credentials: 'include'
            });
            const result = await response.json();
            
            if (result.success) {
                this.displayGenres(result.data);
            } else {
                this.showError('Ошибка загрузки жанров');
            }
        } catch (error) {
            console.error('Genres error:', error);
            this.showError('Ошибка соединения');
        }
    }

    displayGenres(data) {
        const contentArea = document.getElementById('contentArea');
        
        if (!data || data.length === 0) {
            contentArea.innerHTML = `
                <div class="text-center">
                    <h3>Жанры</h3>
                    <p>Жанры не найдены.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="row">
                <div class="col-12">
                    <h3>Жанры</h3>
                </div>
            </div>
            <div class="row">
        `;

        data.forEach(genre => {
            html += `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card bg-dark border-secondary h-100">
                        <div class="card-body">
                            <h5 class="card-title">${genre.category}</h5>
                            <p class="card-text text-muted">Книг: ${genre.book_count || 0}</p>
                        </div>
                        <div class="card-footer bg-transparent border-secondary">
                            <button class="btn btn-primary btn-sm" onclick="app.showGenreBooks('${genre.category}')">
                                <i class="fas fa-books"></i> Книги жанра
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        contentArea.innerHTML = html;
    }

    async showSeries() {
        this.showLoading();
        try {
            const response = await fetch('/api/series?limit=20', {
                credentials: 'include'
            });
            const result = await response.json();
            
            if (result.success) {
                this.displaySeries(result.data);
            } else {
                this.showError('Ошибка загрузки серий');
            }
        } catch (error) {
            console.error('Series error:', error);
            this.showError('Ошибка соединения');
        }
    }

    displaySeries(data) {
        const contentArea = document.getElementById('contentArea');
        
        if (!data || data.length === 0) {
            contentArea.innerHTML = `
                <div class="text-center">
                    <h3>Серии</h3>
                    <p>Серии не найдены.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="row">
                <div class="col-12">
                    <h3>Серии</h3>
                </div>
            </div>
            <div class="row">
        `;

        data.forEach(series => {
            html += `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card bg-dark border-secondary h-100">
                        <div class="card-body">
                            <h5 class="card-title">${series.seqname}</h5>
                            <p class="card-text text-muted">Книг: ${series.book_count || 0}</p>
                        </div>
                        <div class="card-footer bg-transparent border-secondary">
                            <button class="btn btn-primary btn-sm" onclick="app.showSeriesBooks('${series.seqid}')">
                                <i class="fas fa-books"></i> Книги серии
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        contentArea.innerHTML = html;
    }

    async showAdmin() {
        if (!this.currentUser || (this.currentUser.role !== 'admin' && this.currentUser.role !== 'superadmin')) {
            this.showError('Доступ запрещен');
            return;
        }

        this.showLoading();
        try {
            const response = await fetch('/api/auth/users', {
                credentials: 'include'
            });
            const result = await response.json();
            
            if (result.success) {
                this.displayAdminPanel(result.data);
            } else {
                this.showError('Ошибка загрузки данных администратора');
            }
        } catch (error) {
            console.error('Admin error:', error);
            this.showError('Ошибка соединения');
        }
    }

    displayAdminPanel(data) {
        const contentArea = document.getElementById('contentArea');
        
        let html = `
            <div class="row">
                <div class="col-12">
                    <h3><i class="fas fa-cog"></i> Панель администратора</h3>
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <p class="mb-0">Управление пользователями</p>
                        <button class="btn btn-primary" onclick="app.showCreateUserModal()">
                            <i class="fas fa-user-plus"></i> Создать пользователя
                        </button>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-12">
                    <div class="card bg-dark border-secondary">
                        <div class="card-header">
                            <h5 class="mb-0">Пользователи (${data.pagination.total})</h5>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-dark table-striped">
                                    <thead>
                                        <tr>
                                            <th>Пользователь</th>
                                            <th>Email</th>
                                            <th>Роль</th>
                                            <th>Статус</th>
                                            <th>Создан</th>
                                            <th>Последний вход</th>
                                            <th>Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
        `;

        data.users.forEach(user => {
            const isCurrentUser = user.user_uuid === this.currentUser.user_uuid;
            const isSuperAdmin = user.role === 'superadmin';
            
            html += `
                <tr>
                    <td>
                        <strong>${user.display_name || user.username}</strong><br>
                        <small class="text-muted">${user.username}</small>
                    </td>
                    <td>${user.email || '-'}</td>
                    <td>
                        <span class="badge ${user.role === 'superadmin' ? 'bg-danger' : user.role === 'admin' ? 'bg-warning' : 'bg-secondary'}">
                            ${user.role}
                        </span>
                    </td>
                    <td>
                        <span class="badge ${user.is_active ? 'bg-success' : 'bg-danger'}">
                            ${user.is_active ? 'Активен' : 'Неактивен'}
                        </span>
                    </td>
                    <td>${new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
                    <td>${user.last_login ? new Date(user.last_login).toLocaleDateString('ru-RU') : 'Никогда'}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="app.editUser('${user.user_uuid}')" ${isCurrentUser ? 'disabled' : ''}>
                                <i class="fas fa-edit"></i>
                            </button>
                            ${!isSuperAdmin && !isCurrentUser ? `
                                <button class="btn btn-outline-danger" onclick="app.deleteUser('${user.user_uuid}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        contentArea.innerHTML = html;
    }

    showCreateUserModal() {
        document.getElementById('createUserModal').classList.remove('hidden');
    }

    showLoading() {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Загрузка...</span>
                </div>
                <p class="mt-2">Загрузка...</p>
            </div>
        `;
    }

    showError(message) {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="fas fa-exclamation-triangle"></i> ${message}
            </div>
        `;
    }

    // Placeholder methods for future implementation
    showBookDetails(bookId) {
        this.showToast('Информация', 'Функция просмотра деталей книги будет реализована позже');
    }

    showAuthorBooks(authorId) {
        this.showToast('Информация', 'Функция просмотра книг автора будет реализована позже');
    }

    showGenreBooks(genreId) {
        this.showToast('Информация', 'Функция просмотра книг жанра будет реализована позже');
    }

    showSeriesBooks(seriesId) {
        this.showToast('Информация', 'Функция просмотра книг серии будет реализована позже');
    }

    editUser(userId) {
        this.showToast('Информация', 'Функция редактирования пользователя будет реализована позже');
    }

    async deleteUser(userId) {
        if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
            return;
        }

        try {
            const response = await fetch(`/api/auth/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                this.showToast('Успешно', 'Пользователь удален');
                this.showAdmin(); // Refresh admin panel
            } else {
                this.showToast('Ошибка', result.error || 'Ошибка удаления пользователя', 'error');
            }
        } catch (error) {
            console.error('Delete user error:', error);
            this.showToast('Ошибка', 'Ошибка соединения', 'error');
        }
    }
}

// Initialize the application
const app = new FlibustaApp();
