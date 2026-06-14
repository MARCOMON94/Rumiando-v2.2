const express = require('express');

const aiController = require('../controllers/aiController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

const audioBody = express.raw({
  type: [
    'audio/*',
    'video/webm',
    'application/octet-stream'
  ],
  limit: process.env.AI_TRANSCRIPTION_MAX_BYTES || '20mb'
});

router.get('/health', authMiddleware, aiController.getHealth);
router.post('/chat', authMiddleware, aiController.chat);
router.post('/transcribe', authMiddleware, audioBody, aiController.transcribe);
router.get('/chat/history/:conversationId', authMiddleware, aiController.getHistory);
router.get('/learning/unresolved', authMiddleware, aiController.getUnresolvedQuestions);
router.get('/learning/weekly-summary', authMiddleware, aiController.getLearningWeeklySummary);

module.exports = router;

