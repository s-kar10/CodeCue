import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const script = readFileSync(new URL('../content/markdown-renderer.js', import.meta.url), 'utf8');

test('model text is escaped while code fences remain readable', () => {
  const dom = new JSDOM('', { runScripts: 'outside-only' });
  dom.window.eval(script);
  const html = dom.window.LeetBuddyMarkdown.toHtml('## Hint\n<img src=x onerror=alert(1)>\n```js\nreturn "<unsafe>";\n```');
  assert.doesNotMatch(html, /<img|<unsafe>/);
  assert.match(html, /&lt;img/);
  assert.match(html, /<pre><code>return/);
  dom.window.close();
});
