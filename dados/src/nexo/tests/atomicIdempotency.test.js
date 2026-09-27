import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { NexoSqliteStore } from '../persistence/NexoSqliteStore.js';
import { NexoRepository } from '../persistence/NexoRepository.js';
import { NexoNotFoundError } from '../errors.js';

// Achado de revisão real (GPT-NEXO-004, severidade CRÍTICA): antes desta
// correção, `appendGameEventIfNew` (marca a mensagem como processada) e a
// mutação de estado real (ativar temporada, criar personagem, pausar
// grupo) aconteciam em DUAS transações separadas. Uma falha entre as duas
// deixava a mensagem marcada como processada sem a mutação ter
// acontecido -- e como a idempotência olha só processed_messages, um
// retry legítimo era descartado como "duplicado" para sempre, travando o
// sistema. Estes testes provam que agora é uma ÚNICA transação: se a
// mutação falha, o marcador de idempotência TAMBÉM é desfeito (rollback
// completo), então um retry seguinte tenta de novo em vez de ficar preso.

async function fixture(t) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'shogun-nexo-atomic-'));
  t.after(() => fs.rm(tempDirectory, { recursive: true, force: true }));
  const store = await NexoSqliteStore.open({ filename: path.join(tempDirectory, 'nexo.sqlite') });
  t.after(() => store.close());
  const repository = new NexoRepository(store);
  return { repository, store };
}

async function wasMessageProcessed(store, messageId) {
  const row = await store.read(session => session.get(
    'SELECT message_id FROM nexo_processed_messages WHERE message_id = ?',
    [messageId]
  ));
  return Boolean(row);
}

test('confirmGroupActivationAtomic: se a ativação falha, o marcador de idempotência TAMBÉM é desfeito', async t => {
  const { repository, store } = await fixture(t);
  const group = await repository.upsertGroup({ transportChatId: 'grupo@g.us' });

  // seasonId inexistente força activateSeasonInSession a lançar
  // NexoNotFoundError DEPOIS que a idempotência já teria sido gravada,
  // na mesma transação -- é exatamente o cenário que expunha o bug.
  await assert.rejects(
    repository.confirmGroupActivationAtomic({
      messageId: 'wamid-fail-1',
      seasonId: 'season-que-nao-existe',
      aggregateId: group.id,
      payload: {}
    }),
    NexoNotFoundError
  );

  assert.equal(await wasMessageProcessed(store, 'wamid-fail-1'), false);

  // retry com a mesma messageId, agora com a temporada de verdade, tem
  // que funcionar -- não pode estar "presa" como duplicada.
  const season = await repository.createDraftSeason({ groupId: group.id, seed: 's1' });
  const result = await repository.confirmGroupActivationAtomic({
    messageId: 'wamid-fail-1',
    seasonId: season.id,
    aggregateId: group.id,
    payload: {}
  });
  assert.equal(result.duplicate, false);
  assert.equal(result.season.status, 'ACTIVE');
});

test('confirmGroupActivationAtomic: reprocessar a mesma messageId não ativa duas vezes', async t => {
  const { repository } = await fixture(t);
  const group = await repository.upsertGroup({ transportChatId: 'grupo@g.us' });
  const season = await repository.createDraftSeason({ groupId: group.id, seed: 's1' });

  const first = await repository.confirmGroupActivationAtomic({
    messageId: 'wamid-1', seasonId: season.id, aggregateId: group.id, payload: {}
  });
  assert.equal(first.duplicate, false);

  const second = await repository.confirmGroupActivationAtomic({
    messageId: 'wamid-1', seasonId: season.id, aggregateId: group.id, payload: {}
  });
  assert.equal(second.duplicate, true);
});

test('deactivateGroupAtomic: reprocessar a mesma messageId não pausa duas vezes', async t => {
  const { repository } = await fixture(t);
  const group = await repository.upsertGroup({ transportChatId: 'grupo-real@g.us' });
  await repository.setGroupStatus(group.id, 'ACTIVE');

  const first = await repository.deactivateGroupAtomic({
    messageId: 'wamid-3', groupId: group.id, aggregateId: group.id, payload: {}
  });
  assert.equal(first.duplicate, false);
  assert.equal(first.group.status, 'PAUSED');

  const second = await repository.deactivateGroupAtomic({
    messageId: 'wamid-3', groupId: group.id, aggregateId: group.id, payload: {}
  });
  assert.equal(second.duplicate, true);
});

test('completeOnboardingAtomic: reprocessar a mesma messageId não cria dois personagens nem reapaga a interação', async t => {
  const { repository } = await fixture(t);
  const group = await repository.upsertGroup({ transportChatId: 'grupo@g.us' });
  const player = await repository.getOrCreatePlayer({ userId: 'user-1', groupId: group.id });
  const pending = await repository.createPendingInteraction({
    userId: 'user-1',
    chatId: 'grupo@g.us',
    type: 'ONBOARDING',
    ttlMs: 10 * 60 * 1000
  });

  const first = await repository.completeOnboardingAtomic({
    messageId: 'wamid-4',
    playerId: player.id,
    impulse: 'break_impossible',
    scar: 'haste',
    pendingInteractionId: pending.id,
    aggregateId: player.id,
    payload: {}
  });
  assert.equal(first.duplicate, false);
  assert.ok(first.character);

  const gone = await repository.getPendingInteraction(pending.id);
  assert.equal(gone, null);

  // reprocessar a MESMA messageId (retry de rede, por exemplo) precisa
  // ser tratado como duplicado, não criar um segundo personagem nem
  // tentar apagar de novo uma interação que já não existe.
  const second = await repository.completeOnboardingAtomic({
    messageId: 'wamid-4',
    playerId: player.id,
    impulse: 'break_impossible',
    scar: 'haste',
    pendingInteractionId: pending.id,
    aggregateId: player.id,
    payload: {}
  });
  assert.equal(second.duplicate, true);

  const character = await repository.getCharacterByPlayerId(player.id);
  assert.equal(character.impulse, 'break_impossible');
});

// Nota: os três métodos atômicos (confirmGroupActivationAtomic,
// deactivateGroupAtomic, completeOnboardingAtomic) usam a MESMA função de
// sessão (recordIdempotentEventInSession) dentro do MESMO wrapper
// (this.store.transaction) -- não lógica duplicada por método. O teste de
// falha real em confirmGroupActivationAtomic, acima, prova que uma
// exceção lançada DEPOIS da idempotência já ter sido escrita na mesma
// transação desfaz tudo (idempotência incluída); essa garantia vem do
// mecanismo compartilhado, então vale igualmente para os outros dois.
