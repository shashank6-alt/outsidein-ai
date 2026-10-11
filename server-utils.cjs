const SAFE_MAX = 280;

const clampText = (value, fallback) => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return fallback;
  }
  return trimmed.slice(0, SAFE_MAX);
};

const asStringArray = (value, fallback) => {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const next = value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.slice(0, SAFE_MAX));
  return next.length ? next : fallback;
};

const extractJsonObject = (raw) => {
  if (typeof raw !== 'string') {
    return null;
  }
  const start = raw.indexOf('{');
  if (start === -1) {
    return null;
  }
  let depth = 0;
  for (let i = start; i < raw.length; i += 1) {
    if (raw[i] === '{') depth += 1;
    if (raw[i] === '}') depth -= 1;
    if (depth === 0) {
      return raw.slice(start, i + 1);
    }
  }
  return null;
};

const defaultSafetyTips = [
  'Stay aware of traffic and surroundings.',
  'Bring water and stop if you feel unwell.',
  'Respect local rules, nature, and private property.'
];

const buildPresetMission = (input, reason) => ({
  title: `${input.activityType} in your ${input.environment}`,
  duration: `${input.timeMinutes} minutes`,
  instructions: [
    `Start a ${input.timeMinutes}-minute ${input.activityType.toLowerCase()} route in your ${input.environment.toLowerCase()}.`,
    `Match a ${input.energyLevel.toLowerCase()} pace and notice 3 details you've never paid attention to.`,
    'Take one 2-minute pause to breathe deeply and observe sounds around you.'
  ],
  completionCondition: 'You complete the full time window and identify at least 3 observations.',
  reflectionQuestion: 'What felt different once you paid attention to your surroundings?',
  safetyTips: defaultSafetyTips,
  presetReason: reason
});

const normalizeMission = (candidate, input) => {
  if (!candidate || typeof candidate !== 'object') {
    return buildPresetMission(input, 'Invalid mission structure from model output.');
  }

  return {
    title: clampText(candidate.title, `${input.activityType} quest`),
    duration: clampText(candidate.duration, `${input.timeMinutes} minutes`),
    instructions: asStringArray(candidate.instructions, [
      `Spend ${input.timeMinutes} minutes doing a ${input.activityType.toLowerCase()} in your ${input.environment.toLowerCase()}.`
    ]),
    completionCondition: clampText(
      candidate.completionCondition,
      'Complete the planned activity duration and finish safely.'
    ),
    reflectionQuestion: clampText(candidate.reflectionQuestion, ''),
    safetyTips: asStringArray(candidate.safetyTips, defaultSafetyTips)
  };
};

const parseMissionPayload = (rawText, input) => {
  if (!rawText || typeof rawText !== 'string') {
    return buildPresetMission(input, 'Model response was empty.');
  }

  const jsonCandidate = extractJsonObject(rawText);
  if (!jsonCandidate) {
    return buildPresetMission(input, 'Model response was not valid JSON.');
  }

  try {
    const parsed = JSON.parse(jsonCandidate);
    return normalizeMission(parsed, input);
  } catch {
    return buildPresetMission(input, 'Model JSON parsing failed.');
  }
};

const validateRequestBody = (body) => {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Request body must be a JSON object.' };
  }

  const environment = clampText(body.environment, '');
  const energyLevel = clampText(body.energyLevel, '');
  const activityType = clampText(body.activityType, '');
  const timeMinutes = Number(body.timeMinutes);

  if (!environment || !energyLevel || !activityType || Number.isNaN(timeMinutes)) {
    return { ok: false, message: 'environment, energyLevel, activityType, and timeMinutes are required.' };
  }

  if (timeMinutes < 10 || timeMinutes > 240) {
    return { ok: false, message: 'timeMinutes must be between 10 and 240.' };
  }

  return {
    ok: true,
    value: {
      environment,
      energyLevel,
      activityType,
      timeMinutes: Math.round(timeMinutes)
    }
  };
};

module.exports = {
  buildPresetMission,
  parseMissionPayload,
  validateRequestBody,
  defaultSafetyTips
};
