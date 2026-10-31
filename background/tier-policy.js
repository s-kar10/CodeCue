import { ALLOWED_TIERS } from './config.js';

export function isValidTier(tier) {
  return ALLOWED_TIERS.includes(tier);
}

export function evaluateTierAccess({ tier, completedTiers = [], confirmed = false, cooldownUntil = 0, now = Date.now() }) {
  if (!isValidTier(tier)) return { allowed: false, reason: 'Invalid hint tier.' };

  const required = ALLOWED_TIERS.slice(0, ALLOWED_TIERS.indexOf(tier));
  const missing = required.filter((item) => !completedTiers.includes(item));
  if (missing.length) return { allowed: false, reason: `Complete ${missing.join(', ')} first.` };

  if (tier === 'tier4') {
    if (!confirmed) return { allowed: false, reason: 'Acknowledge the solution warning first.' };
    if (!cooldownUntil || now < cooldownUntil) {
      return { allowed: false, reason: 'The solution cooldown is still active.' };
    }
  }

  return { allowed: true, reason: '' };
}
