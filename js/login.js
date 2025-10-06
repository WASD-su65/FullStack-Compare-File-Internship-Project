// Theme management
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const icon = document.getElementById('themeIcon');
    icon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
document.getElementById('themeIcon').textContent = savedTheme === 'dark' ? '☀️' : '🌙';

// Login form handling
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // XSS Protection - sanitize inputs
    const username = document.getElementById('username').value.trim().replace(/[<>"'&]/g, '');
    const password = document.getElementById('password').value;
    
    // Basic validation
    if (!username || username.length > 50 || !/^[a-zA-Z0-9._-]+$/.test(username)) {
        errorMessage.textContent = 'Invalid username format';
        errorMessage.style.display = 'block';
        return;
    }
    
    if (!password || password.length > 100) {
        errorMessage.textContent = 'Invalid password';
        errorMessage.style.display = 'block';
        return;
    }
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    
    // Reset error
    errorMessage.style.display = 'none';
    
    // Show loading
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="loading"></span>กำลังเข้าสู่ระบบ...';
    
    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Save token and user info
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('user_info', JSON.stringify(data.user));
            
            // Redirect to dashboard
            window.location.href = '/dashboard';
        } else {
            throw new Error(data.detail || 'Login failed');
        }
    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.style.display = 'block';
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'เข้าสู่ระบบ';
    }
});

// Check if already logged in
const token = localStorage.getItem('access_token');
if (token) {
    // Verify token
    fetch('/auth/me', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    }).then(response => {
        if (response.ok) {
            window.location.href = '/dashboard';
        }
    });
}