import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettingsStore } from '../background/settings.js';

function area(data = {}) {
  return {
    data,
    async get(defaults) {
      if (typeof defaults === 'string') return { [defaults]: data[defaults] };
      return { ...defaults, ...data };
    },
    async set(value) { Object.assign(data, value); },
    async remove(key) { delete data[key]; }
  };
}

test('legacy sync key migrates to local storage and is removed from sync', async () => {
  const storage = { local: area(), sync: area({ apiKey: 'old-key' }) };
  const settings = createSettingsStore(storage);
  assert.equal((await settings.get()).apiKey, 'old-key');
  assert.equal(storage.local.data.apiKey, 'old-key');
  assert.equal(storage.sync.data.apiKey, undefined);
  await settings.save({ apiKey: '' });
  assert.equal((await settings.get()).apiKey, '');
});

test('invalid model and strictness are rejected without changing key', async () => {
  const storage = { local: area({ apiKey: 'secret' }), sync: area() };
  const settings = createSettingsStore(storage);
  await assert.rejects(settings.save({ model: 'bad/model' }), /Invalid model/);
  await assert.rejects(settings.save({ strictness: 'ignore rules' }), /Invalid hint strictness/);
  assert.equal((await settings.get()).apiKey, 'secret');
});
