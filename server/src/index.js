require('dotenv').config();
const express   = require('express');
const http      = require('http');
const path      = require('path');
const { Server } = require('socket.io');
const cors      = require('cors');
const mongoose  = require('mongoose');
const bcrypt    = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true },
});

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Assets statiques (cartes) — servis en dev ET prod
app.use('/assets', express.static(path.join(__dirname, '../../client/public/assets')));
app.use(express.static(path.join(__dirname, '../../client/public')));

// Routes API
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/admin',  require('./routes/admin'));
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// En production : servir le build React
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(path.join(clientBuild, 'index.html'));
    }
  });
}

// Socket
require('./services/socketService')(io);

// Seed du compte admin au démarrage
async function seedAdmin() {
  const User = require('./models/User');
  const existing = await User.findOne({ email: 'admin@mm.local' });
  if (!existing) {
    const hashed = await bcrypt.hash('admin', 12);
    await User.collection.insertOne({
      firstName: 'Admin', lastName: 'Master',
      email: 'admin@mm.local', password: hashed,
      isAdmin: true, isGuest: false,
      elo: 9999, gamesPlayed: 0, gamesWon: 0, totalPoints: 0,
      lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date(),
    });
    console.log('👑 Compte admin créé  →  login: admin  |  pwd: admin');
  }
}

// DB + Start
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connecté');
    await seedAdmin();
    server.listen(process.env.PORT || 5000, () =>
      console.log(`🚀 Serveur MemoryMaster Pro sur le port ${process.env.PORT || 5000}`)
    );
  })
  .catch(err => {
    console.error('❌ MongoDB erreur:', err.message);
    process.exit(1);
  });
