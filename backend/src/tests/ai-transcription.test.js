const aiService = require('../services/aiService');

describe('AI audio transcription service', () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_TRANSCRIPTION_MODEL;
  const originalProvider = process.env.AI_TRANSCRIPTION_PROVIDER;
  const originalAiServiceUrl = process.env.AI_SERVICE_URL;

  afterEach(() => {
    global.fetch = originalFetch;

    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }

    if (originalModel === undefined) {
      delete process.env.OPENAI_TRANSCRIPTION_MODEL;
    } else {
      process.env.OPENAI_TRANSCRIPTION_MODEL = originalModel;
    }

    if (originalProvider === undefined) {
      delete process.env.AI_TRANSCRIPTION_PROVIDER;
    } else {
      process.env.AI_TRANSCRIPTION_PROVIDER = originalProvider;
    }

    if (originalAiServiceUrl === undefined) {
      delete process.env.AI_SERVICE_URL;
    } else {
      process.env.AI_SERVICE_URL = originalAiServiceUrl;
    }
  });

  test('usa Whisper local del ai-service por defecto', async () => {
    delete process.env.AI_TRANSCRIPTION_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    process.env.AI_SERVICE_URL = 'http://ai-service.test';

    global.fetch = jest.fn(async () => ({
      ok: true,
      headers: {
        get: () => 'application/json'
      },
      json: async () => ({
        text: 'he inseminado una oveja',
        provider: 'local-whisper',
        model: 'base',
        language: 'es'
      })
    }));

    const response = await aiService.transcribeAudio(Buffer.from('audio'), {
      mimeType: 'audio/webm',
      filename: 'test.webm',
      language: 'es'
    });

    expect(response).toEqual({
      text: 'he inseminado una oveja',
      provider: 'local-whisper',
      model: 'base',
      language: 'es'
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://ai-service.test/api/transcribe',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'audio/webm',
          'x-audio-language': 'es'
        })
      })
    );
  });

  test('OpenAI solo se usa si el proveedor esta configurado explicitamente', async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.AI_TRANSCRIPTION_PROVIDER = 'openai';

    await expect(aiService.transcribeAudio(Buffer.from('audio')))
      .rejects
      .toMatchObject({
        statusCode: 503
      });
  });

  test('envia el audio al endpoint de transcripciones de OpenAI', async () => {
    process.env.AI_TRANSCRIPTION_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_TRANSCRIPTION_MODEL = 'whisper-1';

    global.fetch = jest.fn(async () => ({
      ok: true,
      headers: {
        get: () => 'application/json'
      },
      json: async () => ({
        text: 'he inseminado una oveja'
      })
    }));

    const response = await aiService.transcribeAudio(Buffer.from('audio'), {
      mimeType: 'audio/webm',
      filename: 'test.webm',
      language: 'es'
    });

    expect(response).toEqual({
      text: 'he inseminado una oveja',
      provider: 'openai',
      model: 'whisper-1'
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/transcriptions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-key'
        }
      })
    );
  });
});
