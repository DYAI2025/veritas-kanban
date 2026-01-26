import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { taskRoutes } from './routes/tasks.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/tasks', taskRoutes);

// Create HTTP server
const server = createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Export for use in other modules
export { wss };

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║           Veritas Kanban Server               ║
╠═══════════════════════════════════════════════╣
║  API:        http://localhost:${PORT}            ║
║  WebSocket:  ws://localhost:${PORT}/ws           ║
║  Health:     http://localhost:${PORT}/health     ║
╚═══════════════════════════════════════════════╝
  `);
});
