import { createSettingsStore } from './settings.js';
import { createHintController } from './hint-controller.js';
import { requestHint } from './gemini-client.js';

const settings = createSettingsStore(chrome.storage);
const hints = createHintController({ storage: chrome.storage, settings, request: requestHint });
const storageReady = Promise.all([
  chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
  chrome.storage.sync.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
]);

function reflectionKey(sender, slug) {
  try {
    const url = new URL(sender?.url);
    if (!sender?.tab || sender.frameId !== 0 || url.origin !== 'https://leetcode.com' ||
        !/^\/problems\/[a-z0-9-]+(?:\/|$)/.test(url.pathname) || !/^[a-z0-9-]+$/.test(slug)) throw new Error();
    return `lsb_reflection_${slug}`;
  } catch { throw new Error('Reflection is available on LeetCode problem pages.'); }
}

async function route(message, sender) {
  await storageReady;
  if (!message || typeof message !== 'object') throw new Error('Invalid message.');

  switch (message.type) {
    case 'GET_SETTINGS': {
      if (sender.tab) throw new Error('Settings are available in the popup.');
      const current = await settings.get();
      return { ...current, apiKey: current.apiKey ? 'configured' : '' };
    }
    case 'SAVE_SETTINGS': {
      if (sender.tab) throw new Error('Settings are available in the popup.');
      await settings.save(message.settings);
      return null;
    }
    case 'TEST_GEMINI': {
      if (sender.tab) throw new Error('Settings are available in the popup.');
      const current = await settings.get();
      if (!current.apiKey) throw new Error('Add a Gemini API key first.');
      await requestHint({ ...current, prompt: 'Reply with exactly: Gemini connection successful.', temperature: 0, maxOutputTokens: 40 });
      return 'Gemini connection successful.';
    }
    case 'GET_REFLECTION': {
      const key = reflectionKey(sender, message.slug);
      return (await chrome.storage.local.get(key))[key] || { tried: '', stuck: '' };
    }
    case 'SAVE_REFLECTION': {
      const key = reflectionKey(sender, message.slug);
      const note = {
        tried: typeof message.note?.tried === 'string' ? message.note.tried.slice(0, 800) : '',
        stuck: typeof message.note?.stuck === 'string' ? message.note.stuck.slice(0, 800) : ''
      };
      await chrome.storage.local.set({ [key]: note });
      return null;
    }
    case 'START_SESSION': return hints.startSession(sender);
    case 'CONFIRM_SOLUTION': return hints.confirmSolution(sender, message.sessionId);
    case 'GET_HINT': return hints.getHint(sender, message);
    default: throw new Error('Unsupported message type.');
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void route(message, sender)
    .then((data) => sendResponse({ success: true, data }))
    .catch((error) => sendResponse({ success: false, error: error?.userMessage || error?.message || 'Request failed.' }));
  return true;
});
