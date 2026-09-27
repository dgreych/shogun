import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { NexoSqliteStore } from '../persistence/NexoSqliteStore.js';
import { NexoRepository } from '../persistence/NexoRepository.js';
import { NexoConflictError } from '../errors.js';
import {
  finalizeEncounter,
  lockEncounterRound,
  openEncounterRound,
  resolveEncounterRound,
  submitAction
} from '../domain/encounterEngine.js';

async function fixture(t, { idFactory } = {}) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'shogun-nexo-engine-'));
  t.after(() => fs.rm(tempDirectory, { recursive: true, force: true }));
  const store = await NexoSqliteStore.open({ filename: path.join(tempDirectory, 'nexo.sqlite') });
  t.after(() => store.close());
  const repository = idFactory ? new NexoRepository(store, { idFactory }) : new NexoRepository(store);

  const group = await repository.upsertGroup({ transportChatId: 'grupo@g.us', name: 'Estação Zero' });
  const season = await repository.createDraftSeason({ groupId: group.id, templateId: 'estacao-zero', seed: 'season-seed-1' });
  await repository.activateSeason(season.id);
  const encounter = await repository.createEncounter({
    seasonId: season.id,
    groupId: group.id,
    type: 'TUTORIAL',
    seed: 'encounter-seed-1'
  });
  return { repository, store, group, season, encounter };
}

const FIXED_DIFFICULTY = () => 8;
const FIXED_ATTRIBUTE = () => 2;

test('abre rodada 1 a partir de CREATED', async t => {
  const { repository, encounter } = await fixture(t);
  const opened = await openEncounterRound({ repository, encounterId: encounter.id });
  assert.equal(opened.state, 'OPEN_ROUND');
  assert.equal(opened.round, 1);
  assert.ok(opened.deadlineAt);
});

test('agir fora de OPEN_ROUND é rejeitado', async t => {
  const { repository, encounter } = await fixture(t);
  await assert.rejects(
    submitAction({ repository, encounterId: encounter.id, playerId: 'p1', payload: { techniqueId: 't1' } }),
    NexoConflictError
  );
});

test('travar sem rodada aberta é rejeitado', async t => {
  const { repository, encounter } = await fixture(t);
  await assert.rejects(
    lockEncounterRound({ repository, encounterId: encounter.id }),
    NexoConflictError
  );
});

test('agir depois de travado é rejeitado (submissão só até o lock)', async t => {
  const { repository, encounter } = await fixture(t);
  await openEncounterRound({ repository, encounterId: encounter.id });
  await lockEncounterRound({ repository, encounterId: encounter.id });

  await assert.rejects(
    submitAction({ repository, encounterId: encounter.id, playerId: 'p1', payload: { techniqueId: 't1' } }),
    NexoConflictError
  );
});

test('resolver duas vezes a mesma rodada é rejeitado -- fechar por dois workers produz um único resultado', async t => {
  const { repository, encounter } = await fixture(t);
  await openEncounterRound({ repository, encounterId: encounter.id });
  await submitAction({ repository, encounterId: encounter.id, playerId: 'p1', payload: { techniqueId: 't1', stance: 'PULSE' } });
  await lockEncounterRound({ repository, encounterId: encounter.id });

  await resolveEncounterRound({
    repository,
    encounterId: encounter.id,
    seasonSeed: 'season-seed-1',
    difficultyFor: FIXED_DIFFICULTY,
    attributeFor: FIXED_ATTRIBUTE
  });

  await assert.rejects(
    resolveEncounterRound({
      repository,
      encounterId: encounter.id,
      seasonSeed: 'season-seed-1',
      difficultyFor: FIXED_DIFFICULTY,
      attributeFor: FIXED_ATTRIBUTE
    }),
    NexoConflictError
  );
});

test('resolver com a mesma seed produz o mesmo resultado (reprocessamento não rola de novo)', async t => {
  // idFactory fixo e sequencial: as duas fixtures precisam produzir o
  // MESMO encounterId pra provar determinismo de verdade -- com UUID
  // aleatório (padrão), o composto seasonSeed+encounterId+round+actionId
  // seria diferente entre A e B mesmo usando a "mesma seed de temporada",
  // o que tornaria a comparação sem sentido.
  function makeSequentialIdFactory() {
    let counter = 0;
    return () => `fixed-id-${counter++}`;
  }

  const { repository: repoA, encounter: encounterA } = await fixture(t, { idFactory: makeSequentialIdFactory() });
  await openEncounterRound({ repository: repoA, encounterId: encounterA.id });
  await submitAction({ repository: repoA, encounterId: encounterA.id, playerId: 'p1', payload: { techniqueId: 't1', stance: 'PULSE' } });
  await lockEncounterRound({ repository: repoA, encounterId: encounterA.id });
  const { results: resultsA } = await resolveEncounterRound({
    repository: repoA,
    encounterId: encounterA.id,
    seasonSeed: 'season-seed-1',
    difficultyFor: FIXED_DIFFICULTY,
    attributeFor: FIXED_ATTRIBUTE
  });

  const { repository: repoB, encounter: encounterB } = await fixture(t, { idFactory: makeSequentialIdFactory() });
  await openEncounterRound({ repository: repoB, encounterId: encounterB.id });
  await submitAction({ repository: repoB, encounterId: encounterB.id, playerId: 'p1', payload: { techniqueId: 't1', stance: 'PULSE' } });
  await lockEncounterRound({ repository: repoB, encounterId: encounterB.id });
  const { results: resultsB } = await resolveEncounterRound({
    repository: repoB,
    encounterId: encounterB.id,
    seasonSeed: 'season-seed-1',
    difficultyFor: FIXED_DIFFICULTY,
    attributeFor: FIXED_ATTRIBUTE
  });

  assert.equal(encounterA.id, encounterB.id); // confirma a premissa do teste
  assert.equal(resultsA[0].roll.dieRoll, resultsB[0].roll.dieRoll);
  assert.equal(resultsA[0].roll.outcome, resultsB[0].roll.outcome);
});

test('duas pessoas com tons complementares geram combo de Ressonância na resolução', async t => {
  // idFactory fixo: o combo FLAME->VEIL só existe NESSA ordem
  // (PAIR_COMBOS não é simétrico) e o desempate de resolução, sem
  // priorityFor, cai no id da submissão -- com UUID aleatório a ordem
  // p1/p2 no chain virava sorteio, tornando o teste inerentemente
  // instável (achado real: falhou em 2 de 3 execuções do lote completo
  // de testes, sempre passou isolado).
  let counter = 0;
  const idFactory = () => `fixed-id-${counter++}`;
  const { repository, encounter } = await fixture(t, { idFactory });
  await openEncounterRound({ repository, encounterId: encounter.id });
  await submitAction({
    repository,
    encounterId: encounter.id,
    playerId: 'p1',
    payload: { techniqueId: 'solar_strike', tone: 'FLAME', stance: 'PULSE' }
  });
  await submitAction({
    repository,
    encounterId: encounter.id,
    playerId: 'p2',
    payload: { techniqueId: 'veil_mark', tone: 'VEIL', stance: 'PULSE' }
  });
  await lockEncounterRound({ repository, encounterId: encounter.id });

  const { results } = await resolveEncounterRound({
    repository,
    encounterId: encounter.id,
    seasonSeed: 'season-seed-1',
    difficultyFor: () => 1, // dificuldade baixa: garante outcome != SETBACK (hasRealEffect)
    attributeFor: FIXED_ATTRIBUTE
  });

  assert.ok(results.some(result => result.combo?.id === 'ambush'));
});

test('a cadeia de Ressonância persiste entre rodadas (round 2 pode fechar combo aberto no round 1)', async t => {
  const { repository, encounter } = await fixture(t);
  await openEncounterRound({ repository, encounterId: encounter.id });
  await submitAction({
    repository,
    encounterId: encounter.id,
    playerId: 'p1',
    payload: { techniqueId: 'solar_strike', tone: 'FLAME', stance: 'PULSE' }
  });
  await lockEncounterRound({ repository, encounterId: encounter.id });
  await resolveEncounterRound({
    repository,
    encounterId: encounter.id,
    seasonSeed: 'season-seed-1',
    difficultyFor: () => 1,
    attributeFor: FIXED_ATTRIBUTE
  });

  await openEncounterRound({ repository, encounterId: encounter.id });
  await submitAction({
    repository,
    encounterId: encounter.id,
    playerId: 'p2',
    payload: { techniqueId: 'veil_mark', tone: 'VEIL', stance: 'PULSE' }
  });
  await lockEncounterRound({ repository, encounterId: encounter.id });
  const { results } = await resolveEncounterRound({
    repository,
    encounterId: encounter.id,
    seasonSeed: 'season-seed-1',
    difficultyFor: () => 1,
    attributeFor: FIXED_ATTRIBUTE
  });

  assert.equal(results[0].combo?.id, 'ambush');
});

test('finalizeEncounter só aceita estados finais válidos', async t => {
  const { repository, encounter } = await fixture(t);
  await openEncounterRound({ repository, encounterId: encounter.id });
  await lockEncounterRound({ repository, encounterId: encounter.id });
  await resolveEncounterRound({
    repository,
    encounterId: encounter.id,
    seasonSeed: 'season-seed-1',
    difficultyFor: FIXED_DIFFICULTY,
    attributeFor: FIXED_ATTRIBUTE
  });

  await assert.rejects(
    finalizeEncounter({ repository, encounterId: encounter.id, finalState: 'NAO_EXISTE' }),
    NexoConflictError
  );

  const finalized = await finalizeEncounter({ repository, encounterId: encounter.id, finalState: 'VICTORY' });
  assert.equal(finalized.state, 'VICTORY');
});

test('cada rolagem é persistida em nexo_game_events (GameEvent), não só em memória', async t => {
  const { repository, store, encounter } = await fixture(t);
  await openEncounterRound({ repository, encounterId: encounter.id });
  await submitAction({ repository, encounterId: encounter.id, playerId: 'p1', payload: { techniqueId: 't1', stance: 'PULSE' } });
  await lockEncounterRound({ repository, encounterId: encounter.id });
  await resolveEncounterRound({
    repository,
    encounterId: encounter.id,
    seasonSeed: 'season-seed-1',
    difficultyFor: FIXED_DIFFICULTY,
    attributeFor: FIXED_ATTRIBUTE
  });

  const events = await store.read(session => session.all(
    "SELECT * FROM nexo_game_events WHERE aggregate_type = 'ENCOUNTER' AND event_type = 'ActionResolved'"
  ));
  assert.equal(events.length, 1);
  const payload = JSON.parse(events[0].payload_json);
  assert.equal(payload.playerId, 'p1');
  assert.ok(Number.isInteger(payload.dieRoll));
  assert.ok(payload.dieRoll >= 1 && payload.dieRoll <= 12);
  assert.ok(Number.isInteger(payload.margin));
  assert.ok(['SETBACK', 'TENSE', 'FULL', 'RUPTURE'].includes(payload.outcome));
});

test('resubmeter antes do lock (versão diferente) gera uma rolagem diferente da primeira, não a mesma seed', async t => {
  const { repository, encounter } = await fixture(t);
  await openEncounterRound({ repository, encounterId: encounter.id });
  await submitAction({ repository, encounterId: encounter.id, playerId: 'p1', payload: { techniqueId: 't1', stance: 'PULSE' } });
  await submitAction({ repository, encounterId: encounter.id, playerId: 'p1', payload: { techniqueId: 't2', stance: 'PULSE' } });

  const submissions = await repository.listActionSubmissions(encounter.id, 1);
  assert.equal(submissions.length, 1); // upsert -- ainda uma linha só
  assert.equal(submissions[0].version, 1); // mas a versão avançou

  await lockEncounterRound({ repository, encounterId: encounter.id });
  const { results } = await resolveEncounterRound({
    repository,
    encounterId: encounter.id,
    seasonSeed: 'season-seed-1',
    difficultyFor: FIXED_DIFFICULTY,
    attributeFor: FIXED_ATTRIBUTE
  });

  // a rolagem usada de fato precisa ter vindo do actionId da versão 1
  // (a submissão final, t2) -- não da versão 0 (a submissão original,
  // t1, substituída antes do lock). Provamos isso derivando as duas
  // seeds numéricas diretamente e confirmando que são diferentes, e que
  // a rolagem real bate com a derivada da versão 1.
  const { createSeededRng, deriveNumericSeed } = await import('../domain/rng.js');
  const seedVersion0 = deriveNumericSeed({
    seasonSeed: 'season-seed-1', encounterId: encounter.id, round: 1, actionId: `${submissions[0].id}:0`
  });
  const seedVersion1 = deriveNumericSeed({
    seasonSeed: 'season-seed-1', encounterId: encounter.id, round: 1, actionId: `${submissions[0].id}:1`
  });
  assert.notEqual(seedVersion0, seedVersion1, 'versões diferentes da mesma submissão precisam derivar seeds diferentes');

  const rngVersion1 = createSeededRng({
    seasonSeed: 'season-seed-1', encounterId: encounter.id, round: 1, actionId: `${submissions[0].id}:1`
  });
  assert.equal(rngVersion1.rollD12(), results[0].roll.dieRoll);
});

test('priorityFor decide a ordem de resolução; sem ele, o desempate é por id (nunca por created_at/chegada)', async t => {
  const { repository, encounter } = await fixture(t);
  await openEncounterRound({ repository, encounterId: encounter.id });
  // p2 age primeiro (chega primeiro), p1 depois -- se a ordem fosse por
  // chegada, p2 resolveria antes. Com priorityFor forçando p1 primeiro,
  // a ordem real de resolução deve ser p1 -> p2, não created_at.
  await submitAction({ repository, encounterId: encounter.id, playerId: 'p2', payload: { techniqueId: 't2', stance: 'PULSE' } });
  await submitAction({ repository, encounterId: encounter.id, playerId: 'p1', payload: { techniqueId: 't1', stance: 'PULSE' } });
  await lockEncounterRound({ repository, encounterId: encounter.id });

  const { results } = await resolveEncounterRound({
    repository,
    encounterId: encounter.id,
    seasonSeed: 'season-seed-1',
    difficultyFor: FIXED_DIFFICULTY,
    attributeFor: FIXED_ATTRIBUTE,
    priorityFor: submission => (submission.playerId === 'p1' ? 0 : 1)
  });

  assert.deepEqual(results.map(result => result.playerId), ['p1', 'p2']);
});
