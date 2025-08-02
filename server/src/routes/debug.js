const express = require('express');
const router = express.Router();
const { seedUsers, getAllUsers } = require('../controllers/debugController');

// Route pour injecter les utilisateurs de test
// POST /api/debug/seed
router.post('/seed', seedUsers);

// @route   GET /api/debug/users
// @desc    Lister tous les utilisateurs
// @access  Public (pour le développement)
router.get('/users', getAllUsers);

module.exports = router;
