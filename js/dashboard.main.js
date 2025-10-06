(function() {
    'use strict';
    
    function initMessageHandling() {
        window.addEventListener('message', (e) => {
            const allowedOrigins = [
                window.location.origin,
                'http://localhost:8000',
                'http://127.0.0.1:8000'
            ];
            
            if (!allowedOrigins.includes(e.origin)) {
                return;
            }
            
            if (e.data.type === 'themeChanged') {
                window.DashboardTheme.handleThemeMessage(e);
            } else if (e.data.type === 'toggleSidebar') {
                window.DashboardSidebar.toggleSidebar();
            }
        });
    }
    
    window.switchModule = window.DashboardNavigation.switchModule;
    window.toggleTheme = window.DashboardTheme.toggleTheme;
    
    document.addEventListener('DOMContentLoaded', function() {
        window.DashboardNavigation.initNavigation();
        window.DashboardStats.initStats();
        window.DashboardSidebar.initSidebar();
        window.DashboardTheme.initTheme();
        initMessageHandling();
    });
})();