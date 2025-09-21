// Display Module - Handles data display and rendering
class DisplayModule {
    constructor(app) {
        this.app = app;
    }

    // Generate SVG placeholder for book covers
    generatePlaceholderSVG(title) {
        const shortTitle = title.substring(0, 20);
        const encodedTitle = encodeURIComponent(shortTitle);
        
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
            <svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
                <rect width="200" height="300" fill="#374151"/>
                <rect x="10" y="10" width="180" height="280" fill="#4B5563" stroke="#6B7280" stroke-width="2"/>
                <text x="100" y="150" font-family="Arial, sans-serif" font-size="14" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle">
                    ${shortTitle}
                </text>
                <text x="100" y="170" font-family="Arial, sans-serif" font-size="12" fill="#9CA3AF" text-anchor="middle" dominant-baseline="middle">
                    Обложка
                </text>
                <text x="100" y="190" font-family="Arial, sans-serif" font-size="12" fill="#9CA3AF" text-anchor="middle" dominant-baseline="middle">
                    недоступна
                </text>
            </svg>
        `)}`;
    }

    // Books Display
    displayBooks(data) {
        console.log('displayBooks called with:', data);
        
        if (!data || data.length === 0) {
            this.app.ui.setContent(`
                <div class="text-center py-12">
                    <i class="fas fa-book-open text-gray-500 text-4xl mb-4"></i>
                    <h3 class="text-xl font-semibold text-white mb-2">Книги не найдены</h3>
                    <p class="text-gray-400">Попробуйте изменить параметры поиска</p>
                </div>
            `);
            return;
        }

        let html = `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        `;

        data.forEach(book => {
            const authorName = book.authors && book.authors.length > 0 
                ? `${book.authors[0].lastname} ${book.authors[0].firstname}`.trim()
                : 'Неизвестный автор';
            
            const formatBadge = book.filetype ? 
                `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">${book.filetype.toUpperCase()}</span>` : '';
            
            const coverUrl = book.cover_url || this.generatePlaceholderSVG(book.title);
            
            const fileSize = book.filesize ? 
                (parseInt(book.filesize) / 1024 / 1024).toFixed(1) + ' MB' : '';

            html += `
                <div class="bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                    <div class="relative">
                        <img src="${coverUrl}" alt="${book.title}" class="w-full h-64 object-cover" 
                             onerror="this.src='${this.generatePlaceholderSVG(book.title)}'">
                        <div class="absolute top-2 right-2">
                            ${formatBadge}
                        </div>
                    </div>
                    <div class="p-4">
                        <h3 class="text-lg font-semibold text-white mb-2 line-clamp-2" title="${book.title}">${book.title}</h3>
                        <p class="text-gray-300 text-sm mb-2">${authorName}</p>
                        <div class="flex items-center justify-between text-sm text-gray-400 mb-3">
                            <span>${book.year || 'Год не указан'}</span>
                            <span>${fileSize}</span>
                        </div>
                        <button class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105" 
                                onclick="app.showBookDetails('${book.bookid}')">
                            <i class="fas fa-eye mr-2"></i>Подробнее
                        </button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        this.app.ui.setContent(html);
    }

    displaySearchResults(data) {
        if (!data || data.length === 0) {
            this.app.ui.setContent(`
                <div class="text-center py-12">
                    <i class="fas fa-search text-gray-500 text-4xl mb-4"></i>
                    <h3 class="text-xl font-semibold text-white mb-2">Результаты не найдены</h3>
                    <p class="text-gray-400">Попробуйте изменить поисковый запрос</p>
                </div>
            `);
            return;
        }

        let html = `
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-white mb-2">Результаты поиска</h2>
                <p class="text-gray-400">Найдено книг: ${data.length}</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        `;

        data.forEach(book => {
            const authorName = book.authors && book.authors.length > 0 
                ? `${book.authors[0].lastname} ${book.authors[0].firstname}`.trim()
                : 'Неизвестный автор';
            
            const formatBadge = book.filetype ? 
                `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">${book.filetype.toUpperCase()}</span>` : '';
            
            const coverUrl = book.cover_url || this.generatePlaceholderSVG(book.title);
            
            const fileSize = book.filesize ? 
                (parseInt(book.filesize) / 1024 / 1024).toFixed(1) + ' MB' : '';

            html += `
                <div class="bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                    <div class="relative">
                        <img src="${coverUrl}" alt="${book.title}" class="w-full h-64 object-cover" 
                             onerror="this.src='${this.generatePlaceholderSVG(book.title)}'">
                        <div class="absolute top-2 right-2">
                            ${formatBadge}
                        </div>
                    </div>
                    <div class="p-4">
                        <h3 class="text-lg font-semibold text-white mb-2 line-clamp-2" title="${book.title}">${book.title}</h3>
                        <p class="text-gray-300 text-sm mb-2">${authorName}</p>
                        <div class="flex items-center justify-between text-sm text-gray-400 mb-3">
                            <span>${book.year || 'Год не указан'}</span>
                            <span>${fileSize}</span>
                        </div>
                        <button class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105" 
                                onclick="app.showBookDetails('${book.bookid}')">
                            <i class="fas fa-eye mr-2"></i>Подробнее
                        </button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        this.app.ui.setContent(html);
    }

    // Authors Display
    displayAuthors(data) {
        if (!data || data.length === 0) {
            this.app.ui.setContent(`
                <div class="text-center py-12">
                    <i class="fas fa-user text-gray-500 text-4xl mb-4"></i>
                    <h3 class="text-xl font-semibold text-white mb-2">Авторы не найдены</h3>
                    <p class="text-gray-400">Попробуйте позже</p>
                </div>
            `);
            return;
        }

        let html = `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        `;

        data.forEach(author => {
            const authorName = `${author.lastname} ${author.firstname} ${author.nickname || ''}`.trim();
            
            html += `
                <div class="bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6">
                    <div class="text-center">
                        <div class="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-user text-white text-2xl"></i>
                        </div>
                        <h3 class="text-lg font-semibold text-white mb-2 line-clamp-2" title="${authorName}">${authorName}</h3>
                        <p class="text-gray-400 text-sm mb-4">Книг: ${author.bookCount || 0}</p>
                        <button class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105" 
                                onclick="app.showAuthorBooks('${author.avtorid}')">
                            <i class="fas fa-books mr-2"></i>Книги автора
                        </button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        this.app.ui.setContent(html);
    }

    // Genres Display
    displayGenres(data) {
        if (!data || data.length === 0) {
            this.app.ui.setContent(`
                <div class="text-center py-12">
                    <i class="fas fa-tags text-gray-500 text-4xl mb-4"></i>
                    <h3 class="text-xl font-semibold text-white mb-2">Жанры не найдены</h3>
                    <p class="text-gray-400">Попробуйте позже</p>
                </div>
            `);
            return;
        }

        let html = `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        `;

        data.forEach(genre => {
            html += `
                <div class="bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6">
                    <div class="text-center">
                        <div class="w-20 h-20 bg-gradient-to-r from-green-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-tag text-white text-2xl"></i>
                        </div>
                        <h3 class="text-lg font-semibold text-white mb-2">${genre.category}</h3>
                        <button class="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105" 
                                onclick="app.showGenreBooks('${genre.category}')">
                            <i class="fas fa-books mr-2"></i>Книги жанра
                        </button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        this.app.ui.setContent(html);
    }

    // Series Display
    displaySeries(data) {
        if (!data || data.length === 0) {
            this.app.ui.setContent(`
                <div class="text-center py-12">
                    <i class="fas fa-layer-group text-gray-500 text-4xl mb-4"></i>
                    <h3 class="text-xl font-semibold text-white mb-2">Серии не найдены</h3>
                    <p class="text-gray-400">Попробуйте позже</p>
                </div>
            `);
            return;
        }

        let html = `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        `;

        data.forEach(series => {
            html += `
                <div class="bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6">
                    <div class="text-center">
                        <div class="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-layer-group text-white text-2xl"></i>
                        </div>
                        <h3 class="text-lg font-semibold text-white mb-2 line-clamp-2" title="${series.seqname}">${series.seqname}</h3>
                        <p class="text-gray-400 text-sm mb-4">Книг: ${series.book_count || 0}</p>
                        <button class="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105" 
                                onclick="app.showSeriesBooks('${series.seqid}')">
                            <i class="fas fa-books mr-2"></i>Книги серии
                        </button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        this.app.ui.setContent(html);
    }

    // Admin Panel Display
    displayAdminPanel(data) {
        let html = `
            <div class="space-y-6">
                <div class="bg-gray-800 rounded-lg shadow-lg p-6">
                    <h2 class="text-2xl font-bold text-white mb-4">Панель администратора</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="bg-gray-700 rounded-lg p-4 text-center">
                            <i class="fas fa-users text-blue-400 text-2xl mb-2"></i>
                            <h3 class="text-white font-semibold">Пользователи</h3>
                            <p class="text-gray-300">${data.stats?.users || 0}</p>
                        </div>
                        <div class="bg-gray-700 rounded-lg p-4 text-center">
                            <i class="fas fa-book text-green-400 text-2xl mb-2"></i>
                            <h3 class="text-white font-semibold">Книги</h3>
                            <p class="text-gray-300">${data.stats?.books || 0}</p>
                        </div>
                        <div class="bg-gray-700 rounded-lg p-4 text-center">
                            <i class="fas fa-download text-purple-400 text-2xl mb-2"></i>
                            <h3 class="text-white font-semibold">Загрузки</h3>
                            <p class="text-gray-300">${data.stats?.downloads || 0}</p>
                        </div>
                    </div>
                </div>

                <div class="bg-gray-800 rounded-lg shadow-lg">
                    <div class="flex items-center justify-between p-6 border-b border-gray-700">
                        <h3 class="text-xl font-semibold text-white">Управление пользователями</h3>
                        <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium" 
                                onclick="app.ui.showCreateUserModal()">
                            <i class="fas fa-plus mr-2"></i>Создать пользователя
                        </button>
                    </div>
                    <div class="p-6">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead class="bg-gray-700 text-white">
                                    <tr>
                                        <th class="px-4 py-3">Пользователь</th>
                                        <th class="px-4 py-3">Email</th>
                                        <th class="px-4 py-3">Роль</th>
                                        <th class="px-4 py-3">Действия</th>
                                    </tr>
                                </thead>
                                <tbody class="text-gray-300">
        `;

        data.users?.forEach(user => {
            html += `
                <tr class="border-b border-gray-700 hover:bg-gray-700">
                    <td class="px-4 py-3">
                        <div>
                            <div class="font-medium text-white">${user.display_name || user.username}</div>
                            <div class="text-sm text-gray-400">${user.username}</div>
                        </div>
                    </td>
                    <td class="px-4 py-3">${user.email || '-'}</td>
                    <td class="px-4 py-3">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === 'admin' ? 'bg-red-100 text-red-800' : 
                            user.role === 'superadmin' ? 'bg-purple-100 text-purple-800' : 
                            'bg-green-100 text-green-800'
                        }">
                            ${user.role}
                        </span>
                    </td>
                    <td class="px-4 py-3">
                        <div class="flex space-x-2">
                            <button class="text-blue-400 hover:text-blue-300" onclick="app.editUser('${user.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${user.id !== this.app.auth.getCurrentUser()?.id ? 
                                `<button class="text-red-400 hover:text-red-300" onclick="app.auth.deleteUser('${user.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>` : ''}
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

                                 <!-- System Updates Section -->
                 <div class="bg-gray-800 rounded-lg shadow-lg">
                     <div class="flex items-center justify-between p-6 border-b border-gray-700">
                         <h3 class="text-xl font-semibold text-white">Управление обновлениями</h3>
                         <div class="flex space-x-2">
                             <button class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium" 
                                     onclick="app.showAdminUpdates()">
                                 <i class="fas fa-sync-alt mr-2"></i>Управлять обновлениями
                             </button>
                             <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium" 
                                     onclick="app.showAutomatedUpdates()">
                                 <i class="fas fa-clock mr-2"></i>Автоматические обновления
                             </button>
                         </div>
                     </div>
                     <div class="p-6">
                         <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                             <div class="bg-gray-700 rounded-lg p-4 text-center">
                                 <i class="fas fa-database text-blue-400 text-2xl mb-2"></i>
                                 <h4 class="text-white font-semibold">SQL файлы</h4>
                                 <p class="text-gray-300">Обновление БД</p>
                             </div>
                             <div class="bg-gray-700 rounded-lg p-4 text-center">
                                 <i class="fas fa-book text-green-400 text-2xl mb-2"></i>
                                 <h4 class="text-white font-semibold">Ежедневные книги</h4>
                                 <p class="text-gray-300">Новые книги</p>
                             </div>
                             <div class="bg-gray-700 rounded-lg p-4 text-center">
                                 <i class="fas fa-image text-purple-400 text-2xl mb-2"></i>
                                 <h4 class="text-white font-semibold">Обложки</h4>
                                 <p class="text-gray-300">Изображения</p>
                             </div>
                             <div class="bg-gray-700 rounded-lg p-4 text-center">
                                 <i class="fas fa-clock text-yellow-400 text-2xl mb-2"></i>
                                 <h4 class="text-white font-semibold">Автоматические</h4>
                                 <p class="text-gray-300">Планировщик</p>
                             </div>
                         </div>
                     </div>
                 </div>
            </div>
        `;

        this.app.ui.setContent(html);
    }

    // Home Page Display
    displayHome() {
        const html = `
            <div class="space-y-8">
                <div class="text-center">
                    <h1 class="text-4xl font-bold text-white mb-4">Добро пожаловать в Flibusta</h1>
                    <p class="text-xl text-gray-300 mb-8">Ваша библиотека электронных книг</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6 text-center hover:transform hover:scale-105 transition-all duration-300 cursor-pointer" 
                         onclick="app.showBooks()">
                        <i class="fas fa-book text-white text-4xl mb-4"></i>
                        <h3 class="text-white text-xl font-semibold mb-2">Книги</h3>
                        <p class="text-blue-100">Просмотр и поиск книг</p>
                    </div>

                    <div class="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-6 text-center hover:transform hover:scale-105 transition-all duration-300 cursor-pointer" 
                         onclick="app.showAuthors()">
                        <i class="fas fa-user text-white text-4xl mb-4"></i>
                        <h3 class="text-white text-xl font-semibold mb-2">Авторы</h3>
                        <p class="text-green-100">Поиск по авторам</p>
                    </div>

                    <div class="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-6 text-center hover:transform hover:scale-105 transition-all duration-300 cursor-pointer" 
                         onclick="app.showGenres()">
                        <i class="fas fa-tags text-white text-4xl mb-4"></i>
                        <h3 class="text-white text-xl font-semibold mb-2">Жанры</h3>
                        <p class="text-purple-100">Поиск по жанрам</p>
                    </div>

                    <div class="bg-gradient-to-br from-pink-600 to-pink-700 rounded-lg p-6 text-center hover:transform hover:scale-105 transition-all duration-300 cursor-pointer" 
                         onclick="app.showSeries()">
                        <i class="fas fa-layer-group text-white text-4xl mb-4"></i>
                        <h3 class="text-white text-xl font-semibold mb-2">Серии</h3>
                        <p class="text-pink-100">Поиск по сериям</p>
                    </div>
                </div>
            </div>
        `;

        this.app.ui.setContent(html);
    }

    // Book Details Display
    displayBookDetails(book) {
        console.log('displayBookDetails called with:', book);
        
        const authorNames = book.authors && book.authors.length > 0 
            ? book.authors.map(author => `${author.lastname} ${author.firstname}`.trim()).join(', ')
            : 'Неизвестный автор';
        
        const genreNames = book.genres && book.genres.length > 0 
            ? book.genres.map(genre => genre.genredesc).join(', ')
            : 'Не указан';
        
        const seriesInfo = book.series && book.series.length > 0 
            ? book.series.map(series => `${series.seqname}${series.seqnumb ? ` (${series.seqnumb})` : ''}`).join(', ')
            : 'Не указана';
        
        const formatBadge = book.filetype ? 
            `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">${book.filetype.toUpperCase()}</span>` : '';
        
        const coverUrl = book.cover_url || this.generatePlaceholderSVG(book.title);
        
        const fileSize = book.filesize ? 
            (parseInt(book.filesize) / 1024 / 1024).toFixed(1) + ' MB' : '';
        
        const annotation = book.annotation ? 
            `<div class="bg-gray-700 rounded-lg p-4 mb-6">
                <h3 class="text-lg font-semibold text-white mb-2">Аннотация</h3>
                <p class="text-gray-300 leading-relaxed">${book.annotation}</p>
            </div>` : '';

        const reviews = book.reviews && book.reviews.length > 0 ? 
            `<div class="bg-gray-700 rounded-lg p-4 mb-6">
                <h3 class="text-lg font-semibold text-white mb-4">Отзывы (${book.reviews.length})</h3>
                <div class="space-y-3">
                    ${book.reviews.map(review => `
                        <div class="border-l-4 border-blue-500 pl-4">
                            <div class="flex items-center justify-between mb-2">
                                <span class="font-medium text-white">${review.name}</span>
                                <span class="text-sm text-gray-400">${new Date(review.time).toLocaleDateString()}</span>
                            </div>
                            <p class="text-gray-300 text-sm">${review.text}</p>
                        </div>
                    `).join('')}
                </div>
            </div>` : '';

        const html = `
            <div class="max-w-6xl mx-auto">
                <div class="mb-6">
                    <button onclick="app.showBooks()" class="inline-flex items-center text-blue-400 hover:text-blue-300 mb-4">
                        <i class="fas fa-arrow-left mr-2"></i>Назад к книгам
                    </button>
                    <h1 class="text-3xl font-bold text-white mb-2">${book.title}</h1>
                    <p class="text-xl text-gray-300">${authorNames}</p>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- Cover and basic info -->
                    <div class="lg:col-span-1">
                        <div class="bg-gray-800 rounded-lg p-6 sticky top-4">
                            <div class="text-center mb-6">
                                <img src="${coverUrl}" alt="${book.title}" class="w-full max-w-xs mx-auto rounded-lg shadow-lg" 
                                     onerror="this.src='${this.generatePlaceholderSVG(book.title)}'">
                            </div>
                            
                            <div class="space-y-4">
                                <div class="flex items-center justify-between">
                                    <span class="text-gray-400">Формат:</span>
                                    ${formatBadge}
                                </div>
                                
                                ${fileSize ? `
                                <div class="flex items-center justify-between">
                                    <span class="text-gray-400">Размер:</span>
                                    <span class="text-white">${fileSize}</span>
                                </div>
                                ` : ''}
                                
                                <div class="flex items-center justify-between">
                                    <span class="text-gray-400">Год:</span>
                                    <span class="text-white">${book.year || 'Не указан'}</span>
                                </div>
                                
                                <div class="flex items-center justify-between">
                                    <span class="text-gray-400">Язык:</span>
                                    <span class="text-white">${book.lang || 'Не указан'}</span>
                                </div>
                                
                                <button onclick="app.downloadBook('${book.bookid}')" class="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105">
                                    <i class="fas fa-download mr-2"></i>Скачать книгу
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Details -->
                    <div class="lg:col-span-2">
                        ${annotation}
                        
                        <div class="bg-gray-800 rounded-lg p-6 mb-6">
                            <h3 class="text-lg font-semibold text-white mb-4">Информация о книге</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <span class="text-gray-400">Автор:</span>
                                    <p class="text-white">${authorNames}</p>
                                </div>
                                <div>
                                    <span class="text-gray-400">Жанр:</span>
                                    <p class="text-white">${genreNames}</p>
                                </div>
                                <div>
                                    <span class="text-gray-400">Серия:</span>
                                    <p class="text-white">${seriesInfo}</p>
                                </div>
                                <div>
                                    <span class="text-gray-400">Добавлена:</span>
                                    <p class="text-white">${new Date(book.time).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                        
                        ${reviews}
                    </div>
                </div>
            </div>
        `;
        
        this.app.ui.setContent(html);
    }

    displayAdminUpdates() {
        console.log('displayAdminUpdates called');
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) {
            console.error('contentArea not found');
            return;
        }

        contentArea.innerHTML = `
            <div class="max-w-6xl mx-auto">
                <div class="bg-gray-800 rounded-lg shadow-xl p-6">
                    <h1 class="text-3xl font-bold text-white mb-6">
                        <i class="fas fa-sync-alt mr-3"></i>Управление обновлениями
                    </h1>
                    
                    <!-- Status Section -->
                    <div class="mb-8">
                        <h2 class="text-xl font-semibold text-gray-300 mb-4">Статус системы</h2>
                        <div id="updateStatus" class="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div class="bg-gray-700 p-4 rounded-lg">
                                <div class="text-gray-400 text-sm">SQL файлы</div>
                                <div class="text-white text-2xl font-bold">-</div>
                            </div>
                            <div class="bg-gray-700 p-4 rounded-lg">
                                <div class="text-gray-400 text-sm">Книги</div>
                                <div class="text-white text-2xl font-bold">-</div>
                            </div>
                            <div class="bg-gray-700 p-4 rounded-lg">
                                <div class="text-gray-400 text-sm">Обложки</div>
                                <div class="text-white text-2xl font-bold">-</div>
                            </div>
                            <div class="bg-gray-700 p-4 rounded-lg">
                                <div class="text-gray-400 text-sm">Последнее обновление</div>
                                <div class="text-white text-sm">-</div>
                            </div>
                        </div>
                        <button onclick="app.refreshUpdateStatus()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                            <i class="fas fa-refresh mr-2"></i>Обновить статус
                        </button>
                    </div>
                    
                    <!-- Update Actions -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <!-- SQL Updates -->
                        <div class="bg-gray-700 p-6 rounded-lg">
                            <h3 class="text-lg font-semibold text-white mb-3">
                                <i class="fas fa-database mr-2"></i>SQL файлы
                            </h3>
                            <p class="text-gray-400 text-sm mb-4">
                                Обновление схемы базы данных и метаданных книг
                            </p>
                            <button onclick="app.updateSqlFiles()" class="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                                <i class="fas fa-download mr-2"></i>Обновить SQL
                            </button>
                        </div>
                        
                        <!-- Daily Books -->
                        <div class="bg-gray-700 p-6 rounded-lg">
                            <h3 class="text-lg font-semibold text-white mb-3">
                                <i class="fas fa-book mr-2"></i>Ежедневные книги
                            </h3>
                            <p class="text-gray-400 text-sm mb-4">
                                Загрузка новых книг из ежедневных обновлений
                            </p>
                            <button onclick="app.updateDailyBooks()" class="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
                                <i class="fas fa-download mr-2"></i>Обновить книги
                            </button>
                        </div>
                        
                        <!-- Covers -->
                        <div class="bg-gray-700 p-6 rounded-lg">
                            <h3 class="text-lg font-semibold text-white mb-3">
                                <i class="fas fa-image mr-2"></i>Обложки
                            </h3>
                            <p class="text-gray-400 text-sm mb-4">
                                Загрузка обложек книг и фотографий авторов
                            </p>
                            <button onclick="app.updateCovers()" class="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
                                <i class="fas fa-download mr-2"></i>Обновить обложки
                            </button>
                        </div>
                        
                        <!-- Book Mappings -->
                        <div class="bg-gray-700 p-6 rounded-lg">
                            <h3 class="text-lg font-semibold text-white mb-3">
                                <i class="fas fa-link mr-2"></i>Маппинги книг
                            </h3>
                            <p class="text-gray-400 text-sm mb-4">
                                Обновление связей между книгами и файлами
                            </p>
                            <button onclick="app.updateBookMappings()" class="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors">
                                <i class="fas fa-sync mr-2"></i>Обновить маппинги
                            </button>
                        </div>
                        
                        <!-- Full Update -->
                        <div class="bg-gray-700 p-6 rounded-lg md:col-span-2 lg:col-span-3">
                            <h3 class="text-lg font-semibold text-white mb-3">
                                <i class="fas fa-rocket mr-2"></i>Полное обновление
                            </h3>
                            <p class="text-gray-400 text-sm mb-4">
                                Выполнить все обновления системы одновременно (может занять много времени)
                            </p>
                            <button onclick="app.performFullUpdate()" class="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors font-medium">
                                <i class="fas fa-play mr-2"></i>Запустить полное обновление
                            </button>
                        </div>
                    </div>
                    
                    <!-- Logs Section -->
                    <div class="mt-8">
                        <h2 class="text-xl font-semibold text-gray-300 mb-4">Логи обновлений</h2>
                        <div id="updateLogs" class="bg-gray-900 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm">
                            <div class="text-gray-400">Логи будут отображаться здесь...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Load initial status
        this.loadUpdateStatus();
    }

    async loadUpdateStatus() {
        try {
            console.log('loadUpdateStatus: this.app =', this.app);
            console.log('loadUpdateStatus: this.app.getUpdateStatus =', this.app.getUpdateStatus);
            const status = await this.app.getUpdateStatus();
            console.log('loadUpdateStatus: status =', status);
            this.updateStatusDisplay(status);
        } catch (error) {
            console.error('Failed to load update status:', error);
        }
    }

    updateStatusDisplay(status) {
        const statusContainer = document.getElementById('updateStatus');
        if (!statusContainer) return;

        statusContainer.innerHTML = `
            <div class="bg-gray-700 p-4 rounded-lg">
                <div class="text-gray-400 text-sm">SQL файлы</div>
                <div class="text-white text-2xl font-bold">${status.sqlFiles}</div>
            </div>
            <div class="bg-gray-700 p-4 rounded-lg">
                <div class="text-gray-400 text-sm">Книги</div>
                <div class="text-white text-2xl font-bold">${status.dailyFiles}</div>
            </div>
            <div class="bg-gray-700 p-4 rounded-lg">
                <div class="text-gray-400 text-sm">Обложки</div>
                <div class="text-white text-2xl font-bold">${status.coverFiles}</div>
            </div>
            <div class="bg-gray-700 p-4 rounded-lg">
                <div class="text-gray-400 text-sm">Последнее обновление</div>
                <div class="text-white text-sm">${new Date(status.lastUpdate).toLocaleString('ru-RU')}</div>
            </div>
        `;
    }

    addUpdateLog(message, type = 'info') {
        const logsContainer = document.getElementById('updateLogs');
        if (!logsContainer) return;

        const timestamp = new Date().toLocaleTimeString('ru-RU');
        const colorClass = type === 'error' ? 'text-red-400' : type === 'success' ? 'text-green-400' : 'text-blue-400';
        
        const logEntry = document.createElement('div');
        logEntry.className = `mb-1 ${colorClass}`;
        logEntry.innerHTML = `[${timestamp}] ${message}`;
        
        logsContainer.appendChild(logEntry);
                 logsContainer.scrollTop = logsContainer.scrollHeight;
     }

     displayAutomatedUpdates() {
         const contentArea = document.getElementById('contentArea');
         if (!contentArea) return;

         contentArea.innerHTML = `
             <div class="max-w-6xl mx-auto">
                 <div class="bg-gray-800 rounded-lg shadow-xl p-6">
                     <h1 class="text-3xl font-bold text-white mb-6">
                         <i class="fas fa-clock mr-3"></i>Автоматические обновления
                     </h1>
                     
                     <!-- Status Overview -->
                     <div class="mb-8">
                         <h2 class="text-xl font-semibold text-gray-300 mb-4">Статус автоматических обновлений</h2>
                         <div id="automatedStatus" class="grid grid-cols-1 md:grid-cols-4 gap-4">
                             <div class="bg-gray-700 p-4 rounded-lg">
                                 <div class="text-gray-400 text-sm">Ежедневные книги</div>
                                 <div class="text-white text-2xl font-bold">-</div>
                                 <div class="text-gray-400 text-xs">Последний запуск: -</div>
                             </div>
                             <div class="bg-gray-700 p-4 rounded-lg">
                                 <div class="text-gray-400 text-sm">SQL файлы</div>
                                 <div class="text-white text-2xl font-bold">-</div>
                                 <div class="text-gray-400 text-xs">Последний запуск: -</div>
                             </div>
                             <div class="bg-gray-700 p-4 rounded-lg">
                                 <div class="text-gray-400 text-sm">Обложки</div>
                                 <div class="text-white text-2xl font-bold">-</div>
                                 <div class="text-gray-400 text-xs">Последний запуск: -</div>
                             </div>
                             <div class="bg-gray-700 p-4 rounded-lg">
                                 <div class="text-gray-400 text-sm">Маппинги</div>
                                 <div class="text-white text-2xl font-bold">-</div>
                                 <div class="text-gray-400 text-xs">Последний запуск: -</div>
                             </div>
                         </div>
                         <button onclick="app.refreshAutomatedStatus()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                             <i class="fas fa-refresh mr-2"></i>Обновить статус
                         </button>
                     </div>
                     
                     <!-- Schedule Management -->
                     <div class="mb-8">
                         <h2 class="text-xl font-semibold text-gray-300 mb-4">Управление расписанием</h2>
                         <div id="scheduleManagement" class="bg-gray-700 p-6 rounded-lg">
                             <div class="text-gray-400">Загрузка расписаний...</div>
                         </div>
                     </div>
                     
                     <!-- Manual Triggers -->
                     <div class="mb-8">
                         <h2 class="text-xl font-semibold text-gray-300 mb-4">Ручной запуск</h2>
                         <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                             <button onclick="app.triggerAutomatedUpdate('daily_books')" class="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg transition-colors">
                                 <i class="fas fa-book mr-2"></i>Ежедневные книги
                             </button>
                             <button onclick="app.triggerAutomatedUpdate('sql_files')" class="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg transition-colors">
                                 <i class="fas fa-database mr-2"></i>SQL файлы
                             </button>
                             <button onclick="app.triggerAutomatedUpdate('covers')" class="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg transition-colors">
                                 <i class="fas fa-image mr-2"></i>Обложки
                             </button>
                             <button onclick="app.triggerAutomatedUpdate('mappings')" class="bg-yellow-600 hover:bg-yellow-700 text-white p-4 rounded-lg transition-colors">
                                 <i class="fas fa-link mr-2"></i>Маппинги
                             </button>
                         </div>
                     </div>
                     
                     <!-- Update History -->
                     <div class="mb-8">
                         <h2 class="text-xl font-semibold text-gray-300 mb-4">История обновлений</h2>
                         <div class="flex space-x-2 mb-4">
                             <button onclick="app.loadAutomatedHistory()" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">
                                 Все обновления
                             </button>
                             <button onclick="app.loadAutomatedHistory(20, 'daily_books')" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
                                 Ежедневные книги
                             </button>
                             <button onclick="app.loadAutomatedHistory(20, 'sql_files')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                                 SQL файлы
                             </button>
                         </div>
                         <div id="automatedHistory" class="bg-gray-900 p-4 rounded-lg h-64 overflow-y-auto">
                             <div class="text-gray-400">История будет загружена здесь...</div>
                         </div>
                     </div>
                 </div>
             </div>
         `;
         
         // Load initial data
         this.loadAutomatedStatus();
         this.loadScheduleManagement();
         this.loadAutomatedHistory();
     }

         async loadAutomatedStatus() {
        try {
            const stats = await this.app.getAutomatedUpdateStats();
            this.updateAutomatedStatusDisplay(stats);
        } catch (error) {
            console.error('Failed to load automated status:', error);
        }
    }

     updateAutomatedStatusDisplay(stats) {
         const statusContainer = document.getElementById('automatedStatus');
         if (!statusContainer) return;

         const statsMap = {};
         stats.stats.forEach(stat => {
             statsMap[stat.update_type] = stat;
         });

         statusContainer.innerHTML = `
             <div class="bg-gray-700 p-4 rounded-lg">
                 <div class="text-gray-400 text-sm">Ежедневные книги</div>
                 <div class="text-white text-2xl font-bold">${statsMap.daily_books?.successful_runs || 0}</div>
                 <div class="text-gray-400 text-xs">Последний запуск: ${statsMap.daily_books?.last_run ? new Date(statsMap.daily_books.last_run).toLocaleString('ru-RU') : 'Никогда'}</div>
             </div>
             <div class="bg-gray-700 p-4 rounded-lg">
                 <div class="text-gray-400 text-sm">SQL файлы</div>
                 <div class="text-white text-2xl font-bold">${statsMap.sql_files?.successful_runs || 0}</div>
                 <div class="text-gray-400 text-xs">Последний запуск: ${statsMap.sql_files?.last_run ? new Date(statsMap.sql_files.last_run).toLocaleString('ru-RU') : 'Никогда'}</div>
             </div>
             <div class="bg-gray-700 p-4 rounded-lg">
                 <div class="text-gray-400 text-sm">Обложки</div>
                 <div class="text-white text-2xl font-bold">${statsMap.covers?.successful_runs || 0}</div>
                 <div class="text-gray-400 text-xs">Последний запуск: ${statsMap.covers?.last_run ? new Date(statsMap.covers.last_run).toLocaleString('ru-RU') : 'Никогда'}</div>
             </div>
             <div class="bg-gray-700 p-4 rounded-lg">
                 <div class="text-gray-400 text-sm">Маппинги</div>
                 <div class="text-white text-2xl font-bold">${statsMap.mappings?.successful_runs || 0}</div>
                 <div class="text-gray-400 text-xs">Последний запуск: ${statsMap.mappings?.last_run ? new Date(statsMap.mappings.last_run).toLocaleString('ru-RU') : 'Никогда'}</div>
             </div>
         `;
     }

         async loadScheduleManagement() {
        try {
            const stats = await this.app.getAutomatedUpdateStats();
            this.updateScheduleManagementDisplay(stats.schedules);
        } catch (error) {
            console.error('Failed to load schedule management:', error);
        }
    }

     updateScheduleManagementDisplay(schedules) {
         const container = document.getElementById('scheduleManagement');
         if (!container) return;

         let html = '<div class="space-y-4">';
         
         schedules.forEach(schedule => {
             const statusClass = schedule.enabled ? 'text-green-400' : 'text-red-400';
             const statusText = schedule.enabled ? 'Включено' : 'Отключено';
             const lastRun = schedule.last_run ? new Date(schedule.last_run).toLocaleString('ru-RU') : 'Никогда';
             const nextRun = schedule.next_run ? new Date(schedule.next_run).toLocaleString('ru-RU') : 'Не запланировано';

             html += `
                 <div class="bg-gray-800 p-4 rounded-lg">
                     <div class="flex items-center justify-between mb-2">
                         <h3 class="text-white font-semibold">${this.getUpdateTypeName(schedule.update_type)}</h3>
                         <span class="${statusClass} text-sm">${statusText}</span>
                     </div>
                     <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                         <div>
                             <span class="text-gray-400">Расписание:</span>
                             <span class="text-white ml-2">${schedule.cron_expression}</span>
                         </div>
                         <div>
                             <span class="text-gray-400">Последний запуск:</span>
                             <span class="text-white ml-2">${lastRun}</span>
                         </div>
                         <div>
                             <span class="text-gray-400">Следующий запуск:</span>
                             <span class="text-white ml-2">${nextRun}</span>
                         </div>
                     </div>
                     <div class="flex space-x-2 mt-3">
                         ${schedule.enabled ? 
                             `<button onclick="app.disableAutomatedSchedule('${schedule.update_type}')" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
                                 Отключить
                             </button>` :
                             `<button onclick="app.enableAutomatedSchedule('${schedule.update_type}')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
                                 Включить
                             </button>`
                         }
                         <button onclick="app.triggerAutomatedUpdate('${schedule.update_type}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                             Запустить сейчас
                         </button>
                     </div>
                 </div>
             `;
         });

         html += '</div>';
         container.innerHTML = html;
     }

     getUpdateTypeName(type) {
         const names = {
             'daily_books': 'Ежедневные книги',
             'sql_files': 'SQL файлы',
             'covers': 'Обложки',
             'mappings': 'Маппинги книг',
             'full': 'Полное обновление'
         };
         return names[type] || type;
     }

         async loadAutomatedHistory(limit = 50, type = null) {
        try {
            const history = await this.app.getAutomatedUpdateHistory(limit, type);
            this.updateAutomatedHistoryDisplay(history);
        } catch (error) {
            console.error('Failed to load automated history:', error);
        }
    }

     updateAutomatedHistoryDisplay(history) {
         const container = document.getElementById('automatedHistory');
         if (!container) return;

         if (!history || history.length === 0) {
             container.innerHTML = '<div class="text-gray-400">История обновлений пуста</div>';
             return;
         }

         let html = '<div class="space-y-2">';
         
         history.forEach(record => {
             const statusClass = record.status === 'success' ? 'text-green-400' : 
                                record.status === 'error' ? 'text-red-400' : 'text-yellow-400';
             const statusText = record.status === 'success' ? 'Успешно' : 
                               record.status === 'error' ? 'Ошибка' : 'Выполняется';
             const startedAt = new Date(record.started_at).toLocaleString('ru-RU');
             const duration = record.duration_seconds ? `${record.duration_seconds}s` : '-';
             const filesInfo = record.files_processed ? 
                 `${record.files_successful}/${record.files_processed} файлов` : '';

             html += `
                 <div class="bg-gray-800 p-3 rounded border-l-4 ${record.status === 'success' ? 'border-green-500' : 
                                                                   record.status === 'error' ? 'border-red-500' : 'border-yellow-500'}">
                     <div class="flex items-center justify-between">
                         <div>
                             <span class="text-white font-medium">${this.getUpdateTypeName(record.update_type)}</span>
                             <span class="${statusClass} ml-2">${statusText}</span>
                         </div>
                         <div class="text-gray-400 text-sm">${startedAt}</div>
                     </div>
                     <div class="text-gray-400 text-sm mt-1">
                         Длительность: ${duration} | ${filesInfo}
                         ${record.error_message ? `<br>Ошибка: ${record.error_message}` : ''}
                     </div>
                 </div>
             `;
         });

         html += '</div>';
         container.innerHTML = html;
     }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DisplayModule;
}
