// @ts-nocheck
// UI Module - Handles UI updates, modals, and notifications (TypeScript)
class UIModuleNG {
  app: any;
  constructor(app: any) {
    this.app = app;
    this.hideAllModals();
  }

  updateUIForAuthenticatedUser(user: any) {
    (document.getElementById('loginBtn') as HTMLElement).style.display = 'none';
    (document.getElementById('userDropdown') as HTMLElement).style.display = 'block';
    (document.getElementById('userDisplayName') as HTMLElement).textContent = user.display_name || user.username;
    if (user.role === 'admin' || user.role === 'superadmin') {
      document.querySelectorAll('.admin-only').forEach(el => (el as HTMLElement).style.display = 'block');
    }
  }

  updateUIForUnauthenticatedUser() {
    (document.getElementById('loginBtn') as HTMLElement).style.display = 'block';
    (document.getElementById('userDropdown') as HTMLElement).style.display = 'none';
    document.querySelectorAll('.admin-only').forEach(el => (el as HTMLElement).style.display = 'none');
  }

  showLoginModal() { window.location.href = '/login'; }
  hideLoginModal() {}

  showChangePassword() {
    const el = document.getElementById('changePasswordModal');
    if (!el) return; el.classList.remove('hidden'); el.classList.add('flex');
  }
  hideChangePasswordModal() {
    const el = document.getElementById('changePasswordModal');
    if (!el) return; el.classList.add('hidden'); el.classList.remove('flex');
  }

  showProfile() {
    const user = this.app.auth.getCurrentUser();
    (document.getElementById('profileUsername') as HTMLInputElement).value = user.username;
    (document.getElementById('profileEmail') as HTMLInputElement).value = user.email || '';
    (document.getElementById('profileDisplayName') as HTMLInputElement).value = user.display_name || '';
    const el = document.getElementById('profileModal');
    if (!el) return; el.classList.remove('hidden'); el.classList.add('flex');
  }
  hideProfileModal() {
    const el = document.getElementById('profileModal');
    if (!el) return; el.classList.add('hidden'); el.classList.remove('flex');
  }

  showCreateUserModal() {
    const el = document.getElementById('createUserModal');
    if (!el) return; el.classList.remove('hidden'); el.classList.add('flex');
  }
  hideCreateUserModal() {
    const el = document.getElementById('createUserModal');
    if (!el) return; el.classList.add('hidden'); el.classList.remove('flex');
  }

  hideAllModals() {
    ['changePasswordModal','profileModal','createUserModal'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) {
        el.classList.add('hidden'); el.classList.remove('flex');
      }
    });
  }

  showToast(title: string, message: string, type: 'info'|'error'|'success' = 'info') {
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toastTitle');
    const toastBody = document.getElementById('toastBody');
    if (!toast || !toastTitle || !toastBody) return;
    toastTitle.textContent = title;
    toastBody.textContent = message;
    if (type === 'error') {
      toast.className = 'fixed bottom-4 right-4 bg-red-800 border border-red-700 rounded-lg shadow-xl z-50 max-w-sm';
    } else {
      toast.className = 'fixed bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-w-sm';
    }
    toast.classList.remove('hidden');
    setTimeout(() => this.hideToast(), 5000);
  }
  hideToast() { document.getElementById('toast')?.classList.add('hidden'); }

  showLoading() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    const booksInterface = document.getElementById('books-search-interface');
    const authorsInterface = document.getElementById('authors-search-interface');
    contentArea.innerHTML = `
            <div class="flex items-center justify-center py-12">
                <div class="loading-spinner"></div>
                <span class="ml-3 text-gray-300">Загрузка...</span>
            </div>`;
    if (booksInterface) contentArea.insertBefore(booksInterface, contentArea.firstChild);
    if (authorsInterface) contentArea.insertBefore(authorsInterface, contentArea.firstChild);
  }

  showError(message: string) {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    const booksInterface = document.getElementById('books-search-interface');
    const authorsInterface = document.getElementById('authors-search-interface');
    contentArea.innerHTML = `
            <div class="flex items-center justify-center py-12">
                <div class="text-center">
                    <i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
                    <h3 class="text-xl font-semibold text-white mb-2">Ошибка</h3>
                    <p class="text-gray-300">${message}</p>
                </div>
            </div>`;
    if (booksInterface) contentArea.insertBefore(booksInterface, contentArea.firstChild);
    if (authorsInterface) contentArea.insertBefore(authorsInterface, contentArea.firstChild);
  }

  updateActiveNavigation(section: string) {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('bg-gray-700','text-white');
      link.classList.add('text-gray-300','hover:bg-gray-700','hover:text-white');
    });
    const activeLink = document.querySelector(`[data-section="${section}"]`);
    if (activeLink) {
      activeLink.classList.remove('text-gray-300','hover:bg-gray-700','hover:text-white');
      activeLink.classList.add('bg-gray-700','text-white');
    }
  }

  clearSearch() { const el = document.getElementById('searchInput') as HTMLInputElement | null; if (el) el.value = ''; }
  isMobile() { return window.innerWidth < 768; }
  toggleMobileMenu() { document.getElementById('mobileMenu')?.classList.toggle('hidden'); }

  setContent(html: string) {
    const contentArea = document.getElementById('contentArea'); if (!contentArea) return;
    const booksInterface = document.getElementById('books-search-interface');
    const authorsInterface = document.getElementById('authors-search-interface');
    contentArea.innerHTML = html;
    if (booksInterface) contentArea.insertBefore(booksInterface, contentArea.firstChild);
    if (authorsInterface) contentArea.insertBefore(authorsInterface, contentArea.firstChild);
  }
  appendContent(html: string) { document.getElementById('contentArea')?.insertAdjacentHTML('beforeend', html); }
  clearContent() { const el = document.getElementById('contentArea'); if (el) el.innerHTML = ''; }
}

// Expose globally
(window as unknown as Record<string, unknown>).UIModule = (window as unknown as Record<string, unknown>).UIModule || UIModuleNG;
