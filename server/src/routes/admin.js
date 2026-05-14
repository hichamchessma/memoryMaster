const router = require('express').Router();
const ctrl   = require('../controllers/adminController');
const { protect, requireAdmin } = require('../middleware/auth');

router.use(protect, requireAdmin);

router.get   ('/stats',            ctrl.getStats);
router.get   ('/users',            ctrl.getUsers);
router.delete('/users/:id',        ctrl.deleteUser);
router.patch ('/users/:id/elo',    ctrl.updateUserElo);
router.get   ('/tables',           ctrl.getTables);
router.delete('/tables/:id',       ctrl.deleteTable);
router.post  ('/cleanup-guests',   ctrl.cleanupGuests);
router.post  ('/broadcast',        ctrl.broadcast);

module.exports = router;
