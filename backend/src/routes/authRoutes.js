const express = require('express');

const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/google', authController.loginWithGoogle);
router.post('/logout', authController.logout);
router.get('/me', authMiddleware, authController.getProfile);

router.post('/login', authController.disabledPasswordAuth);
router.post('/register', authController.disabledPasswordAuth);

module.exports = router;