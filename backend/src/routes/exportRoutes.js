const express = require('express');

const exportController = require('../controllers/exportController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/animals', authMiddleware, exportController.exportAnimals);
router.get('/health-cases', authMiddleware, exportController.exportHealthCases);
router.get('/movements', authMiddleware, exportController.exportMovements);
router.get('/reminders', authMiddleware, exportController.exportReminders);

module.exports = router;