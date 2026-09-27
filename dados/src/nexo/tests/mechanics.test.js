import assert from 'node:assert/strict';
import test from 'node:test';

import { createSeededRng, deriveNumericSeed } from '../domain/rng.js';
import { classifyOutcome, computeDamage, computeHeal, computeShield, resolveRoll } from '../domain/combatFormulas.js';
import { detectResonance, isRepeatedTechnique } from '../domain/resonance.js';
import { NexoValidationError } from '../errors.js';

test('RNG com a mesma seed produz a mesma sequência (determinístico)', () => {
  const rngA = createSeededRng(42);
  const rngB = createSeededRng(42);
  const sequenceA = Array.from({ length: 10 }, () => rngA.rollD12());
  const sequenceB = Array.from({ length: 10 }, () => rngB.rollD12());
  assert.deepEqual(sequenceA, sequenceB);
  assert.ok(sequenceA.every(value => value >= 1 && value <= 12));
});

test('seeds diferentes produzem sequências diferentes', () => {
  const rngA = createSeededRng(1);
  const rngB = createSeededRng(2);
  const sequenceA = Array.from({ length: 10 }, () => rngA.rollD12());
  const sequenceB = Array.from({ length: 10 }, () => rngB.rollD12());
  assert.notDeepEqual(sequenceA, sequenceB);
});

test('deriveNumericSeed é determinístico para os mesmos identificadores e muda se algum mudar', () => {
  const base = { seasonSeed: 's1', encounterId: 'e1', round: 1, actionId: 'a1' };
  const seedA = deriveNumericSeed(base);
  const seedB = deriveNumericSeed(base);
  assert.equal(seedA, seedB);

  const seedRoundDiferente = deriveNumericSeed({ ...base, round: 2 });
  assert.notEqual(seedA, seedRoundDiferente);

  const rngFromA = createSeededRng(base);
  const rollsA1 = Array.from({ length: 5 }, () => rngFromA.rollD12());
  const rngFromA2 = createSeededRng({ ...base });
  const rollsA2 = Array.from({ length: 5 }, () => rngFromA2.rollD12());
  assert.deepEqual(rollsA1, rollsA2);
});

test('classifyOutcome segue as faixas da seção 8.3', () => {
  assert.equal(classifyOutcome(-5), 'SETBACK');
  assert.equal(classifyOutcome(-3), 'SETBACK');
  assert.equal(classifyOutcome(-2), 'TENSE');
  assert.equal(classifyOutcome(1), 'TENSE');
  assert.equal(classifyOutcome(2), 'FULL');
  assert.equal(classifyOutcome(5), 'FULL');
  assert.equal(classifyOutcome(6), 'RUPTURE');
  assert.equal(classifyOutcome(20), 'RUPTURE');
});

test('resolveRoll aplica bônus/penalidade de postura corretamente', () => {
  const rng = createSeededRng(7);
  const rollValue = rng.rollD12();
  const freshRng = { rollD12: () => rollValue };

  const cautious = resolveRoll({ rng: freshRng, attributeValue: 3, difficulty: 8, stance: 'CAUTION' });
  const pulse = resolveRoll({ rng: freshRng, attributeValue: 3, difficulty: 8, stance: 'PULSE' });
  const rupture = resolveRoll({ rng: freshRng, attributeValue: 3, difficulty: 8, stance: 'RUPTURE' });

  assert.equal(cautious.roll, rollValue + 3 + 2);
  assert.equal(pulse.roll, rollValue + 3);
  assert.equal(rupture.roll, rollValue + 3 - 2);
  assert.equal(cautious.effectMultiplier, 0.75);
  assert.equal(pulse.effectMultiplier, 1);
  assert.equal(rupture.effectMultiplier, 1.5);
  assert.equal(cautious.isCriticalRupture, false);
});

test('resolveRoll rejeita postura inválida', () => {
  assert.throws(
    () => resolveRoll({ rng: { rollD12: () => 6 }, difficulty: 8, stance: 'NAO_EXISTE' }),
    NexoValidationError
  );
});

test('fórmulas de dano, escudo e cura seguem a seção 8.5', () => {
  const damage = computeDamage({ baseTechnique: 6, impact: 2, margin: 4, guard: 1 });
  assert.equal(damage, 6 + 2 + 2 - 1);

  const damageNeverBelowOne = computeDamage({ baseTechnique: 1, impact: 0, margin: -10, guard: 20 });
  assert.equal(damageNeverBelowOne, 1);

  const shield = computeShield({ baseTechnique: 3, sustain: 4, resonanceBonus: 2 });
  assert.equal(shield, 9);

  const heal = computeHeal({ baseTechnique: 3, connection: 2, margin: 9, missingVitality: 4 });
  assert.equal(heal, 4); // limitado pela vitalidade faltante, não pela fórmula bruta

  const healBrutoMenorQueFaltante = computeHeal({ baseTechnique: 1, connection: 1, margin: 0, missingVitality: 20 });
  assert.equal(healBrutoMenorQueFaltante, 2);
});

test('postura Cautela reduz o efeito escalado (75%)', () => {
  const fullDamage = computeDamage({ baseTechnique: 4, impact: 0, margin: 0, guard: 0, effectMultiplier: 1 });
  const cautiousDamage = computeDamage({ baseTechnique: 4, impact: 0, margin: 0, guard: 0, effectMultiplier: 0.75 });
  assert.ok(cautiousDamage < fullDamage);
});

test('detecta os seis combos de par nomeados da seção 7.2', () => {
  const pairs = [
    ['FLAME', 'VEIL', 'ambush'],
    ['VEIL', 'ROOT', 'containment'],
    ['ROOT', 'ECHO', 'refuge'],
    ['ECHO', 'FLAME', 'summoning'],
    ['VEIL', 'ECHO', 'revelation'],
    ['FLAME', 'ROOT', 'impact_wall']
  ];
  for (const [toneA, toneB, expectedId] of pairs) {
    const chain = [
      { tone: toneA, playerId: 'p1', hasRealEffect: true, techniqueId: 't1' },
      { tone: toneB, playerId: 'p2', hasRealEffect: true, techniqueId: 't2' }
    ];
    const combo = detectResonance(chain);
    assert.equal(combo.id, expectedId, `esperava ${expectedId} para ${toneA}->${toneB}`);
  }
});

test('o mesmo par invertido produz outro efeito (ordem importa)', () => {
  const forward = detectResonance([
    { tone: 'FLAME', playerId: 'p1', hasRealEffect: true },
    { tone: 'VEIL', playerId: 'p2', hasRealEffect: true }
  ]);
  const backward = detectResonance([
    { tone: 'VEIL', playerId: 'p1', hasRealEffect: true },
    { tone: 'FLAME', playerId: 'p2', hasRealEffect: true }
  ]);
  assert.equal(forward.id, 'ambush');
  assert.notEqual(backward?.id, 'ambush');
});

test('uma pessoa não encadeia consigo mesma', () => {
  const chain = [
    { tone: 'FLAME', playerId: 'p1', hasRealEffect: true },
    { tone: 'VEIL', playerId: 'p1', hasRealEffect: true }
  ];
  assert.equal(detectResonance(chain), null);
});

test('três tons iguais de pessoas diferentes gera Saturação', () => {
  const chain = [
    { tone: 'ECHO', playerId: 'p1', hasRealEffect: true },
    { tone: 'ECHO', playerId: 'p2', hasRealEffect: true },
    { tone: 'ECHO', playerId: 'p3', hasRealEffect: true }
  ];
  const combo = detectResonance(chain);
  assert.equal(combo.kind, 'SATURATION');
});

test('quatro tons distintos de pessoas diferentes gera Convergência', () => {
  const chain = [
    { tone: 'FLAME', playerId: 'p1', hasRealEffect: true },
    { tone: 'VEIL', playerId: 'p2', hasRealEffect: true },
    { tone: 'ROOT', playerId: 'p1', hasRealEffect: true },
    { tone: 'ECHO', playerId: 'p2', hasRealEffect: true }
  ]; // último par (ROOT->ECHO) também bateria com "refuge", mas Convergência é mais específica e vem primeiro
  const combo = detectResonance(chain);
  assert.equal(combo.kind, 'CONVERGENCE');
});

test('ações sem efeito real (hasRealEffect: false) não entram na cadeia', () => {
  const chain = [
    { tone: 'FLAME', playerId: 'p1', hasRealEffect: true },
    { tone: 'ECHO', playerId: 'p1', hasRealEffect: false },
    { tone: 'VEIL', playerId: 'p2', hasRealEffect: true }
  ];
  const combo = detectResonance(chain);
  assert.equal(combo.id, 'ambush'); // ignora a entrada sem efeito, olha FLAME(p1)->VEIL(p2)
});

test('repetir a mesma técnica em sequência é detectado (custo de Foco maior é decisão de quem chama)', () => {
  const chain = [{ tone: 'FLAME', playerId: 'p1', hasRealEffect: true, techniqueId: 'solar_strike' }];
  assert.equal(isRepeatedTechnique(chain, 'solar_strike'), true);
  assert.equal(isRepeatedTechnique(chain, 'veil_mark'), false);
});
