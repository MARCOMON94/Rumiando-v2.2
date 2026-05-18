const express = require('express');

const catalogController = require('../controllers/catalogController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', authMiddleware, catalogController.getCatalogs);

module.exports = router;