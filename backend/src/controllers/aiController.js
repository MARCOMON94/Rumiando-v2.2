const aiService = require('../services/aiService');


function authorizationForAi(req) {
  return req.headers.authorization || (req.authToken ? `Bearer ${req.authToken}` : undefined);
}


async function getHealth(req, res, next) {
  try {
    const health = await aiService.getHealth(authorizationForAi(req));
    res.json(health);
  } catch (err) {
    next(err);
  }
}


async function chat(req, res, next) {
  try {
    const response = await aiService.chat(req.body, authorizationForAi(req));
    res.json(response);
  } catch (err) {
    next(err);
  }
}


async function transcribe(req, res, next) {
  try {
    const response = await aiService.transcribeAudio(req.body, {
      mimeType: req.get('content-type') || 'audio/webm',
      filename: req.get('x-audio-filename') || undefined,
      language: req.get('x-audio-language') || 'es'
    });

    res.json(response);
  } catch (err) {
    next(err);
  }
}


async function getHistory(req, res, next) {
  try {
    const history = await aiService.getHistory(
      req.params.conversationId,
      authorizationForAi(req)
    );

    res.json(history);
  } catch (err) {
    next(err);
  }
}


async function getUnresolvedQuestions(req, res, next) {
  try {
    const response = await aiService.getUnresolvedQuestions(authorizationForAi(req));
    res.json(response);
  } catch (err) {
    next(err);
  }
}


async function getLearningWeeklySummary(req, res, next) {
  try {
    const response = await aiService.getLearningWeeklySummary(authorizationForAi(req));
    res.json(response);
  } catch (err) {
    next(err);
  }
}


module.exports = {
  getHealth,
  chat,
  transcribe,
  getHistory,
  getUnresolvedQuestions,
  getLearningWeeklySummary
};

