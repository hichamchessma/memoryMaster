const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createGame,
  joinGame,
  startGame,
  getGame,
  playTurn
} = require('../controllers/gameController');

// Créer une nouvelle partie
router.post('/', protect, createGame);

// Rejoindre une partie existante
router.post('/:code/join', protect, joinGame);

// Démarrer une partie (seul l'hôte peut le faire)
router.post('/:code/start', protect, startGame);

// Obtenir les informations d'une partie
router.get('/:code', protect, getGame);

// Jouer un tour
router.post('/:code/play', protect, playTurn);

module.exports = router;
