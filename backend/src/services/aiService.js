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

function audioFilenameForMimeType(mimeType = '') {
  const clean = String(mimeType || '').toLowerCase();
  if (clean.includes('mp4') || clean.includes('m4a')) return 'rumiando-voice.m4a';
  if (clean.includes('mpeg') || clean.includes('mp3')) return 'rumiando-voice.mp3';
  if (clean.includes('wav')) return 'rumiando-voice.wav';
  if (clean.includes('ogg')) return 'rumiando-voice.ogg';
  return 'rumiando-voice.webm';
}


async function transcribeAudio(audioBuffer, options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new AppError('La transcripcion por voz no esta configurada en este entorno', 503);
  }

  if (!audioBuffer?.length) {
    throw new AppError('No se recibio audio para transcribir', 400);
  }

  if (typeof fetch !== 'function' || typeof FormData !== 'function' || typeof Blob !== 'function') {
    throw new AppError('La transcripcion requiere una version de Node con fetch, FormData y Blob', 500);
  }

  const mimeType = options.mimeType || 'audio/webm';
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });

  formData.append('file', blob, options.filename || audioFilenameForMimeType(mimeType));
  formData.append('model', process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1');
  formData.append('language', options.language || 'es');
  formData.append('response_format', 'json');

  const controller = new AbortController();
  const timeoutMs = Number(process.env.OPENAI_TRANSCRIPTION_TIMEOUT_MS || 15000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData,
      signal: controller.signal
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = data?.error?.message || data?.message || 'No se pudo transcribir el audio';
      throw new AppError(message, response.status);
    }

    const text = String(data?.text || '').trim();
    if (!text) {
      throw new AppError('No se entendio ningun texto en el audio', 422);
    }

    return {
      text,
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1'
    };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    if (err.name === 'AbortError') {
      throw new AppError('La transcripcion de voz no respondio a tiempo', 504);
    }

    throw new AppError(`No se pudo transcribir el audio: ${err.message}`, 502);
  } finally {
    clearTimeout(timeout);
  }
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
  transcribeAudio,
  getHistory,
  getUnresolvedQuestions,
  getLearningWeeklySummary,
  normalizeSanitaryTerm
};

