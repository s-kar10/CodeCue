import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTierAccess, isValidTier } from '../background/tier-policy.js';

const base = { completedTiers: ['tier1', 'tier2', 'tier3'], confirmed: true, cooldownUntil: 12000, now: 12000 };

test('tiers require completed earlier hints', () => {
  assert.equal(isValidTier('tier5'), false);
  assert.equal(evaluateTierAccess({ tier: 'tier2', completedTiers: [] }).allowed, false);
  assert.equal(evaluateTierAccess({ tier: 'tier3', completedTiers: ['tier1'] }).allowed, false);
  assert.equal(evaluateTierAccess({ tier: 'tier3', completedTiers: ['tier1', 'tier2'] }).allowed, true);
});

test('full solution requires acknowledgement and elapsed cooldown', () => {
  assert.equal(evaluateTierAccess({ ...base, tier: 'tier4', confirmed: false }).allowed, false);
  assert.equal(evaluateTierAccess({ ...base, tier: 'tier4', now: 11999 }).allowed, false);
  assert.equal(evaluateTierAccess({ ...base, tier: 'tier4' }).allowed, true);
});
