const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/guest', ctrl.createGuest);
router.post('/google', ctrl.googleAuth);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password',  ctrl.resetPassword);
router.get('/me', protect, ctrl.me);
router.patch('/profile', protect, ctrl.updateProfile);
router.get('/leaderboard', ctrl.leaderboard);

module.exports = router;
