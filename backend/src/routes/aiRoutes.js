const express = require('express');

const aiController = require('../controllers/aiController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/health', authMiddleware, aiController.getHealth);
router.post('/chat', authMiddleware, aiController.chat);
router.get('/chat/history/:conversationId', authMiddleware, aiController.getHistory);

module.exports = router;

