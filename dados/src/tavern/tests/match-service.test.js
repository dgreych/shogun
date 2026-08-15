import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { MatchService } from '../MatchService.js';
import { SqliteStore } from '../persistence/SqliteStore.js';
import { TavernRepository } from '../persistence/TavernRepository.js';
import { createMatch, createTestEngine } from './testHelpers.js';

async function createFixture(t) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'gyomei-tavern-match-'));
  t.after(() => fs.rm(tempDirectory, { recursive: true, force: true }));
  const databasePath = path.join(tempDirectory, 'tavern.sqlite');
  const testEngine = await createTestEngine();
  const store = await SqliteStore.open({ filename: databasePath });
  const repository = new TavernRepository(store);
  await repository.seedCards(testEngine.cardRegistry.list());
  const matches = new MatchService({ engine: testEngine.engine, repository });
  const state = createMatch(testEngine.engine);
  await repository.createMatch(state);
  return { ...testEngine, databasePath, store, repository, matches, state };
}

test('messageId repetido não executa a ação duas vezes', async t => {
  const fixture = await createFixture(t);
  const actorId = fixture.state.turn.activePlayerId;

  const first = await fixture.matches.dispatch(
    fixture.state.matchId,
    { type: 'END_TURN', actorId },
    { messageId: 'wamid-1' }
  );
  const duplicate = await fixture.matches.dispatch(
    fixture.state.matchId,
    { type: 'END_TURN', actorId },
    { messageId: 'wamid-1' }
  );

  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.state.version, 1);
  assert.equal((await fixture.repository.listMatchEvents(fixture.state.matchId)).length, 2);
  await fixture.store.close();
});

test('duas ações concorrentes são serializadas sem sobrescrever estado', async t => {
  const fixture = await createFixture(t);
  const actorId = fixture.state.turn.activePlayerId;
  const results = await Promise.allSettled([
    fixture.matches.dispatch(fixture.state.matchId, { type: 'END_TURN', actorId }, { messageId: 'wamid-a' }),
    fixture.matches.dispatch(fixture.state.matchId, { type: 'END_TURN', actorId }, { messageId: 'wamid-b' })
  ]);

  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal((await fixture.repository.getMatch(fixture.state.matchId)).version, 1);
  await fixture.store.close();
});

test('partida é reidratada do mesmo ponto após fechar e reabrir o banco', async t => {
  const fixture = await createFixture(t);
  const actorId = fixture.state.turn.activePlayerId;
  await fixture.matches.dispatch(
    fixture.state.matchId,
    { type: 'END_TURN', actorId },
    { messageId: 'wamid-restart' }
  );
  await fixture.store.close();

  const reopenedStore = await SqliteStore.open({ filename: fixture.databasePath });
  const reopenedRepository = new TavernRepository(reopenedStore);
  const restored = await reopenedRepository.getMatch(fixture.state.matchId);
  assert.equal(restored.version, 1);
  assert.equal(restored.state.turn.activePlayerId, 'two@s.whatsapp.net');
  assert.equal(restored.state.turn.number, 2);
  await reopenedStore.close();
});

test('dois timeouts consecutivos do mesmo jogador causam derrota por ausência', async t => {
  const fixture = await createFixture(t);
  const firstAbsent = fixture.state.turn.activePlayerId;
  fixture.setNow(Date.parse(fixture.state.turn.deadlineAt) + 1);
  const firstTimeout = await fixture.matches.dispatch(
    fixture.state.matchId,
    { type: 'TIMEOUT' },
    { messageId: 'timeout-1' }
  );
  const otherPlayer = firstTimeout.state.turn.activePlayerId;
  fixture.setNow(Date.parse(firstTimeout.state.turn.deadlineAt) + 1);
  const otherTurn = await fixture.matches.dispatch(
    fixture.state.matchId,
    { type: 'END_TURN', actorId: otherPlayer },
    { messageId: 'other-ended' }
  );
  fixture.setNow(Date.parse(otherTurn.state.turn.deadlineAt) + 1);
  const secondTimeout = await fixture.matches.dispatch(
    fixture.state.matchId,
    { type: 'TIMEOUT' },
    { messageId: 'timeout-2' }
  );

  assert.equal(secondTimeout.state.status, 'FINISHED');
  assert.equal(secondTimeout.state.finishReason, 'ABSENCE');
  assert.notEqual(secondTimeout.state.winnerId, firstAbsent);
  await fixture.store.close();
});

test('vinte partidas simultâneas avançam sem conflito entre estados', async t => {
  const fixture = await createFixture(t);
  const inputs = Array.from({ length: 20 }, (_, index) => ({
    matchId: `stress-match-${index}`,
    groupId: 'stress-group@g.us',
    seed: `stress-seed-${index}`,
    startingPlayerId: 'one@s.whatsapp.net',
    mode: 'NORMAL',
    players: [
      { id: 'one@s.whatsapp.net', classId: 'GUARDIAN', deck: ['GY-001', 'GY-014', 'GY-027', 'GY-103'] },
      { id: 'two@s.whatsapp.net', classId: 'PROFANE', deck: ['GY-001', 'GY-014', 'GY-027', 'GY-103'] }
    ]
  }));

  await Promise.all(inputs.map(input => fixture.matches.createMatch(input)));
  const transitions = await Promise.all(inputs.map(input => fixture.matches.dispatch(
    input.matchId,
    { type: 'END_TURN', actorId: 'one@s.whatsapp.net' },
    { messageId: `stress-message-${input.matchId}` }
  )));

  assert.equal(transitions.length, 20);
  assert.ok(transitions.every(result => result.state.version === 1));
  assert.ok(transitions.every(result => result.state.turn.activePlayerId === 'two@s.whatsapp.net'));
  await fixture.store.close();
});
