const aiService = require('../services/aiService');

describe('AI audio transcription service', () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_TRANSCRIPTION_MODEL;

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
  });

  test('requiere OPENAI_API_KEY para transcribir', async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(aiService.transcribeAudio(Buffer.from('audio')))
      .rejects
      .toMatchObject({
        statusCode: 503
      });
  });

  test('envia el audio al endpoint de transcripciones de OpenAI', async () => {
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
