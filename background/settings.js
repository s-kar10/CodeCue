import { DEFAULT_SETTINGS } from './config.js';

const allowedStrictness = new Set(['conservative', 'balanced', 'generous']);

export function createSettingsStore(storage) {
  async function get() {
    const local = await storage.local.get(DEFAULT_SETTINGS);
    const legacy = await storage.sync.get('apiKey');
    if (!local.apiKey && typeof legacy.apiKey === 'string' && legacy.apiKey.trim()) {
      local.apiKey = legacy.apiKey.trim();
      await storage.local.set({ apiKey: local.apiKey });
    }
    if (legacy.apiKey !== undefined) await storage.sync.remove('apiKey');
    return {
      apiKey: typeof local.apiKey === 'string' ? local.apiKey.trim().slice(0, 256) : '',
      strictness: allowedStrictness.has(local.strictness) ? local.strictness : DEFAULT_SETTINGS.strictness,
      model: typeof local.model === 'string' && /^[a-zA-Z0-9._-]{3,80}$/.test(local.model)
        ? local.model : DEFAULT_SETTINGS.model
    };
  }

  async function save(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid settings.');
    const current = await get();
    const next = { ...current };
    if (Object.hasOwn(input, 'apiKey')) {
      if (typeof input.apiKey !== 'string' || input.apiKey.length > 256) throw new Error('Invalid API key.');
      next.apiKey = input.apiKey.trim();
    }
    if (Object.hasOwn(input, 'strictness')) {
      if (!allowedStrictness.has(input.strictness)) throw new Error('Invalid hint strictness.');
      next.strictness = input.strictness;
    }
    if (Object.hasOwn(input, 'model')) {
      if (typeof input.model !== 'string' || !/^[a-zA-Z0-9._-]{3,80}$/.test(input.model)) throw new Error('Invalid model name.');
      next.model = input.model;
    }
    await storage.local.set(next);
    return next;
  }

  return { get, save };
}
