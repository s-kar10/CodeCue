import test from 'node:test';
import assert from 'node:assert/strict';
import { createHintController } from '../background/hint-controller.js';

const safeHint = '## Hint\nLook for repeated work.\n## Why\nRepeated work costs time.\n## Next Action\nIdentify one repeated search.\n## Check Yourself\nWhat can be reused?';
const sender = { tab: { id: 3 }, frameId: 0, url: 'https://leetcode.com/problems/two-sum/' };
const context = { title: '1. Two Sum', statement: 'Given an array of integers and a target, find the indices of two entries that sum to target.', url: sender.url };
const store = () => {
  const data = {};
  return { session: { async get(key) { return { [key]: data[key] }; }, async set(value) { Object.assign(data, value); } }, data };
};
const settings = { async get() { return { apiKey: 'private-key', model: 'test-model', strictness: 'balanced' }; } };
let nextId = 0;
function setup(request = async () => safeHint, now = () => 1000) {
  const storage = store();
  const controller = createHintController({ storage, settings, request, now, createId: () => `session-${++nextId}` });
  return { controller, storage };
}

async function request(controller, sessionId, tier, extras = {}) {
  return controller.getHint(sender, { sessionId, tier, context, ...extras });
}

test('worker ignores forged completion and cooldown flags and enforces sequence', async () => {
  const { controller } = setup();
  const { sessionId } = await controller.startSession(sender);
  await assert.rejects(request(controller, sessionId, 'tier4', { completedTiers: ['tier1', 'tier2', 'tier3'], unlock: { confirmed: true, cooldownComplete: true } }), /Complete tier1/);
  await assert.rejects(controller.confirmSolution(sender, sessionId), /Complete the first three/);
  await request(controller, sessionId, 'tier1');
  await assert.rejects(request(controller, sessionId, 'tier3'), /Complete tier2/);
});

test('cooldown starts only after valid tier 3 response and survives controller recreation', async () => {
  let clock = 1000;
  const { controller, storage } = setup(async () => safeHint, () => clock);
  const { sessionId } = await controller.startSession(sender);
  for (const tier of ['tier1', 'tier2', 'tier3']) await request(controller, sessionId, tier);
  await assert.rejects(request(controller, sessionId, 'tier4'), /Acknowledge/);
  await controller.confirmSolution(sender, sessionId);
  await assert.rejects(request(controller, sessionId, 'tier4'), /cooldown/);
  clock = 13000;
  const restarted = createHintController({ storage, settings, request: async () => 'Full solution\n```js\nreturn 1;\n```\nTime O(n), space O(n).', now: () => clock });
  const result = await request(restarted, sessionId, 'tier4');
  assert.match(result.content, /Full solution/);
  assert.deepEqual(result.completedTiers, ['tier1', 'tier2', 'tier3', 'tier4']);
});

test('unsafe response does not advance progress and changed problem invalidates old session', async () => {
  let response = '```js\nreturn 1;\n```';
  const { controller } = setup(async () => response);
  const { sessionId } = await controller.startSession(sender);
  await assert.rejects(request(controller, sessionId, 'tier1'), /may reveal too much/);
  await assert.rejects(request(controller, sessionId, 'tier2'), /Complete tier1/);
  response = safeHint;
  await request(controller, sessionId, 'tier1');
  await controller.startSession({ ...sender, url: 'https://leetcode.com/problems/valid-parentheses/' });
  await assert.rejects(request(controller, sessionId, 'tier1'), /session changed/);
});

test('in-flight response from a previous problem cannot advance the new session', async () => {
  const finishes = [];
  const { controller } = setup(() => new Promise((resolve) => { finishes.push(resolve); }));
  const { sessionId } = await controller.startSession(sender);
  const pending = request(controller, sessionId, 'tier1');
  await new Promise((resolve) => setTimeout(resolve, 0));
  const nextSender = { ...sender, url: 'https://leetcode.com/problems/valid-parentheses/' };
  const next = await controller.startSession(nextSender);
  const nextPending = controller.getHint(nextSender, { sessionId: next.sessionId, tier: 'tier1', context: { ...context, title: 'Valid Parentheses', url: nextSender.url } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(finishes.length, 2);
  finishes[0](safeHint);
  await assert.rejects(pending, /Problem changed/);
  finishes[1](safeHint);
  assert.deepEqual((await nextPending).completedTiers, ['tier1']);
});

test('sender URL and extracted context must describe the same problem', async () => {
  const { controller } = setup();
  const { sessionId } = await controller.startSession(sender);
  await assert.rejects(controller.getHint(sender, { sessionId, tier: 'tier1', context: { ...context, url: 'https://leetcode.com/problems/other/' } }), /Problem changed/);
  await assert.rejects(controller.startSession({ ...sender, url: 'https://example.com/problems/two-sum/' }), /Open a LeetCode/);
});
