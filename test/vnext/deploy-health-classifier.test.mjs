import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyGyomeiProcessEvidence } from '../../scripts/deploy-refactor-parallel-direct.mjs';

function sample(observedAt, uptime, memoryBytes = 176_000_000, state = 'starting') {
  return { observedAt, uptime, memoryBytes, state };
}

test('aceita uptime real do painel atualizado em blocos', () => {
  const base = 1_000_000;
  const uptimes = [
    727108, 727108, 727108, 727108,
    753809, 753809, 753809, 753809,
    776606, 776606, 776606, 776606,
  ];
  const observations = uptimes.map((uptime, index) => sample(base + index * 5000, uptime, 176_373_760 + index * 8_000));
  const result = classifyGyomeiProcessEvidence(observations);
  assert.equal(result.healthy, true);
  assert.equal(result.uptimeGrowthMs, 49498);
  assert.equal(result.panelStateUsedAsHealthGate, false);
});

test('recusa uptime completamente estagnado', () => {
  const base = 2_000_000;
  const observations = Array.from({ length: 12 }, (_, index) => sample(base + index * 5000, 500000));
  const result = classifyGyomeiProcessEvidence(observations);
  assert.equal(result.healthy, false);
});

test('recusa janela com memória ausente', () => {
  const base = 3_000_000;
  const observations = Array.from({ length: 12 }, (_, index) => sample(base + index * 5000, 500000 + index * 5000, index === 6 ? 0 : 176_000_000));
  const result = classifyGyomeiProcessEvidence(observations);
  assert.equal(result.healthy, false);
});

test('recusa reset de uptime sem nova janela estável suficiente', () => {
  const base = 4_000_000;
  const uptimes = [500000, 500000, 520000, 520000, 540000, 1000, 1000, 8000, 8000, 16000, 16000, 21000];
  const observations = uptimes.map((uptime, index) => sample(base + index * 5000, uptime));
  const result = classifyGyomeiProcessEvidence(observations);
  assert.equal(result.healthy, false);
});

test('tolera amostras espaçadas quando uptime permanece monotônico e avança', () => {
  const base = 5_000_000;
  const observations = [
    sample(base, 100000),
    sample(base + 10000, 100000),
    sample(base + 25000, 124000),
    sample(base + 50000, 149000),
  ];
  const result = classifyGyomeiProcessEvidence(observations);
  assert.equal(result.healthy, true);
});
