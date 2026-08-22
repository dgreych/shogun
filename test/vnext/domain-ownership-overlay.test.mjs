import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAtomicDomainOwnership } from '../../dados/src/.scripts/vnextDomainOwnershipOverlay.js';

const families = [
  { tokens: ['base'] },
  { tokens: ['perfil', 'alias-perfil'] },
  { tokens: ['rpg', 'dup'] },
  { tokens: ['dup', 'extra'] },
  { tokens: ['fora'] },
];

const seedConfig = {
  buckets: {
    members: ['perfil', 'rpg'],
  },
};

function config(state) {
  return {
    schemaVersion: 2,
    strategy: 'atomic-domain-cutover',
    domains: {
      members: {
        bucket: 'members',
        state,
        activationMode: 'all-or-nothing',
        duplicateClosure: 'required',
        expectedBaseFamilies: 2,
        expectedBaseTokens: 4,
        expectedCutoverFamilies: 3,
        expectedCutoverTokens: 5,
      },
    },
  };
}

test('staged valida fechamento mas não altera ownership baseline', () => {
  const result = applyAtomicDomainOwnership({
    families,
    baseNativeIndexes: new Set([0]),
    seedConfig,
    cutoverConfig: config('staged'),
  });

  assert.deepEqual([...result.nativeIndexes], [0]);
  assert.deepEqual(result.delta, {
    nativeFamilies: 0,
    nativeTokens: 0,
    compatibilityFamilies: 0,
    compatibilityTokens: 0,
  });
  assert.equal(result.activeDomains.members.families, 3);
  assert.equal(result.activeDomains.members.tokens, 5);
});

test('active move domínio inteiro e fechamento duplicado em uma operação', () => {
  const result = applyAtomicDomainOwnership({
    families,
    baseNativeIndexes: new Set([0]),
    seedConfig,
    cutoverConfig: config('active'),
  });

  assert.deepEqual([...result.nativeIndexes].sort((a, b) => a - b), [0, 1, 2, 3]);
  assert.deepEqual(result.delta, {
    nativeFamilies: 3,
    nativeTokens: 5,
    compatibilityFamilies: -3,
    compatibilityTokens: -5,
  });
});

test('active recusa domínio que já foi parcialmente absorvido pelo baseline', () => {
  assert.throws(
    () => applyAtomicDomainOwnership({
      families,
      baseNativeIndexes: new Set([0, 1]),
      seedConfig,
      cutoverConfig: config('active'),
    }),
    /sobrepõe ownership nativo anterior/,
  );
});
