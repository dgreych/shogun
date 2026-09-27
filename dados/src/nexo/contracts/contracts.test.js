import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NexoContractValidationError,
  validateAttribute,
  validateCircleMode,
  validateContentRef,
  validateContentVersion,
  validateImpulseDefinition,
  validateMessageViewModelKind,
  validateOnboardingState,
  validateOutcome,
  validateStance,
  validateTechniqueDefinition,
  validateTone
} from './index.js';

test('validadores aceitam os enums canônicos do NEXO', () => {
  assert.equal(validateCircleMode('CASUAL'), 'CASUAL');
  assert.equal(validateOnboardingState('AWAITING_SCAR'), 'AWAITING_SCAR');
  assert.equal(validateTone('ECHO'), 'ECHO');
  assert.equal(validateAttribute('CONNECTION'), 'CONNECTION');
  assert.equal(validateStance('RUPTURE'), 'RUPTURE');
  assert.equal(validateOutcome('FULL'), 'FULL');
  assert.equal(validateMessageViewModelKind('DIGEST'), 'DIGEST');
  assert.equal(validateContentVersion('1.0.0'), '1.0.0');
  assert.equal(validateContentRef('echo_thread@1'), 'echo_thread@1');
});

test('validadores recusam enums, versões e referências inválidas', () => {
  assert.throws(() => validateCircleMode('RANKED'), NexoContractValidationError);
  assert.throws(() => validateOnboardingState('DONE'), NexoContractValidationError);
  assert.throws(() => validateTone('NEUTRAL'), NexoContractValidationError);
  assert.throws(() => validateAttribute('LUCK'), NexoContractValidationError);
  assert.throws(() => validateStance('AGGRESSIVE'), NexoContractValidationError);
  assert.throws(() => validateOutcome('CRITICAL'), NexoContractValidationError);
  assert.throws(() => validateMessageViewModelKind('IMAGE'), NexoContractValidationError);
  assert.throws(() => validateContentVersion('v1'), NexoContractValidationError);
  assert.throws(() => validateContentRef('echo_thread'), NexoContractValidationError);
});

test('contratos declarativos rejeitam campos extras', () => {
  assert.throws(() => validateImpulseDefinition({
    id: 'understand_hidden',
    version: 1,
    name: 'Entender o oculto',
    signature: ['VEIL', 'ECHO'],
    favoredAttributes: ['READING', 'CONNECTION'],
    fantasy: 'Investigador, estrategista e revelador de padrões.',
    secret: true
  }), /campos não permitidos/);
});

test('técnica rejeita campos extras em níveis aninhados e postura inválida', () => {
  const valid = {
    id: 'echo_thread',
    version: 1,
    name: 'Fio de Retorno',
    tone: 'ECHO',
    category: 'SUPPORT',
    attribute: 'CONNECTION',
    focusCost: 1,
    baseEffect: { shield: 3, resonance: 12 },
    range: 'ALLY',
    allowedStances: ['PULSE'],
    tags: ['ALLY', 'CHAIN_STARTER'],
    cooldownRounds: 1,
    unlock: { path: 'echo', rank: 1 },
    description: 'Escudo em aliado e amplia próxima Ressonância.'
  };

  assert.equal(validateTechniqueDefinition(valid).id, 'echo_thread');
  assert.throws(() => validateTechniqueDefinition({ ...valid, baseEffect: { ...valid.baseEffect, rawSeed: 1 } }), /campos não permitidos/);
  assert.throws(() => validateTechniqueDefinition({ ...valid, allowedStances: ['BERSERK'] }), NexoContractValidationError);
  assert.throws(() => validateTechniqueDefinition({ ...valid, description: 'x'.repeat(301) }), NexoContractValidationError);
});
