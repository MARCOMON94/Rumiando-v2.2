const AppError = require('../utils/AppError');

const DEFAULT_AI_SERVICE_URL = 'http://localhost:8000';


function getAiServiceUrl() {
  return (process.env.AI_SERVICE_URL || DEFAULT_AI_SERVICE_URL).replace(/\/+$/, '');
}


async function requestAi(path, options = {}) {
  if (typeof fetch !== 'function') {
    throw new AppError('Fetch no esta disponible en esta version de Node', 500);
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.AI_SERVICE_TIMEOUT_MS || 20000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    Accept: 'application/json'
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.authorization) {
    headers.Authorization = options.authorization;
  }

  try {
    const response = await fetch(`${getAiServiceUrl()}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = data?.detail || data?.error || data?.message || 'Error del servicio IA';
      throw new AppError(message, response.status);
    }

    return data;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    if (err.name === 'AbortError') {
      throw new AppError('El servicio IA no respondio a tiempo', 504);
    }

    throw new AppError(`No se pudo conectar con el servicio IA: ${err.message}`, 502);
  } finally {
    clearTimeout(timeout);
  }
}


async function getHealth(authorization) {
  return requestAi('/api/health', { authorization });
}


async function chat(body, authorization) {
  return requestAi('/api/chat', {
    method: 'POST',
    body,
    authorization
  });
}


async function getHistory(conversationId, authorization) {
  return requestAi(`/api/chat/history/${encodeURIComponent(conversationId)}`, {
    authorization
  });
}


async function getUnresolvedQuestions(authorization) {
  const learningToken = process.env.LEARNING_QUEUE_TOKEN;

  return requestAi('/api/learning/unresolved', {
    authorization: learningToken ? `Bearer ${learningToken}` : authorization
  });
}


async function getLearningWeeklySummary(authorization) {
  const learningToken = process.env.LEARNING_QUEUE_TOKEN;

  return requestAi('/api/learning/weekly-summary', {
    authorization: learningToken ? `Bearer ${learningToken}` : authorization
  });
}


async function normalizeSanitaryTerm(body, authorization) {
  return requestAi('/api/catalogs/sanitary-normalize', {
    method: 'POST',
    body,
    authorization
  });
}


module.exports = {
  getHealth,
  chat,
  getHistory,
  getUnresolvedQuestions,
  getLearningWeeklySummary,
  normalizeSanitaryTerm
};

