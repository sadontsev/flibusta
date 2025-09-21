// UI Module - Handles UI updates, modals, and notifications
class UIModule {
    constructor(app) {
        this.app = app;
    }

    updateUIForAuthenticatedUser(user) {
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('userDropdown').style.display = 'block';
        document.getElementById('userDisplayName').textContent = user.display_name || user.username;
        
        // Show admin section for admin/superadmin users
        if (user.role === 'admin' || user.role === 'superadmin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        }
    }

    updateUIForUnauthenticatedUser() {
        document.getElementById('loginBtn').style.display = 'block';
        document.getElementById('userDropdown').style.display = 'none';
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }

    // Modal Management
    showLoginModal() {
        // Redirect to login page instead of showing modal
        window.location.href = '/login';
    }

    hideLoginModal() {
        // This method is kept for compatibility but does nothing
        // since we now use a dedicated login page
    }

    showChangePassword() {
        document.getElementById('changePasswordModal').classList.remove('hidden');
    }

    hideChangePasswordModal() {
        document.getElementById('changePasswordModal').classList.add('hidden');
    }

    showProfile() {
        const user = this.app.auth.getCurrentUser();
        document.getElementById('profileUsername').value = user.username;
        document.getElementById('profileEmail').value = user.email || '';
        document.getElementById('profileDisplayName').value = user.display_name || '';
        
        document.getElementById('profileModal').classList.remove('hidden');
    }

    hideProfileModal() {
        document.getElementById('profileModal').classList.add('hidden');
    }

    showCreateUserModal() {
        document.getElementById('createUserModal').classList.remove('hidden');
    }

    hideCreateUserModal() {
        document.getElementById('createUserModal').classList.add('hidden');
    }

    // Toast Notifications
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

    hideToast() {
        document.getElementById('toast').classList.add('hidden');
    }

    // Loading and Error States
    showLoading() {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;

        // Get search interfaces to preserve them
        const booksInterface = document.getElementById('books-search-interface');
        const authorsInterface = document.getElementById('authors-search-interface');
        
        contentArea.innerHTML = `
            <div class="flex items-center justify-center py-12">
                <div class="loading-spinner"></div>
                <span class="ml-3 text-gray-300">Загрузка...</span>
            </div>
        `;
        
        // Re-add search interfaces if they exist
        if (booksInterface) {
            contentArea.insertBefore(booksInterface, contentArea.firstChild);
        }
        if (authorsInterface) {
            contentArea.insertBefore(authorsInterface, contentArea.firstChild);
        }
    }

    showError(message) {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;

        // Get search interfaces to preserve them
        const booksInterface = document.getElementById('books-search-interface');
        const authorsInterface = document.getElementById('authors-search-interface');
        
        contentArea.innerHTML = `
            <div class="flex items-center justify-center py-12">
                <div class="text-center">
                    <i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
                    <h3 class="text-xl font-semibold text-white mb-2">Ошибка</h3>
                    <p class="text-gray-300">${message}</p>
                </div>
            </div>
        `;
        
        // Re-add search interfaces if they exist
        if (booksInterface) {
            contentArea.insertBefore(booksInterface, contentArea.firstChild);
        }
        if (authorsInterface) {
            contentArea.insertBefore(authorsInterface, contentArea.firstChild);
        }
    }

    // Navigation Updates
    updateActiveNavigation(section) {
        // Remove active class from all nav items
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('bg-gray-700', 'text-white');
            link.classList.add('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');
        });

        // Add active class to current section
        const activeLink = document.querySelector(`[data-section="${section}"]`);
        if (activeLink) {
            activeLink.classList.remove('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');
            activeLink.classList.add('bg-gray-700', 'text-white');
        }
    }

    // Search UI
    clearSearch() {
        document.getElementById('searchInput').value = '';
    }

    // Responsive UI helpers
    isMobile() {
        return window.innerWidth < 768;
    }

    toggleMobileMenu() {
        const mobileMenu = document.getElementById('mobileMenu');
        if (mobileMenu) {
            mobileMenu.classList.toggle('hidden');
        }
    }

    // Content area management
    setContent(html) {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;

        // Get search interfaces to preserve them
        const booksInterface = document.getElementById('books-search-interface');
        const authorsInterface = document.getElementById('authors-search-interface');
        
        // Set new content
        contentArea.innerHTML = html;
        
        // Re-add search interfaces if they exist
        if (booksInterface) {
            contentArea.insertBefore(booksInterface, contentArea.firstChild);
        }
        if (authorsInterface) {
            contentArea.insertBefore(authorsInterface, contentArea.firstChild);
        }
    }

    appendContent(html) {
        document.getElementById('contentArea').insertAdjacentHTML('beforeend', html);
    }

    clearContent() {
        document.getElementById('contentArea').innerHTML = '';
    }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIModule;
}
