// Update the updateSystemMetrics function to use real data
function updateSystemMetrics() {
    fetch('/api/system/resources')
        .then(response => response.json())
        .then(data => {
            // Update CPU usage
            document.getElementById('cpuUsage').textContent = data.cpu.usage + '%';
            
            // Update memory usage  
            document.getElementById('memoryUsage').textContent = data.memory.percentage + '%';
            
            // Update disk usage
            document.getElementById('diskUsage').textContent = data.disk.percentage + '%';
            
            // Update uptime
            document.getElementById('uptime').textContent = data.uptime;
        })
        .catch(error => {
            console.error('Error fetching system resources:', error);
            // Keep placeholder values on error
            document.getElementById('cpuUsage').textContent = '--';
            document.getElementById('memoryUsage').textContent = '--';
            document.getElementById('diskUsage').textContent = '--';
            document.getElementById('uptime').textContent = '--';
        });
}

// Update the WebSocket message handler
const originalUpdateCurrentSection = MissionControl.prototype.updateCurrentSection;
MissionControl.prototype.updateCurrentSection = function() {
    switch (this.currentSection) {
        case 'overview':
            this.updateOverview();
            break;
        case 'containers':
            this.updateContainers();
            break;
        case 'system':
            updateSystemMetrics(); // Use the new function
            break;
        case 'network':
            this.updateNetwork();
            break;
        case 'logs':
            this.updateLogs();
            break;
    }
};
