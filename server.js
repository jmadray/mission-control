const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

// Config from environment
const RATCHET_GATEWAY_URL = process.env.RATCHET_GATEWAY_URL || 'http://100.84.150.102:18789';
const RATCHET_GATEWAY_TOKEN = process.env.RATCHET_GATEWAY_TOKEN;

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize tasks.json if missing
if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify({ tasks: [], version: '1.0.0' }, null, 2));
}

// Middleware
app.use(express.json());
app.use(express.static('public'));

// GET /api/tasks - Return current tasks
app.get('/api/tasks', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
        res.json(data);
    } catch (err) {
        console.error('Error reading tasks:', err);
        res.status(500).json({ error: 'Failed to read tasks' });
    }
});

// POST /api/tasks - Save tasks and notify Ratchet
app.post('/api/tasks', async (req, res) => {
    try {
        const oldData = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
        const newData = req.body;
        
        // Save to file
        fs.writeFileSync(TASKS_FILE, JSON.stringify(newData, null, 2));
        
        // Find tasks that moved to in_progress
        const oldTasks = oldData.tasks || [];
        const newTasks = newData.tasks || [];
        
        const newInProgress = newTasks.filter(t => 
            t.status === 'in_progress' && 
            !oldTasks.find(ot => ot.id === t.id && ot.status === 'in_progress')
        );
        
        // Notify Ratchet for each new in_progress task
        if (RATCHET_GATEWAY_TOKEN && newInProgress.length > 0) {
            for (const task of newInProgress) {
                await notifyRatchet(task);
            }
        }
        
        res.json({ success: true, notified: newInProgress.length });
    } catch (err) {
        console.error('Error saving tasks:', err);
        res.status(500).json({ error: 'Failed to save tasks' });
    }
});

// GET /health - Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Notify Ratchet Gateway
async function notifyRatchet(task) {
    try {
        const message = `🎛️ **Mission Control Task Started**\n\n` +
            `**Task:** ${task.title}\n` +
            `**ID:** ${task.id}\n` +
            `**Priority:** ${task.priority || 'normal'}\n` +
            `**Description:** ${task.description || 'No description'}\n\n` +
            `Subtasks: ${(task.subtasks || []).map(s => `\n- [ ] ${s.title}`).join('')}`;
        
        const response = await fetch(`${RATCHET_GATEWAY_URL}/api/hook/mission-control`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RATCHET_GATEWAY_TOKEN}`
            },
            body: JSON.stringify({
                event: 'task_started',
                task: task,
                message: message
            })
        });
        
        if (!response.ok) {
            console.error('Ratchet notification failed:', response.status);
        } else {
            console.log(`Notified Ratchet about task: ${task.id}`);
        }
    } catch (err) {
        console.error('Error notifying Ratchet:', err.message);
    }
}

server.listen(port, () => {
    console.log(`Mission Control running on port ${port}`);
    console.log(`Gateway: ${RATCHET_GATEWAY_URL}`);
});
