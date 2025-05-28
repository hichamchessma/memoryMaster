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

module.exports = router;
