const reminderService = require('../services/reminderService');

async function listReminders(req, res, next) {
  try {
    const reminders = await reminderService.listReminders(
      req.user.cuentaGanaderaId,
      req.query
    );

    res.json({
      data: reminders,
      total: reminders.length
    });
  } catch (err) {
    next(err);
  }
}

async function getReminderById(req, res, next) {
  try {
    const reminder = await reminderService.getReminderById(
      Number(req.params.id),
      req.user.cuentaGanaderaId
    );

    res.json(reminder);
  } catch (err) {
    next(err);
  }
}

async function createReminder(req, res, next) {
  try {
    const reminder = await reminderService.createReminder(
      req.body,
      req.user.cuentaGanaderaId
    );

    res.status(201).json(reminder);
  } catch (err) {
    next(err);
  }
}

async function updateReminder(req, res, next) {
  try {
    const reminder = await reminderService.updateReminder(
      Number(req.params.id),
      req.body,
      req.user.cuentaGanaderaId
    );

    res.json(reminder);
  } catch (err) {
    next(err);
  }
}

async function completeReminder(req, res, next) {
  try {
    const reminder = await reminderService.completeReminder(
      Number(req.params.id),
      req.user.cuentaGanaderaId
    );

    res.json(reminder);
  } catch (err) {
    next(err);
  }
}

async function snoozeReminder(req, res, next) {
  try {
    const reminder = await reminderService.snoozeReminder(
      Number(req.params.id),
      req.body,
      req.user.cuentaGanaderaId
    );

    res.json(reminder);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listReminders,
  getReminderById,
  createReminder,
  updateReminder,
  completeReminder,
  snoozeReminder
};