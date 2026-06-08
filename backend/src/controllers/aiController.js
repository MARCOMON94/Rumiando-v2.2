const aiService = require('../services/aiService');


async function getHealth(req, res, next) {
  try {
    const health = await aiService.getHealth(req.headers.authorization);
    res.json(health);
  } catch (err) {
    next(err);
  }
}


async function chat(req, res, next) {
  try {
    const response = await aiService.chat(req.body, req.headers.authorization);
    res.json(response);
  } catch (err) {
    next(err);
  }
}


async function getHistory(req, res, next) {
  try {
    const history = await aiService.getHistory(
      req.params.conversationId,
      req.headers.authorization
    );

    res.json(history);
  } catch (err) {
    next(err);
  }
}


async function getUnresolvedQuestions(req, res, next) {
  try {
    const response = await aiService.getUnresolvedQuestions(req.headers.authorization);
    res.json(response);
  } catch (err) {
    next(err);
  }
}


module.exports = {
  getHealth,
  chat,
  getHistory,
  getUnresolvedQuestions
};

