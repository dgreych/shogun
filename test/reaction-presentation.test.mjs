import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidReaction } from '../dados/src/utils/reactionPresentation.js';
test('reação aceita emoji composto ou remoção e rejeita texto ou sequência', () => {
  for (const value of ['🐈‍⬛', '👨‍👩‍👧‍👦', '✅', '⚠️', '🇧🇷', '1️⃣', '👍🏾', '']) assert.equal(isValidReaction(value), true, value);
  for (const value of ['ok', 'A', '✅⚠️', '\n', null, 1]) assert.equal(isValidReaction(value), false);
});
