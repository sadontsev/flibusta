// Auth Module - Handles authentication and user management
class AuthModule {
    constructor(app) {
        this.app = app;
        this.currentUser = null;
    }

    async checkAuth() {
        try {
            console.log('checkAuth called');
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });
            if (response.ok) {
                const result = await response.json();
                console.log('checkAuth result =', result);
                this.currentUser = result.data;
                console.log('checkAuth currentUser set to =', this.currentUser);
                this.app.ui.updateUIForAuthenticatedUser(this.currentUser);
                return true;
            } else {
                console.log('checkAuth failed, response not ok');
                this.app.ui.updateUIForUnauthenticatedUser();
                return false;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.app.ui.updateUIForUnauthenticatedUser();
            return false;
        }
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
                this.app.ui.updateUIForAuthenticatedUser(this.currentUser);
                this.app.ui.showToast('Успешно', 'Вы успешно вошли в систему');
                this.app.ui.hideLoginModal();
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
            this.currentUser = null;
            this.app.ui.updateUIForUnauthenticatedUser();
            this.app.ui.showToast('Успешно', 'Вы вышли из системы');
            this.app.showHome();
        } catch (error) {
            console.error('Logout error:', error);
            this.app.ui.showToast('Ошибка', 'Ошибка при выходе из системы', 'error');
        }
    }

    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorDiv = document.getElementById('changePasswordError');

        if (!currentPassword || !newPassword || !confirmPassword) {
            errorDiv.textContent = 'Пожалуйста, заполните все поля';
            errorDiv.classList.remove('hidden');
            return;
        }

        if (newPassword !== confirmPassword) {
            errorDiv.textContent = 'Новые пароли не совпадают';
            errorDiv.classList.remove('hidden');
            return;
        }

        if (newPassword.length < 6) {
            errorDiv.textContent = 'Новый пароль должен содержать минимум 6 символов';
            errorDiv.classList.remove('hidden');
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
                this.app.ui.showToast('Успешно', 'Пароль изменен');
                this.app.ui.hideChangePasswordModal();
                document.getElementById('changePasswordForm').reset();
                errorDiv.classList.add('hidden');
            } else {
                errorDiv.textContent = result.error || 'Ошибка изменения пароля';
                errorDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Change password error:', error);
            errorDiv.textContent = 'Ошибка соединения';
            errorDiv.classList.remove('hidden');
        }
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
                this.app.ui.updateUIForAuthenticatedUser(this.currentUser);
                this.app.ui.showToast('Успешно', 'Профиль обновлен');
                this.app.ui.hideProfileModal();
                errorDiv.classList.add('hidden');
            } else {
                errorDiv.textContent = result.error || 'Ошибка обновления профиля';
                errorDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Update profile error:', error);
            errorDiv.textContent = 'Ошибка соединения';
            errorDiv.classList.remove('hidden');
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
            errorDiv.classList.remove('hidden');
            return;
        }

        if (username.length < 3) {
            errorDiv.textContent = 'Имя пользователя должно содержать минимум 3 символа';
            errorDiv.classList.remove('hidden');
            return;
        }

        if (password.length < 6) {
            errorDiv.textContent = 'Пароль должен содержать минимум 6 символов';
            errorDiv.classList.remove('hidden');
            return;
        }

        try {
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    username,
                    password,
                    email,
                    display_name: displayName,
                    role
                })
            });

            const result = await response.json();

            if (result.success) {
                this.app.ui.showToast('Успешно', 'Пользователь создан');
                this.app.ui.hideCreateUserModal();
                document.getElementById('createUserForm').reset();
                errorDiv.classList.add('hidden');
                // Refresh admin panel if currently viewing it
                if (this.app.currentSection === 'admin') {
                    this.app.showAdmin();
                }
            } else {
                errorDiv.textContent = result.error || 'Ошибка создания пользователя';
                errorDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Create user error:', error);
            errorDiv.textContent = 'Ошибка соединения';
            errorDiv.classList.remove('hidden');
        }
    }

    async deleteUser(userId) {
        if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                this.app.ui.showToast('Успешно', 'Пользователь удален');
                // Refresh admin panel
                if (this.app.currentSection === 'admin') {
                    this.app.showAdmin();
                }
            } else {
                this.app.ui.showToast('Ошибка', result.error || 'Ошибка удаления пользователя', 'error');
            }
        } catch (error) {
            console.error('Delete user error:', error);
            this.app.ui.showToast('Ошибка', 'Ошибка соединения', 'error');
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isAdmin() {
        console.log('isAdmin called, currentUser =', this.currentUser);
        const result = this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'superadmin');
        console.log('isAdmin result =', result);
        return result;
    }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthModule;
}
