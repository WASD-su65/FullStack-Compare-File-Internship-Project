(function() {
    'use strict';
    
    function toggleTheme() {
        const html = document.documentElement;
        const btn = document.getElementById('btnTheme');
        const icon = btn.querySelector('.theme-icon');
        const text = btn.querySelector('.theme-text');
        const currentTheme = html.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        html.setAttribute('data-theme', newTheme);
        icon.textContent = newTheme === 'light' ? '🌙' : '☀️';
        text.textContent = newTheme === 'light' ? 'Dark' : 'Light';
        localStorage.setItem('theme', newTheme);
        
        document.documentElement.setAttribute('data-theme', newTheme);
        
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                iframe.contentWindow.postMessage({ type: 'themeChanged', theme: newTheme }, '*');
            } catch (e) {
            }
        });
    }
    
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        const themeBtn = document.getElementById('btnTheme');
        if (themeBtn) {
            const icon = themeBtn.querySelector('.theme-icon');
            const text = themeBtn.querySelector('.theme-text');
            if (icon && text) {
                icon.textContent = savedTheme === 'light' ? '🌙' : '☀️';
                text.textContent = savedTheme === 'light' ? 'Dark' : 'Light';
            }
        }
        
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            iframe.addEventListener('load', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
                try {
                    iframe.contentWindow.postMessage({ type: 'themeChanged', theme: currentTheme }, '*');
                } catch (e) {
                }
            });
        });
    }
    
    function handleThemeMessage(e) {
        if (e.data.type === 'themeChanged') {
            const newTheme = e.data.theme;
            const html = document.documentElement;
            const btn = document.getElementById('btnTheme');
            
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            if (btn) {
                const icon = btn.querySelector('.theme-icon');
                const text = btn.querySelector('.theme-text');
                if (icon && text) {
                    icon.textContent = newTheme === 'light' ? '🌙' : '☀️';
                    text.textContent = newTheme === 'light' ? 'Dark' : 'Light';
                }
            }
            
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                if (iframe.contentWindow !== e.source) {
                    try {
                        iframe.contentWindow.postMessage({ type: 'themeChanged', theme: newTheme }, '*');
                    } catch (err) {
                    }
                }
            });
        }
    }
    
    window.DashboardTheme = { initTheme, toggleTheme, handleThemeMessage };
})();