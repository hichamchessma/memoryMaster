const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createGame,
  joinGame,
  startGame,
  getGame,
  playTurn,
  autofillGame
} = require('../controllers/gameController');

// Créer une nouvelle partie
router.post('/', protect, createGame);

// Rejoindre une partie existante
router.post('/:code/join', protect, joinGame);

// Remplir automatiquement avec des invités
router.post('/:code/autofill', protect, autofillGame);

// Démarrer une partie (seul l'hôte peut le faire)
router.post('/:code/start', protect, startGame);

// Obtenir les informations d'une partie
router.get('/:code', protect, getGame);

// Jouer un tour
router.post('/:code/play', protect, playTurn);

module.exports = router;
