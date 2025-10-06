class AuthManager {
    static getToken() {
        return localStorage.getItem('access_token');
    }
    
    static getUserInfo() {
        const userInfo = localStorage.getItem('user_info');
        return userInfo ? JSON.parse(userInfo) : null;
    }
    
    static isAuthenticated() {
        return !!this.getToken();
    }
    
    static logout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_info');
        
        if (window.DashboardSidebar && window.DashboardSidebar.hideSidebar) {
            window.DashboardSidebar.hideSidebar();
        }
        
        // Force reload to clear all iframe content
        if (window.parent && window.parent !== window) {
            window.parent.location.href = '/';
        } else {
            window.location.href = '/';
        }
    }
    
    static async checkAuth() {
        const token = this.getToken();
        if (!token) {
            if (window.DashboardSidebar && window.DashboardSidebar.hideSidebar) {
                window.DashboardSidebar.hideSidebar();
            }
            window.location.href = '/';
            return false;
        }
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const exp = payload.exp * 1000; // Convert to milliseconds
            const now = Date.now();
            const timeLeft = exp - now;
            
            if (timeLeft < 30 * 60 * 1000 && timeLeft > 0) {
                const minutes = Math.floor(timeLeft / (60 * 1000));
            }
            
            if (timeLeft <= 0) {
                this.logout();
                return false;
            }
        } catch (e) {
            this.logout();
            return false;
        }
        
        try {
            const response = await fetch('/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                this.logout();
                return false;
            }
            
            return true;
        } catch (error) {
            this.logout();
            return false;
        }
    }
    
    static createUserProfile() {
        const userInfo = this.getUserInfo();
        if (!userInfo) return '';
        
        const displayName = userInfo.name || userInfo.username || 'User';
        
        return `
            <div class="user-profile">
                <span class="user-icon">👤</span>
                <span class="user-name">${this.escapeHtml(displayName)}</span>
                <button class="logout-btn" onclick="AuthManager.logout()">
                    <span class="logout-icon">🚪</span>
                    Logout
                </button>
            </div>
        `;
    }
    
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (path !== '/login' && path !== '/' && !path.includes('login.html')) {
        AuthManager.checkAuth();
        
        setInterval(() => {
            AuthManager.checkAuth();
        }, 5 * 60 * 1000);
    }
});