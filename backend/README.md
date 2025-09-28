# Flibusta Backend - Node.js

Современный бэкенд для домашней библиотеки Флибуста, написанный на Node.js с Express.

## Особенности

- **Современная архитектура**: Node.js 18+ с Express
- **Безопасность**: JWT аутентификация, валидация данных, защита от SQL-инъекций
- **Производительность**: Кэширование, оптимизированные запросы к БД
- **API**: RESTful API с полной документацией
- **OPDS**: Поддержка протокола OPDS для электронных читалок
- **Файлы**: Эффективная обработка и кэширование изображений
- **Конвертация**: На-лету преобразование FB2 -> EPUB при скачивании
- **Логирование**: Структурированное логирование с Winston
- **Docker**: Полная поддержка контейнеризации

## Технологии

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL с pg
- **Authentication**: JWT + Sessions
- **Validation**: express-validator
- **Logging**: Winston
- **Image Processing**: Sharp
- **File Handling**: Adm-zip
- **Security**: Helmet, CORS, Rate Limiting

## Установка

### Предварительные требования

- Node.js 18+
- PostgreSQL 13+
- Docker (опционально)

### Локальная установка

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd flibusta/backend
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл конфигурации:
```bash
cp env.example .env
```

4. Настройте переменные окружения в `.env`

5. Запустите приложение:
```bash
# Разработка
npm run dev

# Продакшн
npm start
```

### Docker установка

1. Соберите образ:
```bash
docker build -t flibusta-backend .
```

2. Запустите с docker-compose:
```bash
docker-compose up -d
```

## API Endpoints

### Аутентификация

- `POST /api/auth/register` - Регистрация пользователя
- `POST /api/auth/login` - Вход в систему
- `POST /api/auth/logout` - Выход из системы
- `GET /api/auth/me` - Получить текущего пользователя

### Книги

- `GET /api/books/recent` - Последние книги
- `GET /api/books/search` - Поиск книг
- `GET /api/books/:id` - Детали книги
- `GET /api/books/author/:authorId` - Книги автора
- `GET /api/books/genre/:genreCode` - Книги по жанру
- `GET /api/books/:id/file-info` - Информация о файле книги

### Авторы

- `GET /api/authors` - Список авторов
- `GET /api/authors/letter/:letter` - Авторы по букве
- `GET /api/authors/:id` - Детали автора
- `GET /api/authors/:id/aliases` - Псевдонимы автора
- `GET /api/authors/popular/list` - Популярные авторы

### Жанры

- `GET /api/genres` - Список жанров
- `GET /api/genres/category/:category` - Жанры по категории
- `GET /api/genres/:genreCode` - Детали жанра

### Серии

- `GET /api/series` - Список серий
- `GET /api/series/letter/:letter` - Серии по букве
- `GET /api/series/:id` - Детали серии

### Избранное

- `GET /api/favorites` - Избранное пользователя
- `POST /api/favorites/books/:bookId` - Добавить книгу в избранное
- `DELETE /api/favorites/books/:bookId` - Удалить книгу из избранного
- `POST /api/favorites/authors/:authorId` - Добавить автора в избранное
- `DELETE /api/favorites/authors/:authorId` - Удалить автора из избранного
- `POST /api/favorites/series/:seriesId` - Добавить серию в избранное
- `DELETE /api/favorites/series/:seriesId` - Удалить серию из избранного

### Файлы

- `GET /api/files/book/:bookId` - Скачать книгу (поддерживает `?format=epub` для конвертации FB2 -> EPUB)
- `GET /api/files/author/:authorId` - Фото автора
- `GET /api/files/cover/:bookId` - Обложка книги

### Конвертация форматов

Endpoint `/api/files/book/:bookId` теперь поддерживает расширенный список целевых форматов через query-параметр `format`:

```
?format=epub|mobi|azw3|pdf|txt|rtf|html
```

Поведение:
- Если исходный файл уже в целевом формате — возвращается оригинал.
- Если установлен Calibre (`ebook-convert`) и включён (`ENABLE_CALIBRE=1`), выполняется конвертация с кешированием в `CONVERSIONS_CACHE_PATH`.
- При отсутствии Calibre работает встроенный fallback только для FB2/XML -> EPUB.
- Результат сохраняется как `<bookId>.<target>` в каталоге кеша для повторного использования.

Переменные окружения для конвертации:
- `ENABLE_CALIBRE` (1/0) — включить/выключить использование Calibre (по умолчанию 1).
- `CALIBRE_EBOOK_CONVERT` — путь к бинарю `ebook-convert` (по умолчанию просто `ebook-convert` в PATH).
- `CALIBRE_CONVERSION_TIMEOUT_MS` — таймаут одной конвертации (по умолчанию 180000 мс).
- `CONVERSIONS_CACHE_PATH` — каталог для кэша конвертаций (по умолчанию `/app/cache/converted`).

Пример запроса:
```
GET /api/files/book/12345?format=epub
```

Статусы ошибок:
- 404 — если файл книги не найден.
- 400 — если указан неподдерживаемый формат.
- 500 — внутренняя ошибка конвертера.

### OPDS (для читалок)

- `GET /opds/` - Главный каталог OPDS
- `GET /opds/search` - Поиск в OPDS формате
- `GET /opds/genres` - Жанры в OPDS формате
- `GET /opds/genre/:category` - Книги жанра в OPDS формате

## Структура проекта

```
backend/
├── src/
│   ├── app.js                 # Главный файл приложения
│   ├── database/
│   │   └── connection.js      # Подключение к БД
│   ├── middleware/
│   │   ├── auth.js           # Аутентификация
│   │   ├── errorHandler.js   # Обработка ошибок
│   │   └── notFoundHandler.js
│   ├── routes/
│   │   ├── auth.js           # Аутентификация
│   │   ├── books.js          # Книги
│   │   ├── authors.js        # Авторы
│   │   ├── genres.js         # Жанры
│   │   ├── series.js         # Серии
│   │   ├── favorites.js      # Избранное
│   │   ├── files.js          # Файлы
│   │   └── opds.js           # OPDS
│   ├── services/
│   │   ├── BookService.js    # Логика книг
│   │   └── AuthorService.js  # Логика авторов
│   └── utils/
│       └── logger.js         # Логирование
├── public/                   # Статические файлы
├── logs/                     # Логи приложения
├── package.json
├── Dockerfile
└── README.md
```

## Конфигурация

### Переменные окружения

```env
# Сервер
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# База данных
DB_HOST=postgres
DB_PORT=5432
DB_NAME=flibusta
DB_USER=flibusta
DB_PASSWORD=flibusta
DB_SSL=false

# Сессии
SESSION_SECRET=your-super-secret-session-key
SESSION_MAX_AGE=86400000

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Пути к файлам
BOOKS_PATH=/app/flibusta
CACHE_PATH=/app/cache
AUTHORS_CACHE_PATH=/app/cache/authors
COVERS_CACHE_PATH=/app/cache/covers
CONVERSIONS_CACHE_PATH=/app/cache/converted
ENABLE_CALIBRE=1
CALIBRE_CONVERSION_TIMEOUT_MS=180000
SKIP_DB_INIT=0

# Пагинация
RECORDS_PER_PAGE=10
BOOKS_PER_PAGE=10
AUTHORS_PER_PAGE=50
SERIES_PER_PAGE=50
OPDS_FEED_COUNT=100

# Безопасность
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Логирование
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

## Разработка

### Запуск в режиме разработки

```bash
npm run dev
```

### Тестирование

```bash
npm test
```

### Линтинг

```bash
npm run lint
```

### Миграции БД

```bash
npm run migrate
```

## Безопасность

- **SQL Injection Protection**: Все запросы используют параметризованные запросы
- **XSS Protection**: Валидация и экранирование входных данных
- **CSRF Protection**: Встроенная защита от CSRF атак
- **Rate Limiting**: Ограничение количества запросов
- **Helmet**: Заголовки безопасности
- **CORS**: Настройка CORS для безопасности

## Производительность

- **Connection Pooling**: Оптимизированное подключение к БД
- **Image Caching**: Кэширование обработанных изображений
- **Compression**: Gzip сжатие ответов
- **Static File Caching**: Кэширование статических файлов
- **Query Optimization**: Оптимизированные SQL запросы

## Мониторинг

- **Health Checks**: Проверка состояния сервиса
- **Structured Logging**: Структурированное логирование
- **Error Tracking**: Отслеживание ошибок
- **Performance Metrics**: Метрики производительности

## Развертывание

### Docker

```bash
# Сборка
docker build -t flibusta-backend .

# Запуск
docker run -p 3000:3000 flibusta-backend
```

### Docker Compose

```bash
docker-compose up -d
```

### PM2 (Production)

```bash
npm install -g pm2
pm2 start src/app.js --name flibusta-backend
pm2 startup
pm2 save
```

## Лицензия

MIT License

## Поддержка

Для получения поддержки создайте issue в репозитории проекта.
