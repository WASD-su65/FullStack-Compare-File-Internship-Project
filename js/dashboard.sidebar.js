(function() {
    'use strict';
    
    function initSidebar() {
        const sidebarToggle = document.getElementById('btnSidebarToggle');
        const sidebar = document.getElementById('sidebar');
        const contentArea = document.querySelector('.content-area');
        
        if (sidebarToggle && sidebar && contentArea) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                contentArea.classList.toggle('collapsed');
                
                const isCollapsed = sidebar.classList.contains('collapsed');
                localStorage.setItem('sidebarCollapsed', isCollapsed);
            });
            
            const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
            if (sidebarCollapsed) {
                sidebar.classList.add('collapsed');
                contentArea.classList.add('collapsed');
            }
        }
    }
    
    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const contentArea = document.querySelector('.content-area');
        if (sidebar && contentArea) {
            sidebar.classList.toggle('collapsed');
            contentArea.classList.toggle('collapsed');
        }
    }
    
    function hideSidebar() {
        const sidebar = document.getElementById('sidebar');
        const contentArea = document.querySelector('.content-area');
        if (sidebar) {
            sidebar.style.display = 'none';
        }
        if (contentArea) {
            contentArea.style.marginLeft = '0';
            contentArea.style.width = '100%';
        }
    }
    
    window.DashboardSidebar = { initSidebar, toggleSidebar, hideSidebar };
})();