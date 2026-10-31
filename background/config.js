export const DEFAULT_SETTINGS = {
  apiKey: '',
  strictness: 'balanced',
  model: 'gemini-3.8-flash'
};

export const REQUEST_TIMEOUT_MS = 25000;
export const SOLUTION_COOLDOWN_MS = 12000;
export const ALLOWED_TIERS = ['tier1', 'tier2', 'tier3', 'tier4'];

export const STRICTNESS_INSTRUCTIONS = {
  conservative: 'Give one brief nudge and a question.',
  balanced: 'Give a clear, focused hint that leaves the next reasoning step to the student.',
  generous: 'Give more explanation while still respecting the requested tier.'
};
