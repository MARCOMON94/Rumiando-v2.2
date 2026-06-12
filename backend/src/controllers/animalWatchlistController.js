const animalWatchlistService = require('../services/animalWatchlistService');

async function listItems(req, res, next) {
  try {
    const result = await animalWatchlistService.listItems(
      req.user.id,
      req.user.cuentaGanaderaId
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function addItem(req, res, next) {
  try {
    const item = await animalWatchlistService.addItem(
      req.user.id,
      req.user.cuentaGanaderaId,
      req.body
    );

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const result = await animalWatchlistService.markRead(
      req.user.id,
      req.user.cuentaGanaderaId,
      req.body
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function deleteItem(req, res, next) {
  try {
    const result = await animalWatchlistService.deleteItem(
      Number(req.params.id),
      req.user.id,
      req.user.cuentaGanaderaId
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function clearItems(req, res, next) {
  try {
    const result = await animalWatchlistService.clearItems(
      req.user.id,
      req.user.cuentaGanaderaId
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listItems,
  addItem,
  markRead,
  deleteItem,
  clearItems
};
