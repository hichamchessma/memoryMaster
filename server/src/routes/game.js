const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createGame,
  joinGame,
  startGame,
  getGame,
  playTurn,
  autofillGame,
  listGames,
  updateGameName,
  deleteGame,
  createTable,
  listTables,
  joinTable,
  leaveTable,
  startTableGame
} = require('../controllers/gameController');

// Lister les parties (salons)
router.get('/', protect, listGames);

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

// Mettre à jour le nom d'un salon
router.patch('/:code/name', protect, updateGameName);

// Supprimer un salon
router.delete('/:code', protect, deleteGame);

// Jouer un tour
router.post('/:code/play', protect, playTurn);

// Nouveaux endpoints pour les tables (dans un salon global)
router.post('/tables', protect, createTable);
router.get('/tables', protect, listTables);
router.post('/tables/:tableId/join', protect, joinTable);
router.post('/tables/:tableId/leave', protect, leaveTable);
router.post('/tables/:tableId/start', protect, startTableGame);

module.exports = router;
