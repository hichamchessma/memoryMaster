require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true },
});

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tables', require('./routes/tables'));
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// Socket
require('./services/socketService')(io);

// DB + Start
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connecté');
    server.listen(process.env.PORT || 5001, () =>
      console.log(`🚀 Serveur MemoryMaster Pro sur le port ${process.env.PORT || 5001}`)
    );
  })
  .catch(err => {
    console.error('❌ MongoDB erreur:', err.message);
    process.exit(1);
  });
