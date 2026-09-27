import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCharacterRenderView, buildCircleRenderView } from '../rendering/nexoRenderViewAdapter.js';
import { NexoValidationError } from '../errors.js';

function realCharacter(overrides = {}) {
  return {
    name: 'Lume',
    tier: 3,
    memory: 5,
    impulse: 'understand_hidden',
    scar: 'strange_echo',
    origin: 'archive_runaway',
    ...overrides
  };
}

test('buildCircleRenderView monta view válida a partir de grupo/temporada/mundo reais', () => {
  const view = buildCircleRenderView({
    group: { name: 'Círculo dos Ecos', status: 'ACTIVE' },
    season: { status: 'ACTIVE' },
    world: { pulse: 40, cohesion: 55, lucidity: 30, entropy: 20 }
  });
  assert.equal(view.kind, 'circle');
  assert.equal(view.titleLabel, 'Círculo dos Ecos');
  assert.equal(view.modeLabel, 'Ativa');
  assert.equal(view.statusLabel, 'Ativo');
  assert.deepEqual(view.metrics, [
    { label: 'Pulso', value: 40, max: 100 },
    { label: 'Coesão', value: 55, max: 100 },
    { label: 'Lucidez', value: 30, max: 100 },
    { label: 'Entropia', value: 20, max: 100 }
  ]);
  assert.deepEqual(view.highlights, []);
});

test('buildCircleRenderView usa rótulos neutros sem temporada/mundo', () => {
  const view = buildCircleRenderView({ group: { name: '', status: 'ACTIVE' }, season: null, world: null });
  assert.equal(view.titleLabel, 'Círculo');
  assert.equal(view.modeLabel, 'Sem temporada');
  assert.deepEqual(view.metrics, []);
});

test('buildCircleRenderView recusa nome de grupo que carregue identidade crua', () => {
  assert.throws(
    () => buildCircleRenderView({
      group: { name: 'Grupo de 5511999999999@s.whatsapp.net', status: 'ACTIVE' },
      season: null,
      world: null
    }),
    NexoValidationError
  );
});

test('buildCharacterRenderView monta view válida com Impulso/Cicatriz/Origem reais do conteúdo', () => {
  const view = buildCharacterRenderView({ character: realCharacter() });
  assert.equal(view.kind, 'character');
  assert.equal(view.titleLabel, 'Lume');
  assert.equal(view.originLabel, 'Fugitivo do Arquivo');
  assert.equal(view.toneLabel, 'Véu + Eco');
  assert.equal(view.impulseLabel, 'Entender o oculto');
  assert.equal(view.scarLabel, 'Eco estranho');
  assert.deepEqual(view.metrics, [
    { label: 'Patamar', value: 3, max: 20 },
    { label: 'Memória', value: 5 }
  ]);
  assert.deepEqual(view.techniqueLabels, []);
  assert.deepEqual(view.traitLabels, []);
});

test('buildCharacterRenderView usa nome neutro sem nome de personagem e omite Memória zerada', () => {
  const view = buildCharacterRenderView({ character: realCharacter({ name: null, memory: 0 }) });
  assert.equal(view.titleLabel, 'Andarilho sem nome');
  assert.deepEqual(view.metrics, [{ label: 'Patamar', value: 3, max: 20 }]);
});

test('buildCharacterRenderView devolve null (não lança) sem Impulso/Cicatriz/Origem reconhecidos', () => {
  assert.equal(buildCharacterRenderView({ character: realCharacter({ origin: null }) }), null);
  assert.equal(buildCharacterRenderView({ character: realCharacter({ origin: 'origem_inexistente' }) }), null);
  assert.equal(buildCharacterRenderView({ character: realCharacter({ impulse: 'impulso_inexistente' }) }), null);
});
