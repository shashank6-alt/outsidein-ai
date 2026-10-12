const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMissionPayload, validateRequestBody } = require('../server-utils.cjs');

test('validateRequestBody accepts expected fields', () => {
  const result = validateRequestBody({
    environment: 'Park',
    timeMinutes: 35,
    energyLevel: 'Medium',
    activityType: 'Mindful walk'
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.timeMinutes, 35);
});

test('validateRequestBody rejects bad time range', () => {
  const result = validateRequestBody({
    environment: 'Park',
    timeMinutes: 5,
    energyLevel: 'Medium',
    activityType: 'Mindful walk'
  });
  assert.equal(result.ok, false);
});

test('validateRequestBody rejects non-finite time values', () => {
  const result = validateRequestBody({
    environment: 'Park',
    timeMinutes: Infinity,
    energyLevel: 'Medium',
    activityType: 'Mindful walk'
  });
  assert.equal(result.ok, false);
});

test('parseMissionPayload extracts JSON object from model text', () => {
  const raw = `Mission:\n{\n  "title":"Green Loop",\n  "duration":"30 minutes",\n  "instructions":["Walk to a tree","Pause for two breaths"],\n  "completionCondition":"Finish the loop",\n  "reflectionQuestion":"What surprised you?",\n  "safetyTips":["Stay visible"]\n}`;

  const parsed = parseMissionPayload(raw, {
    environment: 'Park',
    timeMinutes: 30,
    energyLevel: 'Medium',
    activityType: 'Mindful walk'
  });

  assert.equal(parsed.title, 'Green Loop');
  assert.equal(parsed.instructions.length, 2);
});

test('parseMissionPayload handles braces inside JSON strings', () => {
  const parsed = parseMissionPayload(
    '{"title":"Look for {shapes}","duration":"30 minutes","instructions":["Notice \\"small\\" details"]}',
    {
      environment: 'Park',
      timeMinutes: 30,
      energyLevel: 'Medium',
      activityType: 'Mindful walk'
    }
  );

  assert.equal(parsed.title, 'Look for {shapes}');
  assert.deepEqual(parsed.instructions, ['Notice "small" details']);
});

test('parseMissionPayload returns preset when invalid', () => {
  const parsed = parseMissionPayload('not-json', {
    environment: 'Park',
    timeMinutes: 30,
    energyLevel: 'Medium',
    activityType: 'Mindful walk'
  });

  assert.ok(parsed.presetReason);
});
