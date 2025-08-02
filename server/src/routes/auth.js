const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  register,
  login,
  getProfile,
  updateProfile
} = require('../controllers/authController');

// Routes d'authentification
router.post('/register', register);
router.post('/login', login);

// Routes protégées nécessitant une authentification
router.route('/profile')
  .get(protect, getProfile)
  .put(protect, updateProfile);

// GET /api/auth/me — retourne le profil de l'utilisateur connecté
router.get('/me', protect, (req, res) => {
  res.json(req.user);
});

module.exports = router;
