import assert from 'node:assert/strict';
import test from 'node:test';

import { assignOriginId } from '../domain/originAssignment.js';
import { NEXO_MVP_CONTENT } from '../content/index.js';

const ORIGINS = [
  { id: 'origin_a', label: 'Origem A' },
  { id: 'origin_b', label: 'Origem B' },
  { id: 'origin_c', label: 'Origem C' },
  { id: 'origin_d', label: 'Origem D' },
  { id: 'origin_e', label: 'Origem E' },
  { id: 'origin_f', label: 'Origem F' },
  { id: 'origin_g', label: 'Origem G' },
  { id: 'origin_h', label: 'Origem H' }
];

test('assignOriginId é determinístico: mesmo impulso+cicatriz sempre gera a mesma Origem', () => {
  const first = assignOriginId({ impulseId: 'understand_hidden', scarId: 'strange_echo', origins: ORIGINS });
  const second = assignOriginId({ impulseId: 'understand_hidden', scarId: 'strange_echo', origins: ORIGINS });
  assert.equal(first, second);
  assert.ok(ORIGINS.some(origin => origin.id === first));
});

test('assignOriginId varia com a combinação de impulso+cicatriz (não é sempre a mesma Origem)', () => {
  const results = new Set();
  const impulses = ['break_impossible', 'understand_hidden', 'keep_people_standing', 'bend_rules'];
  const scars = ['haste', 'strange_echo', 'others_weight', 'answer_hunger'];
  for (const impulseId of impulses) {
    for (const scarId of scars) {
      results.add(assignOriginId({ impulseId, scarId, origins: ORIGINS }));
    }
  }
  assert.ok(results.size > 1);
});

test('assignOriginId devolve null sem lista de Origens', () => {
  assert.equal(assignOriginId({ impulseId: 'a', scarId: 'b', origins: [] }), null);
  assert.equal(assignOriginId({ impulseId: 'a', scarId: 'b', origins: null }), null);
});

test('assignOriginId preserva o único par canônico do PDF (understand_hidden+strange_echo -> archive_runaway)', () => {
  // Achado GPT-NEXO-007 (MÉDIA): a versão anterior (hash puro) não
  // preservava esse exemplo -- confirmado contra o conteúdo real do
  // GPT-NEXO-001, não uma lista fake.
  const result = assignOriginId({
    impulseId: 'understand_hidden',
    scarId: 'strange_echo',
    origins: NEXO_MVP_CONTENT.origins
  });
  assert.equal(result, 'archive_runaway');
});

test('assignOriginId com fixture sem archive_runaway cai no hash normal (não força um id inexistente)', () => {
  const result = assignOriginId({ impulseId: 'understand_hidden', scarId: 'strange_echo', origins: ORIGINS });
  assert.ok(ORIGINS.some(origin => origin.id === result));
});
