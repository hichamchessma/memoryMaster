const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  guestLogin,
  googleLogin,
  getProfile,
  updateProfile
} = require('../controllers/authController');

// Routes d'authentification
router.post('/guest', guestLogin);
router.post('/google', googleLogin);

// Routes protégées nécessitant une authentification
router.route('/profile')
  .get(protect, getProfile)
  .put(protect, updateProfile);

// GET /api/auth/me — retourne le profil de l'utilisateur connecté
router.get('/me', protect, (req, res) => {
  res.json(req.user);
});

module.exports = router;
