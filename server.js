const express = require('express');
const Docker = require('dockerode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const WebSocket = require('ws');
const http = require('http');

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
    try {
        require('dotenv').config();
    } catch (err) {
        console.warn('dotenv not available, using environment variables');
    }
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const port = process.env.PORT || 3000;
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Configuration from environment variables
const HA_URL = process.env.HA_URL || 'http://homeassistant:8123';
const HA_TOKEN = process.env.HA_TOKEN;
const RATCHET_GATEWAY_URL = process.env.RATCHET_GATEWAY_URL || 'http://100.84.150.102:18789';
const RATCHET_GATEWAY_TOKEN = process.env.RATCHET_GATEWAY_TOKEN;

// Validate required environment variables
if (!HA_TOKEN) {
    console.warn('Warning: HA_TOKEN not set - Home Assistant integration will be disabled');
}
if (!RATCHET_GATEWAY_TOKEN) {
    console.warn('Warning: RATCHET_GATEWAY_TOKEN not set - Ratchet Gateway integration will be disabled');
}

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// System monitoring utilities
class SystemMonitor {
    static async getCPUUsage() {
        return new Promise((resolve) => {
            const startUsage = process.cpuUsage();
            const startTime = process.hrtime();
            
            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const endTime = process.hrtime(startTime);
                
                const totalTime = endTime[0] * 1000000 + endTime[1] / 1000;
                const cpuPercent = ((endUsage.user + endUsage.system) / totalTime * 100).toFixed(1);
                resolve(cpuPercent);
            }, 1000);
        });
    }
    
    static getMemoryUsage() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        
        return {
            total: Math.round(totalMem / (1024 * 1024 * 1024)),
            used: Math.round(usedMem / (1024 * 1024 * 1024)),
            free: Math.round(freeMem / (1024 * 1024 * 1024)),
            percentage: Math.round((usedMem / totalMem) * 100)
        };
    }
    
    static async getDiskUsage() {
        return new Promise((resolve) => {
            exec("df -h / | awk 'NR==2 {print $2,$3,$4,$5}'", (error, stdout) => {
                if (error) {
                    resolve({ error: 'Unable to get disk info' });
                    return;
                }
                
                const [total, used, available, percentage] = stdout.trim().split(' ');
                resolve({
                    total,
                    used,
                    available,
                    percentage: parseInt(percentage)
                });
            });
        });
    }
    
    static getUptime() {
        const uptime = os.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        if (days > 0) {
            return `${days}d ${hours}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }
    
    static getLoadAverage() {
        const load = os.loadavg();
        return {
            '1m': load[0].toFixed(2),
            '5m': load[1].toFixed(2),
            '15m': load[2].toFixed(2)
        };
    }
    
    static async getSystemInfo() {
        const cpuUsage = await this.getCPUUsage();
        const memUsage = this.getMemoryUsage();
        const diskUsage = await this.getDiskUsage();
        const uptime = this.getUptime();
        const loadAvg = this.getLoadAverage();
        
        return {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            cpu: {
                usage: cpuUsage,
                cores: os.cpus().length,
                model: os.cpus()[0]?.model || 'Unknown'
            },
            memory: memUsage,
            disk: diskUsage,
            uptime: uptime,
            load: loadAvg,
            timestamp: new Date().toISOString()
        };
    }
}

// Home Assistant integration
class HomeAssistant {
    static async getSystemInfo() {
        if (!HA_TOKEN) {
            return { error: 'Home Assistant token not configured' };
        }
        
        try {
            const response = await fetch(`${HA_URL}/api/`, {
                headers: {
                    'Authorization': `Bearer ${HA_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Home Assistant API error:', error);
            return { error: error.message };
        }
    }
    
    static async getHostInfo() {
        if (!HA_TOKEN) {
            return { error: 'Home Assistant token not configured' };
        }
        
        try {
            const response = await fetch(`${HA_URL}/api/hassio/host/info`, {
                headers: {
                    'Authorization': `Bearer ${HA_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Home Assistant host info error:', error);
            return { error: error.message };
        }
    }
    
    static async getSupervisorInfo() {
        if (!HA_TOKEN) {
            return { error: 'Home Assistant token not configured' };
        }
        
        try {
            const response = await fetch(`${HA_URL}/api/hassio/supervisor/info`, {
                headers: {
                    'Authorization': `Bearer ${HA_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Home Assistant supervisor info error:', error);
            return { error: error.message };
        }
    }
}

// Ratchet Gateway integration
class RatchetGateway {
    static async getSystemStatus() {
        if (!RATCHET_GATEWAY_TOKEN) {
            return { error: 'Ratchet Gateway token not configured' };
        }
        
        try {
            const response = await fetch(`${RATCHET_GATEWAY_URL}/api/system`, {
                headers: {
                    'Authorization': `Bearer ${RATCHET_GATEWAY_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ratchet Gateway API error:', error);
            return { error: error.message };
        }
    }
    
    static async getGatewayInfo() {
        if (!RATCHET_GATEWAY_TOKEN) {
            return { error: 'Ratchet Gateway token not configured' };
        }
        
        try {
            const response = await fetch(`${RATCHET_GATEWAY_URL}/api/status`, {
                headers: {
                    'Authorization': `Bearer ${RATCHET_GATEWAY_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ratchet Gateway status error:', error);
            return { error: error.message };
        }
    }
}

// Get Docker system info
async function getDockerSystemInfo() {
    try {
        const info = await docker.info();
        const version = await docker.version();
        return { info, version };
    } catch (error) {
        console.error('Error getting Docker info:', error);
        return { error: error.message };
    }
}

// Get container status
async function getContainerStatus() {
    try {
        const containers = await docker.listContainers({ all: true });
        return containers.map(container => ({
            id: container.Id.substr(0, 12),
            name: container.Names[0].replace('/', ''),
            image: container.Image,
            status: container.Status,
            state: container.State,
            ports: container.Ports,
            created: container.Created
        }));
    } catch (error) {
        console.error('Error getting containers:', error);
        return [];
    }
}

// API Routes
app.get('/api/system/docker', async (req, res) => {
    const systemInfo = await getDockerSystemInfo();
    res.json(systemInfo);
});

app.get('/api/system/resources', async (req, res) => {
    const systemInfo = await SystemMonitor.getSystemInfo();
    res.json(systemInfo);
});

app.get('/api/system/hosts', async (req, res) => {
    // Multi-host system information with real integrations
    const jamlifeMetrics = await SystemMonitor.getSystemInfo();
    
    // Get Home Assistant info
    const haSystem = await HomeAssistant.getSystemInfo();
    const haHost = await HomeAssistant.getHostInfo();
    const haSupervisor = await HomeAssistant.getSupervisorInfo();
    
    // Get Ratchet Gateway info  
    const ratchetSystem = await RatchetGateway.getSystemStatus();
    const ratchetInfo = await RatchetGateway.getGatewayInfo();
    
    const hosts = {
        jamlife: {
            name: 'JAMLIFE Server',
            type: 'media_server',
            status: 'online',
            metrics: jamlifeMetrics,
            description: 'Hetzner dedicated server running Saltbox + Docker'
        },
        homeassistant: {
            name: 'Home Assistant',
            type: 'automation_hub',
            status: haSystem.error ? 'offline' : 'online',
            metrics: haSystem.error ? { error: haSystem.error } : {
                version: haSystem.version,
                hostname: haHost.data?.hostname || 'homeassistant',
                uptime: haSupervisor.data?.uptime || 'Unknown',
                supervisor_version: haSupervisor.data?.version || 'Unknown',
                // Parse memory/CPU from supervisor info if available
                cpu: haSupervisor.data?.cpu_percent || '--',
                memory: haSupervisor.data?.memory_percent || '--'
            },
            description: 'Home automation and IoT control center'
        },
        ratchet: {
            name: 'Ratchet Gateway',
            type: 'ai_gateway',
            status: ratchetSystem.error ? 'offline' : 'online',
            metrics: ratchetSystem.error ? { error: ratchetSystem.error } : {
                gateway_version: ratchetInfo.version || 'Unknown',
                uptime: ratchetInfo.uptime || 'Unknown',
                active_sessions: ratchetInfo.sessions || 0,
                // Add any other gateway-specific metrics
                ...ratchetSystem
            },
            description: 'OpenClaw AI gateway and orchestration hub'
        }
    };
    
    res.json(hosts);
});

app.get('/api/containers', async (req, res) => {
    const containers = await getContainerStatus();
    res.json(containers);
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Legacy endpoint for backwards compatibility
app.get('/api/system', async (req, res) => {
    const systemInfo = await getDockerSystemInfo();
    res.json(systemInfo);
});

// WebSocket for real-time updates
wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    // Send initial data
    const sendUpdate = async () => {
        try {
            const containers = await getContainerStatus();
            const dockerSystem = await getDockerSystemInfo();
            const systemResources = await SystemMonitor.getSystemInfo();
            
            ws.send(JSON.stringify({
                type: 'update',
                containers,
                system: dockerSystem,
                resources: systemResources,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Error sending WebSocket update:', error);
        }
    };
    
    sendUpdate();
    
    // Send updates every 30 seconds
    const interval = setInterval(sendUpdate, 30000);
    
    ws.on('close', () => {
        clearInterval(interval);
        console.log('WebSocket client disconnected');
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clearInterval(interval);
    });
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Mission Control running on port ${port}`);
    console.log(`Home Assistant URL: ${HA_URL}`);
    console.log(`Ratchet Gateway URL: ${RATCHET_GATEWAY_URL}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
