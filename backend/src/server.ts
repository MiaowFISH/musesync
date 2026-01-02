// backend/src/server.ts
// Main server entry point with Express and Socket.io

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

// Import routes
import musicRoutes from './routes/music';

// Import types
import type { SocketEvents } from '@shared/types/socket-events';

// Environment configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// ============================================================================
// Express Setup
// ============================================================================

const app = express();

// Middleware
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ============================================================================
// HTTP Server
// ============================================================================

const httpServer = createServer(app);

// ============================================================================
// Socket.io Setup
// ============================================================================

const io = new SocketIOServer<SocketEvents>(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
  pingInterval: 25000, // 25 seconds
  pingTimeout: 60000, // 60 seconds
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6, // 1MB max message size
});

// Connection event logging
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    console.log(`[WS] Client disconnected: ${socket.id} (${reason})`);
  });
});

// ============================================================================
// REST API Routes
// ============================================================================

// Mount music API routes
app.use('/api/music', musicRoutes);

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    services: {
      netease: 'ok', // TODO: Implement actual health check
      cache: 'ok',
    },
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

/**
 * 404 handler for undefined routes
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

/**
 * Global error handler
 */
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    },
  });
});

// ============================================================================
// Server Start
// ============================================================================

httpServer.listen(PORT, () => {
  console.log(`[SERVER] HTTP server listening on port ${PORT}`);
  console.log(`[SERVER] Socket.io ready (pingInterval: 25s, pingTimeout: 60s)`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received, closing server...');
  httpServer.close(() => {
    console.log('[SERVER] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[SERVER] SIGINT received, closing server...');
  httpServer.close(() => {
    console.log('[SERVER] Server closed');
    process.exit(0);
  });
});

// Export for testing and module usage
export { app, httpServer, io };
