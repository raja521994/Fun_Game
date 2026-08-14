require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const { initSchema } = require('./database/db');
const authService = require('./services/authService');
const routes = require('./routes');
const { registerSocketHandlers } = require('./socket/handlers');

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const isProd = process.env.NODE_ENV === 'production';

// Init DB
initSchema();
authService.ensureRootAdmin().catch((e) => console.error('Seed admin failed:', e.message));

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: isProd ? true : [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Make io available to routes if needed
app.set('io', io);

app.use(helmet({
  contentSecurityPolicy: isProd
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://api.qrserver.com'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
        },
      }
    : false,
  crossOriginEmbedderPolicy: false,
}));

app.use(
  cors({
    origin: isProd ? true : [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// API routes
app.use('/api', routes);

// Production: serve Vite build
if (isProd) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

registerSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`Fun Game server running on port ${PORT} (${isProd ? 'production' : 'development'})`);
});

module.exports = { app, server, io };
