(function() {
    'use strict';
    
    function escapeHtml(text) {
        if (typeof text !== 'string') {
            return text;
        }
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function safeSetInnerHTML(element, html) {
        if (!element) return;
        
        const tempDiv = document.createElement('div');
        tempDiv.textContent = html;  // Safe: no script execution
        element.textContent = tempDiv.textContent || '';
    }
    
    function safeSetTextContent(element, text) {
        if (!element) return;
        element.textContent = text;
    }
    
    function validateFilePath(path) {
        if (!path || typeof path !== 'string') {
            return false;
        }
        
        const dangerous = ['../', '..\\', './', '.\\'];
        return !dangerous.some(pattern => path.includes(pattern));
    }
    
    function validateUrl(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }
        
        try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return false;
            }
            
            const hostname = parsed.hostname;
            const privateRanges = [
                /^127\./,
                /^10\./,
                /^172\.(1[6-9]|2[0-9]|3[01])\./,
                /^192\.168\./,
                /^169\.254\./,
                /^localhost$/i
            ];
            
            return !privateRanges.some(range => range.test(hostname));
        } catch (e) {
            return false;
        }
    }
    
    window.SecurityUtils = {
        escapeHtml,
        safeSetInnerHTML,
        safeSetTextContent,
        validateFilePath,
        validateUrl
    };
})();