import assert from 'node:assert/strict';
import test from 'node:test';

import { planDomainCutovers } from '../../scripts/plan-vnext-domain-cutover.mjs';

test('Members só pode migrar como domínio completo com fechamento de duplicatas', () => {
  const plan = planDomainCutovers();
  const members = plan.domains.members;

  assert.equal(plan.strategy, 'atomic-domain-cutover');
  assert.ok(members, 'domínio Members precisa existir no contrato de cutover');
  assert.equal(members.activationMode, 'all-or-nothing');
  assert.equal(members.duplicateClosure, 'required');
  assert.equal(members.baseFamilies, 29);
  assert.equal(members.baseTokens, 148);
  assert.equal(members.closureFamilies, 3);
  assert.equal(members.closureAddedTokens, 4);
  assert.equal(members.families, 32);
  assert.equal(members.tokens, 152);

  if (members.state === 'staged') {
    assert.equal(members.nativeFamilies, 0);
    assert.equal(members.compatibilityFamilies, 32);
  } else {
    assert.equal(members.state, 'active');
    assert.equal(members.nativeFamilies, 32);
    assert.equal(members.compatibilityFamilies, 0);
  }
});

test('ownership global acompanha o cutover Members sem fallback ou ownership misto', () => {
  const plan = planDomainCutovers();
  const members = plan.domains.members;
  const deltaFamilies = members.state === 'active' ? 32 : 0;
  const deltaTokens = members.state === 'active' ? 152 : 0;

  assert.equal(plan.ownership.nativeFamilies, 100 + deltaFamilies);
  assert.equal(plan.ownership.nativeTokens, 562 + deltaTokens);
  assert.equal(plan.ownership.compatibilityFamilies, 445 - deltaFamilies);
  assert.equal(plan.ownership.compatibilityTokens, 1099 - deltaTokens);
  assert.equal(plan.ownership.nativeFamilies + plan.ownership.compatibilityFamilies, 545);
  assert.equal(plan.ownership.nativeTokens + plan.ownership.compatibilityTokens, 1661);
});
