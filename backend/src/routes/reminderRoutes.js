const express = require('express');

const reminderController = require('../controllers/reminderController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', authMiddleware, reminderController.listReminders);
router.get('/:id', authMiddleware, reminderController.getReminderById);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  reminderController.createReminder
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  reminderController.updateReminder
);

router.put(
  '/:id/complete',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  reminderController.completeReminder
);

router.put(
  '/:id/snooze',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  reminderController.snoozeReminder
);

module.exports = router;