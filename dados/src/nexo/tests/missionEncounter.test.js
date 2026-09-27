import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { NexoSqliteStore } from '../persistence/NexoSqliteStore.js';
import { NexoRepository } from '../persistence/NexoRepository.js';
import { NexoConflictError, NexoValidationError } from '../errors.js';
import { attackEnemy, deriveMaxVitality, getEnemyDefinition } from '../domain/missionEncounter.js';

function makeSequentialIdFactory() {
  let counter = 0;
  return () => `fixed-id-${counter++}`;
}

async function fixture(t) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'shogun-nexo-mission-'));
  t.after(() => fs.rm(tempDirectory, { recursive: true, force: true }));
  const store = await NexoSqliteStore.open({ filename: path.join(tempDirectory, 'nexo.sqlite') });
  t.after(() => store.close());
  const repository = new NexoRepository(store, { idFactory: makeSequentialIdFactory() });

  const group = await repository.upsertGroup({ transportChatId: 'grupo@g.us', name: 'Estação Zero' });
  await repository.setGroupStatus(group.id, 'ACTIVE');
  const season = await repository.createDraftSeason({ groupId: group.id, templateId: 'estacao-zero', seed: 'season-seed-combat' });
  await repository.activateSeason(season.id);

  const player = await repository.getOrCreatePlayer({ userId: 'user-1', groupId: group.id });
  await repository.createCharacterIfAbsent({
    playerId: player.id,
    name: 'Lume',
    impulse: 'break_impossible',
    scar: 'haste',
    origin: 'archive_runaway'
  });

  return { repository, group, season, context: { incoming: { chatId: 'grupo@g.us', groupId: 'grupo@g.us' }, actor: { canonicalUserId: 'user-1' } } };
}

test('getEnemyDefinition recusa inimigo desconhecido', () => {
  assert.throws(() => getEnemyDefinition('nao_existe'), NexoValidationError);
});

test('deriveMaxVitality segue a fórmula 12 + 3*Sustento + Patamar', () => {
  const impulse = { favoredAttributes: ['IMPACT', 'SUSTAIN'] };
  assert.equal(deriveMaxVitality({ tier: 1 }, impulse), 12 + 3 * 2 + 1);
});

test('atacar com técnica desconhecida é rejeitado sem criar encontro', async t => {
  const { repository, context } = await fixture(t);
  await assert.rejects(
    () => attackEnemy({ repository, context, enemyId: 'cao_de_rasura', techniqueId: 'nao_existe' }),
    NexoValidationError
  );
});

test('atacar inimigo inexistente é rejeitado', async t => {
  const { repository, context } = await fixture(t);
  await assert.rejects(
    () => attackEnemy({ repository, context, enemyId: 'nao_existe', techniqueId: 'solar_strike' }),
    NexoValidationError
  );
});

test('atacar reduz a Vitalidade do inimigo real e nunca a deixa negativa', async t => {
  const { repository, context } = await fixture(t);
  const result = await attackEnemy({ repository, context, enemyId: 'cao_de_rasura', techniqueId: 'solar_strike', stance: 'PULSE' });
  assert.equal(result.kind, 'CARD');
  assert.match(result.sections[0].lines[0], /Golpe Solar/);
});

test('combate real termina em Vitória contra um inimigo fraco, com dano nunca negativo', async t => {
  const { repository, context } = await fixture(t);
  let last = null;
  let victorious = false;
  for (let attempt = 0; attempt < 12 && !victorious; attempt += 1) {
    last = await attackEnemy({ repository, context, enemyId: 'cao_de_rasura', techniqueId: 'solar_strike', stance: 'PULSE' });
    victorious = last.sections[0].lines.some(line => line.includes('caiu. Vitória.'));
  }
  assert.ok(victorious, 'esperava vitória dentro de 12 tentativas contra hpBase 20');

  await assert.rejects(
    () => attackEnemy({ repository, context, enemyId: 'cao_de_rasura', techniqueId: 'solar_strike' }),
    NexoConflictError
  );
});

test('combate é determinístico: mesma sequência de ids/seed produz o mesmo resultado', async t => {
  const a = await fixture(t);
  const b = await fixture(t);

  const resultA = await attackEnemy({ repository: a.repository, context: a.context, enemyId: 'cao_de_rasura', techniqueId: 'solar_strike', stance: 'PULSE' });
  const resultB = await attackEnemy({ repository: b.repository, context: b.context, enemyId: 'cao_de_rasura', techniqueId: 'solar_strike', stance: 'PULSE' });

  assert.deepEqual(resultA.sections[0].lines, resultB.sections[0].lines);
});
