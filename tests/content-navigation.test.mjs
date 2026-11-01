import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const scripts = ['context-extractor.js', 'markdown-renderer.js', 'content.js'].map((name) => readFileSync(new URL(`../content/${name}`, import.meta.url), 'utf8'));
const problem = (title) => `<div data-track-load="description_content"><h1>${title}</h1><p>Given an array of integers, find two numbers whose sum is the target value.</p></div>`;

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('SPA navigation resets progress and discards a late hint response', async () => {
  const dom = new JSDOM(`<!doctype html><body>${problem('Two Sum')}</body>`, { url: 'https://leetcode.com/problems/two-sum/', runScripts: 'outside-only' });
  const { window } = dom;
  const intervals = [];
  window.setInterval = (fn) => { intervals.push(fn); return intervals.length; };
  let finishHint;
  let sessionCount = 0;
  const chrome = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        if (message.type === 'START_SESSION') callback({ success: true, data: { sessionId: `session-${++sessionCount}` } });
        if (message.type === 'GET_HINT') finishHint = callback;
        if (message.type === 'GET_REFLECTION') callback({ success: true, data: { tried: '', stuck: '' } });
        if (message.type === 'SAVE_REFLECTION') callback({ success: true, data: null });
      }
    },
    storage: { local: {
      get(_key, callback) { callback({}); },
      set() {}
    } }
  };
  window.chrome = chrome;
  for (const script of scripts) window.eval(script);
  await tick();
  const first = window.document.querySelector('[data-tier="tier1"]');
  assert.equal(first.disabled, false);
  first.click();
  assert.equal(first.disabled, true);

  window.history.pushState({}, '', '/problems/valid-parentheses/');
  window.document.querySelector('[data-track-load="description_content"]').outerHTML = problem('Valid Parentheses');
  intervals[0]();
  await tick();
  finishHint({ success: true, data: { tierLabel: 'Old hint', content: 'Old problem solution', completedTiers: ['tier1'], confirmed: false, cooldownUntil: 0 } });
  await tick();
  assert.match(window.document.querySelector('#codecue-problem-title').textContent, /Valid Parentheses/);
  assert.doesNotMatch(window.document.querySelector('#codecue-output-body').textContent, /Old problem solution/);
  assert.equal(window.document.querySelector('[data-tier="tier2"]').disabled, true);
  assert.equal(window.document.querySelector('[data-tier="tier1"]').disabled, false);
  dom.window.close();
});
