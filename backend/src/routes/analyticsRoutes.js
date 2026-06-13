const express = require('express');

const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/options', authMiddleware, analyticsController.getOptions);
router.post('/query', authMiddleware, analyticsController.query);
router.post('/export/excel', authMiddleware, analyticsController.exportExcel);
router.post('/export/email', authMiddleware, analyticsController.exportEmail);

module.exports = router;
