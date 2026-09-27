import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertCharacterRenderView,
  assertCircleRenderView,
  assertEncounterRenderView
} from '../rendering/nexoRenderViewContracts.js';
import { NexoValidationError } from '../errors.js';

function validCircle(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'circle',
    titleLabel: 'Estação Zero',
    modeLabel: 'Casual',
    statusLabel: 'Tenso',
    metrics: [{ label: 'Pulso', value: 68, max: 100 }],
    highlights: ['Vozes sob a ponte'],
    ...overrides
  };
}

function validCharacter(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'character',
    titleLabel: 'Lume',
    originLabel: 'Fugitivo do Arquivo',
    toneLabel: 'Véu + Eco',
    impulseLabel: 'Entender o oculto',
    scarLabel: 'Eco estranho',
    metrics: [{ label: 'Vitalidade', value: 21, max: 21 }],
    techniqueLabels: ['Marca Velada'],
    traitLabels: ['Investigador'],
    ...overrides
  };
}

function validEncounter(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'encounter',
    titleLabel: 'Vigia Sem Rosto',
    round: 2,
    postureLabel: 'Pulso',
    outcomeLabel: 'PLENO',
    actor: { label: 'Lume', metrics: [{ label: 'Vitalidade', value: 18, max: 21 }] },
    enemy: { label: 'Vigia', metrics: [{ label: 'Vitalidade', value: 74, max: 120 }], intentLabel: 'Apagar o último a agir' },
    actionLabels: ['Golpe Solar'],
    statusLabels: ['Guarda 3'],
    ...overrides
  };
}

test('aceita circle/character/encounter válidos', () => {
  assert.equal(assertCircleRenderView(validCircle()).kind, 'circle');
  assert.equal(assertCharacterRenderView(validCharacter()).kind, 'character');
  assert.equal(assertEncounterRenderView(validEncounter()).kind, 'encounter');
});

test('rejeita schemaVersion/kind incorretos', () => {
  assert.throws(() => assertCircleRenderView(validCircle({ schemaVersion: 2 })), NexoValidationError);
  assert.throws(() => assertCircleRenderView(validCircle({ kind: 'character' })), NexoValidationError);
});

test('rejeita campo extra em qualquer nível', () => {
  assert.throws(() => assertCircleRenderView({ ...validCircle(), extra: 'nao deveria existir' }), NexoValidationError);
  assert.throws(
    () => assertCircleRenderView({ ...validCircle(), metrics: [{ label: 'x', value: 1, extra: true }] }),
    NexoValidationError
  );
});

test('rejeita JID, telefone, seed e identificadores brutos em qualquer label', () => {
  assert.throws(() => assertCircleRenderView(validCircle({ titleLabel: '5511999999999@s.whatsapp.net' })), NexoValidationError);
  assert.throws(() => assertCircleRenderView(validCircle({ modeLabel: 'telefone 5511999999999' })), NexoValidationError);
  assert.throws(() => assertCircleRenderView(validCircle({ statusLabel: 'seed abc123' })), NexoValidationError);
  assert.throws(
    () => assertCharacterRenderView(validCharacter({ originLabel: 'a1b2c3d4-e5f6-4a5b-8c9d-0123456789ab' })),
    NexoValidationError
  );
  assert.throws(
    () => assertEncounterRenderView(validEncounter({ postureLabel: '+55 11 99999-9999' })),
    NexoValidationError
  );
});

test('rejeita métrica com value maior que max', () => {
  assert.throws(
    () => assertCircleRenderView(validCircle({ metrics: [{ label: 'Pulso', value: 150, max: 100 }] })),
    NexoValidationError
  );
});

test('impõe teto de listas (highlights, techniqueLabels, actionLabels)', () => {
  assert.throws(
    () => assertCircleRenderView(validCircle({ highlights: Array.from({ length: 9 }, (_, i) => `h${i}`) })),
    NexoValidationError
  );
  assert.throws(
    () => assertCharacterRenderView(validCharacter({ techniqueLabels: Array.from({ length: 9 }, (_, i) => `t${i}`) })),
    NexoValidationError
  );
  assert.throws(
    () => assertEncounterRenderView(validEncounter({ actionLabels: Array.from({ length: 7 }, (_, i) => `a${i}`) })),
    NexoValidationError
  );
});

test('outcomeLabel é opcional no encounter', () => {
  const { outcomeLabel, ...withoutOutcome } = validEncounter();
  const parsed = assertEncounterRenderView(withoutOutcome);
  assert.equal(parsed.outcomeLabel, undefined);
});

test('round do encounter precisa ser inteiro >= 1', () => {
  assert.throws(() => assertEncounterRenderView(validEncounter({ round: 0 })), NexoValidationError);
  assert.throws(() => assertEncounterRenderView(validEncounter({ round: 1.5 })), NexoValidationError);
});
