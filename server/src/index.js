require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

// Import des routes
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const debugRoutes = require('./routes/debug');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:5173', // autorise le front Vite
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Rendre io accessible depuis les contrôleurs
app.set('io', io);

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/debug', debugRoutes);

// Configuration MongoDB selon le modèle de lingobango
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/memoryMaster';

// Connexion à MongoDB (options modernes, sans paramètres dépréciés)
mongoose.connect(MONGODB_URI)
  .then(() => console.log(`✅ Connecté à MongoDB - Base: memoryMaster`))
  .catch(err => {
    console.error('❌ Erreur de connexion à MongoDB:', err.message);
    console.log('💡 Astuce: Assure-toi que MongoDB est démarré (net start MongoDB)');
  });

// Gestion des connexions Socket.IO
const { setupSocket } = require('./services/socketService');
setupSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

module.exports = { app, server };
