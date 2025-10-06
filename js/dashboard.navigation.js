(function() {
    'use strict';
    
    function initNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        const moduleContents = document.querySelectorAll('.module-content');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                const targetModule = link.getAttribute('data-module');
                
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                moduleContents.forEach(content => {
                    content.classList.remove('active');
                });
                
                const targetContent = document.getElementById(targetModule);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    }
    
    function switchModule(module) {
        const navLinks = document.querySelectorAll('.nav-link');
        const moduleContents = document.querySelectorAll('.module-content');
        
        navLinks.forEach(l => l.classList.remove('active'));
        const targetLink = document.querySelector(`[data-module="${module}"]`);
        if (targetLink) targetLink.classList.add('active');
        
        moduleContents.forEach(content => content.classList.remove('active'));
        const targetContent = document.getElementById(module);
        if (targetContent) targetContent.classList.add('active');
    }
    
    window.DashboardNavigation = { initNavigation, switchModule };
})();