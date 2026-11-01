import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const script = readFileSync(new URL('../content/context-extractor.js', import.meta.url), 'utf8');
const description = `
  <div data-track-load="description_content">
    <div data-cy="question-title">1. Two Sum</div>
    <span data-difficulty="Easy">Easy</span>
    <p>Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.</p>
    <p>You may assume that each input would have exactly one solution.</p>
    <p><strong>Example 1:</strong></p><pre>Input: nums = [2,7,11,15], target = 9 Output: [0,1]</pre>
    <p><strong>Constraints:</strong></p><ul><li>2 &lt;= nums.length &lt;= 10^4</li><li>-10^9 &lt;= nums[i] &lt;= 10^9</li></ul>
  </div>`;

test('extracts problem text, examples and constraints from description only', () => {
  const dom = new JSDOM(`<!doctype html><title>Two Sum - LeetCode</title>${description}<aside id="codecue-shell">Full solution Medium</aside>`, { url: 'https://leetcode.com/problems/two-sum/', runScripts: 'outside-only' });
  dom.window.eval(script);
  const result = dom.window.CodeCueExtractor.extractContext();
  assert.equal(result.slug, 'two-sum');
  assert.equal(result.title, '1. Two Sum');
  assert.equal(result.difficulty, 'Easy');
  assert.match(result.statement, /exactly one solution/);
  assert.doesNotMatch(result.statement, /Full solution|Example 1/);
  assert.match(result.examples[0], /target = 9/);
  assert.equal(result.constraints.length, 2);
  assert.equal(result.ready, true);
  dom.window.close();
});

test('does not use unrelated page text while description is hydrating', () => {
  const dom = new JSDOM('<!doctype html><title>Two Sum - LeetCode</title><main>Full solution and all examples Easy</main>', { url: 'https://leetcode.com/problems/two-sum/', runScripts: 'outside-only' });
  dom.window.eval(script);
  const result = dom.window.CodeCueExtractor.extractContext();
  assert.equal(result.statement, '');
  assert.equal(result.difficulty, '');
  assert.equal(result.ready, false);
  dom.window.close();
});

test('new problem URL does not reuse the previous problem description during navigation', () => {
  const dom = new JSDOM(`<!doctype html><title>Two Sum - LeetCode</title>${description}`, { url: 'https://leetcode.com/problems/two-sum/', runScripts: 'outside-only' });
  dom.window.eval(script);
  dom.window.history.pushState({}, '', '/problems/valid-parentheses/');
  const stale = dom.window.CodeCueExtractor.extractContext();
  assert.equal(stale.slug, 'valid-parentheses');
  assert.equal(stale.ready, false);
  dom.window.close();
});
