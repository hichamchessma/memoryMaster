const router = require('express').Router();
const ctrl = require('../controllers/tableController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.post('/vs-bot', ctrl.createVsBot);
router.post('/', ctrl.createTable);
router.get('/', ctrl.getTables);
router.get('/:id', ctrl.getTable);
router.delete('/:id', ctrl.deleteTable);

module.exports = router;
