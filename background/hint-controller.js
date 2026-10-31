import { SOLUTION_COOLDOWN_MS } from './config.js';
import { evaluateTierAccess, isValidTier } from './tier-policy.js';
import { validateHintResponse } from './response-policy.js';
import { buildPrompt, getTierLabel } from './prompt-builder.js';

function problemSlug(url) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== 'https://leetcode.com') return '';
    return parsed.pathname.match(/^\/problems\/([a-z0-9-]+)(?:\/|$)/)?.[1] || '';
  } catch {
    return '';
  }
}

function text(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export function sanitizeContext(context) {
  return {
    title: text(context?.title, 140),
    difficulty: text(context?.difficulty, 20),
    statement: text(context?.statement, 6500),
    examples: Array.isArray(context?.examples) ? context.examples.slice(0, 4).map((item) => text(item, 600)).filter(Boolean) : [],
    constraints: Array.isArray(context?.constraints) ? context.constraints.slice(0, 8).map((item) => text(item, 300)).filter(Boolean) : [],
    url: text(context?.url, 300)
  };
}

function sanitizeReflection(reflection) {
  return { tried: text(reflection?.tried, 800), stuck: text(reflection?.stuck, 800) };
}

function fail(message) {
  throw new Error(message);
}

export function createHintController({ storage, settings, request, now = Date.now, createId = () => crypto.randomUUID() }) {
  const busyTabs = new Map();
  const sessionStarts = new Map();
  const storageKey = (tabId) => `lsb_progress_${tabId}`;

  function senderInfo(sender) {
    const tabId = sender?.tab?.id;
    const slug = problemSlug(sender?.url);
    if (!Number.isInteger(tabId) || !slug || sender.frameId !== 0) fail('Open a LeetCode problem page to use hints.');
    return { tabId, slug };
  }

  async function read(tabId) {
    const key = storageKey(tabId);
    return (await storage.session.get(key))[key];
  }

  async function write(tabId, progress) {
    await storage.session.set({ [storageKey(tabId)]: progress });
  }

  async function startSession(sender) {
    const { tabId, slug } = senderInfo(sender);
    const previous = sessionStarts.get(tabId) || Promise.resolve();
    const current = previous.catch(() => {}).then(async () => {
      const progress = { id: createId(), slug, completedTiers: [], previousHints: {}, confirmed: false, cooldownUntil: 0 };
      await write(tabId, progress);
      return { sessionId: progress.id, completedTiers: [], confirmed: false, cooldownUntil: 0 };
    });
    sessionStarts.set(tabId, current);
    try { return await current; }
    finally { if (sessionStarts.get(tabId) === current) sessionStarts.delete(tabId); }
  }

  async function requireSession(sender, sessionId) {
    const { tabId, slug } = senderInfo(sender);
    const progress = await read(tabId);
    if (!progress || progress.id !== sessionId || progress.slug !== slug) fail('Problem session changed. Refresh the panel and retry.');
    return { tabId, progress };
  }

  async function confirmSolution(sender, sessionId) {
    const { tabId, progress } = await requireSession(sender, sessionId);
    if (!progress.completedTiers.includes('tier3')) fail('Complete the first three hints before confirming.');
    progress.confirmed = true;
    await write(tabId, progress);
    return { confirmed: true, cooldownUntil: progress.cooldownUntil };
  }

  async function getHint(sender, message) {
    const { tabId, slug } = senderInfo(sender);
    const { progress } = await requireSession(sender, message.sessionId);
    if (busyTabs.get(tabId) === progress.id) fail('A hint is already loading. Wait for it to finish.');
    busyTabs.set(tabId, progress.id);
    try {
      const tier = message.tier;
      if (!isValidTier(tier)) fail('Invalid hint tier.');
      const access = evaluateTierAccess({ ...progress, tier, now: now() });
      if (!access.allowed) fail(access.reason);

      const context = sanitizeContext(message.context);
      if (problemSlug(context.url) !== slug) fail('Problem changed. Refresh the panel and retry.');
      if (!context.title || context.statement.length < 40) fail('Problem description is still loading. Wait a moment and retry.');

      const currentSettings = await settings.get();
      if (!currentSettings.apiKey) fail('Add a Gemini API key in the extension popup.');
      const prompt = buildPrompt({ tier, strictness: currentSettings.strictness, context, reflection: sanitizeReflection(message.reflection), previousHints: progress.previousHints });
      const content = await request({ model: currentSettings.model, apiKey: currentSettings.apiKey, prompt, maxOutputTokens: tier === 'tier4' ? 3000 : 1200 });
      if (!validateHintResponse(content, tier)) fail('Gemini returned a hint that may reveal too much or has the wrong format. Retry this tier.');

      const latest = await read(tabId);
      if (latest?.id !== progress.id || latest.slug !== slug) fail('Problem changed while the hint was loading.');
      if (!latest.completedTiers.includes(tier)) latest.completedTiers.push(tier);
      if (tier !== 'tier4') latest.previousHints[tier] = content;
      if (tier === 'tier3' && !latest.cooldownUntil) latest.cooldownUntil = now() + SOLUTION_COOLDOWN_MS;
      await write(tabId, latest);
      return {
        tier,
        tierLabel: getTierLabel(tier),
        content,
        completedTiers: latest.completedTiers,
        confirmed: latest.confirmed,
        cooldownUntil: latest.cooldownUntil
      };
    } finally {
      if (busyTabs.get(tabId) === progress.id) busyTabs.delete(tabId);
    }
  }

  return { startSession, confirmSolution, getHint };
}
