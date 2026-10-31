import test from 'node:test';
import assert from 'node:assert/strict';
import { requestHint } from '../background/gemini-client.js';

const input = { model: 'gemini-3.8-flash', apiKey: 'sensitive-test-key', prompt: 'Give a hint' };

test('Gemini key is sent in header, not URL or body', async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.doesNotMatch(url, /sensitive-test-key|\?key=/);
      assert.equal(options.headers['x-goog-api-key'], input.apiKey);
      assert.doesNotMatch(options.body, /sensitive-test-key/);
      return { ok: true, async json() { return { candidates: [{ content: { parts: [{ text: 'A hint' }] } }] }; } };
    };
    assert.equal(await requestHint(input), 'A hint');
  } finally { globalThis.fetch = oldFetch; }
});

test('provider error body is not returned to the UI', async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: false, status: 403, async text() { return 'sensitive-test-key'; } });
    await assert.rejects(requestHint(input), (error) => {
      assert.doesNotMatch(error.userMessage, /sensitive-test-key/);
      assert.match(error.userMessage, /denied access/);
      return true;
    });
  } finally { globalThis.fetch = oldFetch; }
});
