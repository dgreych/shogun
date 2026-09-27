import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { NexoSqliteStore } from '../persistence/NexoSqliteStore.js';
import { NexoRepository } from '../persistence/NexoRepository.js';
import { NexoConflictError } from '../errors.js';

async function fixture(t) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'shogun-nexo-encounter-'));
  t.after(() => fs.rm(tempDirectory, { recursive: true, force: true }));
  const store = await NexoSqliteStore.open({ filename: path.join(tempDirectory, 'nexo.sqlite') });
  t.after(() => store.close());
  const repository = new NexoRepository(store);

  const group = await repository.upsertGroup({ transportChatId: 'grupo@g.us', name: 'Estação Zero' });
  const season = await repository.createDraftSeason({ groupId: group.id, templateId: 'estacao-zero', seed: 'seed-1' });
  await repository.activateSeason(season.id);
  return { repository, group, season };
}

test('migração v2 (encontros) é aplicada junto com as demais, sem duplicar', async t => {
  const { repository } = await fixture(t);
  const store = repository.store;
  const migrationCount = await store.read(session => session.get('SELECT COUNT(*) AS total FROM nexo_schema_migrations'));
  assert.equal(Number(migrationCount.total), 3);
});

test('cria encontro em CREATED e transiciona pra OPEN_ROUND', async t => {
  const { repository, season, group } = await fixture(t);
  const encounter = await repository.createEncounter({
    seasonId: season.id,
    groupId: group.id,
    type: 'TUTORIAL',
    seed: 'seed-encontro-1'
  });
  assert.equal(encounter.state, 'CREATED');
  assert.equal(encounter.round, 0);
  assert.equal(encounter.version, 0);

  const opened = await repository.transitionEncounter(encounter.id, 0, {
    state: 'OPEN_ROUND',
    round: 1,
    deadlineAt: '2026-08-16T15:00:00.000Z'
  });
  assert.equal(opened.state, 'OPEN_ROUND');
  assert.equal(opened.round, 1);
  assert.equal(opened.version, 1);
});

test('transição otimista rejeita versão desatualizada', async t => {
  const { repository, season, group } = await fixture(t);
  const encounter = await repository.createEncounter({ seasonId: season.id, groupId: group.id, type: 'TUTORIAL', seed: 's1' });
  await repository.transitionEncounter(encounter.id, 0, { state: 'OPEN_ROUND', round: 1 });

  await assert.rejects(
    repository.transitionEncounter(encounter.id, 0, { state: 'OPEN_ROUND', round: 1 }),
    NexoConflictError
  );
});

test('state_json faz merge (patch), não substitui o objeto inteiro', async t => {
  const { repository, season, group } = await fixture(t);
  const encounter = await repository.createEncounter({ seasonId: season.id, groupId: group.id, type: 'TUTORIAL', seed: 's1' });

  const first = await repository.transitionEncounter(encounter.id, 0, {
    state: 'OPEN_ROUND',
    round: 1,
    stateDataPatch: { stage: 'first_choice', foo: 'bar' }
  });
  assert.deepEqual(first.stateData, { stage: 'first_choice', foo: 'bar' });

  const second = await repository.transitionEncounter(encounter.id, 1, {
    state: 'OPEN_ROUND',
    round: 1,
    stateDataPatch: { stage: 'read_the_noise' }
  });
  assert.deepEqual(second.stateData, { stage: 'read_the_noise', foo: 'bar' });
});

test('agir cria submissão nova e reenviar antes do lock substitui (upsert)', async t => {
  const { repository, season, group } = await fixture(t);
  const encounter = await repository.createEncounter({ seasonId: season.id, groupId: group.id, type: 'TUTORIAL', seed: 's1' });
  await repository.transitionEncounter(encounter.id, 0, { state: 'OPEN_ROUND', round: 1 });

  const first = await repository.upsertActionSubmission({
    encounterId: encounter.id,
    round: 1,
    playerId: 'player-1',
    payload: { techniqueId: 'solar_strike', stance: 'PULSE' }
  });
  assert.equal(first.version, 0);

  const replaced = await repository.upsertActionSubmission({
    encounterId: encounter.id,
    round: 1,
    playerId: 'player-1',
    payload: { techniqueId: 'veil_mark', stance: 'CAUTION' }
  });
  assert.equal(replaced.id, first.id);
  assert.equal(replaced.version, 1);
  assert.equal(replaced.payload.techniqueId, 'veil_mark');

  const submissions = await repository.listActionSubmissions(encounter.id, 1);
  assert.equal(submissions.length, 1);
});

test('duas pessoas diferentes submetendo na mesma rodada geram duas linhas', async t => {
  const { repository, season, group } = await fixture(t);
  const encounter = await repository.createEncounter({ seasonId: season.id, groupId: group.id, type: 'TUTORIAL', seed: 's1' });
  await repository.transitionEncounter(encounter.id, 0, { state: 'OPEN_ROUND', round: 1 });

  await repository.upsertActionSubmission({ encounterId: encounter.id, round: 1, playerId: 'p1', payload: { techniqueId: 't1' } });
  await repository.upsertActionSubmission({ encounterId: encounter.id, round: 1, playerId: 'p2', payload: { techniqueId: 't2' } });

  const submissions = await repository.listActionSubmissions(encounter.id, 1);
  assert.equal(submissions.length, 2);
});
