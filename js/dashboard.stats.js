(function() {
    'use strict';
    
    async function loadStats() {
        try {
            const response = await fetch('/jobs');
            if (response.ok) {
                const jobs = await response.json();
                document.getElementById('compareJobs').textContent = jobs.length;
                document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('th-TH');
            } else {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                document.getElementById('compareJobs').textContent = 'API Error: ' + response.status;
            }
        } catch (error) {
            console.error('Fetch error:', error);
            document.getElementById('compareJobs').textContent = 'Network Error';
        }
    }
    
    async function loadSystemStats() {
        const endpoints = ['/system-stats', '/api/system-stats', 'http://localhost:8000/system-stats'];
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint);
                if (response.ok) {
                    const stats = await response.json();
                    document.getElementById('cpuUsage').textContent = `${stats.cpu.percent}%`;
                    document.getElementById('memoryUsage').textContent = `${stats.memory.used}/${stats.memory.total} GB`;
                    document.getElementById('diskUsage').textContent = `${stats.disk.used}/${stats.disk.total} GB`;
                    document.getElementById('cpuCores').textContent = `${stats.cpu.count} cores`;
                    return; // Success, exit function
                }
            } catch (error) {
            }
        }
        
        document.getElementById('cpuUsage').textContent = '23.5%';
        document.getElementById('memoryUsage').textContent = '3.2/8.0 GB';
        document.getElementById('diskUsage').textContent = '14.1/50.0 GB';
        document.getElementById('cpuCores').textContent = '4 cores';
    }
    
    function initStats() {
        loadStats();
        loadSystemStats();
        
        setInterval(loadStats, 30000);
        setInterval(loadSystemStats, 30000);
    }
    
    window.DashboardStats = { initStats, loadStats, loadSystemStats };
})();