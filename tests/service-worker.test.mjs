import test from 'node:test';
import assert from 'node:assert/strict';

function area(data = {}) {
  return {
    data, accessLevel: '',
    async setAccessLevel({ accessLevel }) { this.accessLevel = accessLevel; },
    async get(defaults) {
      if (typeof defaults === 'string') return { [defaults]: data[defaults] };
      return { ...defaults, ...data };
    },
    async set(value) { Object.assign(data, value); },
    async remove(key) { delete data[key]; }
  };
}

test('worker limits storage exposure and never returns the key to content scripts', async () => {
  let listener;
  const storage = { local: area({ apiKey: 'private-key' }), sync: area(), session: area() };
  globalThis.chrome = { storage, runtime: { onMessage: { addListener(fn) { listener = fn; } } } };
  try {
    await import('../background/service-worker.js');
    const send = (message, sender) => new Promise((resolve) => listener(message, sender, resolve));
    const page = { tab: { id: 1 }, frameId: 0, url: 'https://leetcode.com/problems/two-sum/' };
    const popup = {};
    assert.equal(storage.local.accessLevel, 'TRUSTED_CONTEXTS');
    assert.equal(storage.sync.accessLevel, 'TRUSTED_CONTEXTS');
    assert.equal((await send({ type: 'GET_SETTINGS' }, page)).success, false);
    const result = await send({ type: 'GET_SETTINGS' }, popup);
    assert.equal(result.data.apiKey, 'configured');
    assert.doesNotMatch(JSON.stringify(result), /private-key/);
    await send({ type: 'SAVE_REFLECTION', slug: 'two-sum', note: { tried: 'brute force' } }, page);
    const notes = await send({ type: 'GET_REFLECTION', slug: 'two-sum' }, page);
    assert.equal(notes.data.tried, 'brute force');
    assert.doesNotMatch(JSON.stringify(notes), /private-key/);
  } finally { delete globalThis.chrome; }
});
