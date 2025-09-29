# Flibusta - Electronic Library Application

A modern web application for browsing and managing electronic books, built with Node.js, Express, PostgreSQL, and a responsive frontend.

## 🚀 Features

### ✅ **Working Features**

#### **📚 Book Management**
- ✅ **Browse recent books** with beautiful card layout
- ✅ **Search books** by title, author, genre, series, year
- ✅ **Book details page** with comprehensive information
- ✅ **Book covers** with custom SVG placeholders
- ✅ **File format badges** (FB2, EPUB, PDF, etc.)
- ✅ **Book metadata** (author, genre, series, year, language)

#### **👥 User Management**
- ✅ **User authentication** with session persistence
- ✅ **User registration** and login
- ✅ **Password management** (change password)
- ✅ **User profiles** with editable information
- ✅ **Admin panel** for user management
- ✅ **Role-based access** (user, admin, superadmin)

#### **🔍 Content Discovery**
- ✅ **Authors browsing** with alphabetical navigation
- ✅ **Genres browsing** with category organization
- ✅ **Series browsing** with book collections
- ✅ **Advanced search** with multiple filters
- ✅ **Pagination** for large datasets

#### **🎨 User Interface**
- ✅ **Modern responsive design** with Tailwind CSS
- ✅ **Dark theme** optimized for reading
- ✅ **Mobile-friendly** layout
- ✅ **Smooth animations** and transitions
- ✅ **Loading states** and error handling
- ✅ **Toast notifications** for user feedback

#### **🔧 Technical Features**
- ✅ **Session persistence** across deployments
- ✅ **API rate limiting** and error handling
- ✅ **Database optimization** with proper indexing
- ✅ **Modular architecture** with separated concerns
- ✅ **Docker containerization** for easy deployment
- ✅ **Health monitoring** and logging

### 📚 **Content Features**

#### **📥 File Downloads**
- ✅ **Book files available** for download
- ✅ **Multiple formats** supported (FB2, EPUB, DJVU, etc.)
- ✅ **Download infrastructure** fully implemented
- ✅ **Error handling** provides clear user feedback

#### **🖼️ Media Content**
- ✅ **Author photos** available from database
- ✅ **Book covers** with proper image handling
- ✅ **Professional appearance** with real content

## 🏗️ Architecture

### **Backend (Node.js/Express)**
```
backend/
├── src/
│   ├── app.js              # Main application setup
│   ├── routes/             # API route handlers
│   │   ├── books.js        # Book-related endpoints
│   │   ├── authors.js      # Author-related endpoints
│   │   ├── genres.js       # Genre-related endpoints
│   │   ├── series.js       # Series-related endpoints
│   │   ├── auth.js         # Authentication endpoints
│   │   └── files.js        # File download endpoints
│   ├── services/           # Business logic
│   │   ├── BookService.js  # Book operations
│   │   ├── AuthorService.js # Author operations
│   │   └── AuthService.js  # Authentication logic
│   └── database/           # Database connection
└── public/                 # Static frontend files
    ├── js/
    │   ├── modules/        # Modular JavaScript
    │   │   ├── auth.js     # Authentication module
    │   │   ├── api.js      # API communication
    │   │   ├── ui.js       # UI management
    │   │   └── display.js  # Content display
    │   └── app.js          # Main application
    ├── css/                # Stylesheets
    └── index.html          # Main HTML file
```

### **Database (PostgreSQL)**
- **libbook**: Book metadata and information
- **libavtor/libavtorname**: Author information
- **libgenre/libgenrelist**: Genre categorization
- **libseq/libseqname**: Series information
- **libfilename**: Book file names and metadata
- **book_zip**: File archive mapping and storage info
- **users**: User accounts and authentication
- **sessions**: User session storage

## 🚀 Quick Start

### **Prerequisites**
- Docker and Docker Compose
- Node.js 18+ (for development)

### **Installation**
```bash
# Clone the repository
git clone <repository-url>
cd flibusta

# Configure environment (required)
cp .env.example .env
# Edit .env with your actual configuration values

# Start the application
make deploy  # Full deployment with health checks
# OR for quick deployment:
# docker compose up -d

# Access the application
open http://localhost:27102
```

> **⚠️ Security Note**: The `.env` file contains sensitive configuration including passwords and secrets. Never commit this file to version control. Use `.env.example` as a template.

### **Default Credentials**
- **Admin**: `admin` / `admin123`
- **User**: `user` / `user123`

## 🔧 Configuration

### **Environment Setup**

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your actual values:
   ```bash
   # Required: Change these from defaults
   SESSION_SECRET=your-unique-session-secret-here
   JWT_SECRET=your-unique-jwt-secret-here
   SUPERADMIN_PASSWORD=your-secure-password
   
   # Optional: Custom book path
   BOOKS_HOST_PATH=/path/to/your/books
   ```

> **🔒 Security**: Never commit `.env` to git. It's automatically ignored by `.gitignore`.

### **Environment Variables**
```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=flibusta
DB_USER=flibusta
DB_PASSWORD=flibusta

# Application
PORT=3000
NODE_ENV=production
SESSION_SECRET=your-super-secret-session-key
JWT_SECRET=your-super-secret-jwt-key

# File Paths
BOOKS_PATH=/app/flibusta
CACHE_PATH=/app/cache
AUTHORS_CACHE_PATH=/app/cache/authors
COVERS_CACHE_PATH=/app/cache/covers

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📊 API Endpoints

### **Authentication**
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/profile` - Update profile

### **Books**
- `GET /api/books/recent` - Recent books
- `GET /api/books/search` - Search books
- `GET /api/books/:id` - Book details
- `GET /api/books/author/:id` - Author's books
- `GET /api/books/genre/:code` - Genre books

### **Authors**
- `GET /api/authors` - All authors
- `GET /api/authors/:id` - Author details
- `GET /api/authors/letter/:letter` - Authors by letter

### **Genres**
- `GET /api/genres` - All genres
- `GET /api/genres/:code` - Genre details
- `GET /api/genres/category/:category` - Genres by category

### **Series**
- `GET /api/series` - All series
- `GET /api/series/:id` - Series details
- `GET /api/series/letter/:letter` - Series by letter

## 🎯 Development

### **Adding Real Book Files**
To enable actual book downloads:

1. **Obtain book files** (ZIP archives)
2. **Mount them** in docker-compose.yml:
   ```yaml
   volumes:
     - '/path/to/books:/app/flibusta'
   ```
3. **Import book_zip data** into the database
4. **Update libfilename table** with file mappings

### **Customization**
- **Styling**: Modify `backend/public/css/style.css`
- **Frontend logic**: Edit modules in `backend/public/js/modules/`
- **API endpoints**: Add routes in `backend/src/routes/`
- **Database**: Modify services in `backend/src/services/`

## 🔒 Security

### **Implemented Security Features**
- ✅ **Session management** with secure cookies
- ✅ **Password hashing** with bcrypt
- ✅ **SQL injection prevention** with parameterized queries
- ✅ **XSS protection** with proper input sanitization
- ✅ **CSRF protection** with session validation
- ✅ **Rate limiting** to prevent abuse
- ✅ **Role-based access control**

### **Recommended Enhancements**
- 🔒 **HTTPS enforcement** for production
- 🔒 **API key authentication** for external access
- 🔒 **Audit logging** for security events
- 🔒 **Input validation** with Joi or similar

## 📈 Performance

### **Optimizations**
- ✅ **Database indexing** on frequently queried columns
- ✅ **Connection pooling** for database efficiency
- ✅ **Static file caching** with nginx
- ✅ **API response caching** for repeated requests
- ✅ **Lazy loading** for large datasets
- ✅ **Image optimization** and compression

### **Monitoring**
- ✅ **Health check endpoints**
- ✅ **Error logging** with structured data
- ✅ **Performance metrics** collection
- ✅ **Database query optimization**

## 🤝 Contributing

### **Code Style**
- **JavaScript**: ES6+ with async/await
- **CSS**: Tailwind CSS utility classes
- **Database**: PostgreSQL with proper indexing
- **API**: RESTful design with JSON responses

### **Testing**
- **Unit tests**: Jest for backend services
- **Integration tests**: API endpoint testing
- **Frontend tests**: Manual testing with browser dev tools

## 📝 License

This project is a modern electronic library platform with full functionality for browsing, searching, and downloading books. The application structure and code are open source.

## 🆘 Support

### **Common Issues**
1. **Port conflicts**: Change ports in docker-compose.yml
2. **Database connection**: Check PostgreSQL container health
3. **File permissions**: Ensure proper volume mounting
4. **Memory issues**: Increase Docker memory allocation

### **Troubleshooting**
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs backend

# Restart services
docker-compose restart

# Rebuild containers
docker compose up -d --build

## 🧹 Housekeeping: Legacy scripts consolidated

Legacy shell scripts at the repo root have been archived. Prefer the Node manage CLI and Admin API instead:

- Download SQL: npm --prefix backend run manage download-sql
- Download covers: npm --prefix backend run manage download-covers
- Daily updates: npm --prefix backend run manage update-daily
- Update mappings: via Admin UI or npm --prefix backend run manage update-zip-mappings

If you previously used getsql.sh, setup_complete.sh, linux-installer.sh, or manage_nodejs.sh, see archive/legacy-scripts for stubs and notes.
```

---

**Flibusta** - Your modern electronic library platform! 📚✨


