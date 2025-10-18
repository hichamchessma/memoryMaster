const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createTable,
  listTables,
  getTable,
  joinTable,
  leaveTable,
  deleteTable,
  startTableGame,
  createGame,
  joinGame,
  startGame,
  getGame,
  playTurn,
  autofillGame
} = require('../controllers/gameController');

// Routes pour les tables (nouveau système)
router.post('/tables', protect, createTable);
router.get('/tables', protect, listTables);
router.get('/tables/:tableId', protect, getTable);
router.post('/tables/:tableId/join', protect, joinTable);
router.post('/tables/:tableId/leave', protect, leaveTable);
router.delete('/tables/:tableId', protect, deleteTable);
router.post('/tables/:tableId/start', protect, startTableGame);

// Anciennes routes pour compatibilité (avec codes)
router.post('/', protect, createGame);
router.post('/:code/join', protect, joinGame);
router.post('/:code/autofill', protect, autofillGame);
router.post('/:code/start', protect, startGame);
router.get('/:code', protect, getGame);
router.post('/:code/play', protect, playTurn);

module.exports = router;
