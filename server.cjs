const http = require('http');
const { URL } = require('url');
const dotenv = require('dotenv');
const {
  parseMissionPayload,
  validateRequestBody,
  buildPresetMission
} = require('./server-utils.cjs');

dotenv.config();

const port = Number(process.env.PORT || 3001);
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const configuredOllamaModel = (process.env.OLLAMA_MODEL || 'gemma3:1b').trim();
const configuredOllamaTimeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);
const ollamaTimeoutMs = Number.isFinite(configuredOllamaTimeoutMs) && configuredOllamaTimeoutMs > 0
  ? configuredOllamaTimeoutMs
  : 120000;

const enableHfFallback = (process.env.ENABLE_HF_FALLBACK || 'false').toLowerCase() === 'true';
const hfApiKey = process.env.HF_API_KEY || '';
const hfModel = process.env.HF_MODEL || '';
const configuredHfTimeoutMs = Number(process.env.HF_TIMEOUT_MS || 20000);
const hfTimeoutMs = Number.isFinite(configuredHfTimeoutMs) && configuredHfTimeoutMs > 0
  ? configuredHfTimeoutMs
  : 20000;

const withTimeout = async (requestFn, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await requestFn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

const readJsonBody = async (req) => {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 1_000_000) {
      throw new Error('Payload too large');
    }
  }
  try {
    return JSON.parse(data || '{}');
  } catch {
    throw new Error('Invalid JSON body');
  }
};

const resolveOllamaModel = async () => {
  const response = await withTimeout(
    (signal) => fetch(`${ollamaBaseUrl}/api/tags`, { signal }),
    Math.min(ollamaTimeoutMs, 6000)
  );

  if (!response.ok) {
    throw new Error(`Could not read Ollama models (${response.status}).`);
  }

  const data = await response.json();
  const models = Array.isArray(data.models) ? data.models.map((m) => m.name).filter(Boolean) : [];

  if (configuredOllamaModel && models.includes(configuredOllamaModel)) {
    return configuredOllamaModel;
  }

  if (configuredOllamaModel) {
    const availableModels = models.length ? models.join(', ') : 'none';
    throw new Error(
      `Configured Ollama model "${configuredOllamaModel}" is not installed. ` +
      `Available models: ${availableModels}.`
    );
  }

  return models[0] || null;
};

const generateWithOllama = async (input) => {
  const model = await resolveOllamaModel();
  if (!model) {
    throw new Error('No Ollama model found. Set OLLAMA_MODEL or install a local model.');
  }

  const prompt = [
    'You are OutsideIn AI, generating concise outdoor missions.',
    'Return only valid JSON with keys: title, duration, instructions (array), completionCondition, reflectionQuestion, safetyTips (array).',
    `Environment: ${input.environment}`,
    `Available minutes: ${input.timeMinutes}`,
    `Energy level: ${input.energyLevel}`,
    `Activity type: ${input.activityType}`
  ].join('\n');

  const response = await withTimeout(
    (signal) => fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        format: 'json',
        stream: false,
        options: { temperature: 0.5 }
      }),
      signal
    }),
    ollamaTimeoutMs
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${errorText.slice(0, 180)}`);
  }

  const data = await response.json();
  const mission = parseMissionPayload(data.response, input);
  return { mission, model };
};

const generateWithHuggingFace = async (input) => {
  if (!enableHfFallback) {
    return null;
  }
  if (!hfApiKey || !hfModel) {
    throw new Error('Hugging Face fallback enabled but HF_API_KEY or HF_MODEL is missing.');
  }

  const prompt = `Create an outdoor mission as JSON with title, duration, instructions array, completionCondition, reflectionQuestion, safetyTips array. Environment: ${input.environment}. Time: ${input.timeMinutes} minutes. Energy: ${input.energyLevel}. Activity: ${input.activityType}.`;

  const response = await withTimeout(
    (signal) => fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(hfModel)}`, {
      method: 'POST',
      headers: {
        Authorization: ['Bearer', hfApiKey].join(' '),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: prompt }),
      signal
    }),
    hfTimeoutMs
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Hugging Face fallback failed (${response.status}): ${err.slice(0, 180)}`);
  }

  const payload = await response.json();
  const text = Array.isArray(payload) && payload[0]?.generated_text
    ? payload[0].generated_text
    : JSON.stringify(payload);

  return {
    mission: parseMissionPayload(text, input),
    model: hfModel
  };
};

const writeJson = (res, code, payload) => {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    writeJson(res, 204, {});
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    writeJson(res, 200, {
      ok: true,
      provider: 'ollama',
      configuredModel: configuredOllamaModel || null,
      hfFallbackEnabled: enableHfFallback
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/mission') {
    try {
      const body = await readJsonBody(req);
      const validation = validateRequestBody(body);
      if (!validation.ok) {
        writeJson(res, 400, { error: validation.message });
        return;
      }

      const input = validation.value;

      try {
        const generated = await generateWithOllama(input);
        writeJson(res, 200, {
          source: 'ollama',
          model: generated.model,
          mission: generated.mission
        });
        return;
      } catch (ollamaError) {
        try {
          const fallback = await generateWithHuggingFace(input);
          if (fallback) {
            writeJson(res, 200, {
              source: 'huggingface',
              model: fallback.model,
              mission: fallback.mission,
              note: `Ollama unavailable (${ollamaError.message}). Used explicit opt-in Hugging Face fallback.`
            });
            return;
          }
        } catch (hfError) {
          writeJson(res, 200, {
            source: 'preset',
            mission: buildPresetMission(input, 'AI providers unavailable.'),
            note: `Ollama unavailable (${ollamaError.message}). HF fallback also failed (${hfError.message}).`
          });
          return;
        }

        writeJson(res, 200, {
          source: 'preset',
          mission: buildPresetMission(input, 'Ollama unavailable.'),
          note: `Ollama unavailable (${ollamaError.message}). Returned preset mission.`
        });
      }
    } catch (error) {
      writeJson(res, 400, { error: error.message || 'Bad request' });
    }
    return;
  }

  writeJson(res, 404, { error: 'Not found' });
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `OutsideIn AI server running on http://localhost:${port} ` +
    `(Ollama: ${ollamaBaseUrl}, model: ${configuredOllamaModel}, timeout: ${ollamaTimeoutMs}ms)`
  );
});
