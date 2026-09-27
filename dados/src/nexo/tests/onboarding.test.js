import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { NexoSqliteStore } from '../persistence/NexoSqliteStore.js';
import { NexoRepository } from '../persistence/NexoRepository.js';
import { answerOnboardingStep, cancelOnboarding, startOnboarding } from '../domain/onboarding.js';
import { NexoValidationError } from '../errors.js';

// Provider de teste DELIBERADAMENTE genérico -- nunca os Impulsos/
// Cicatrizes reais do PDF (isso é conteúdo do GPT, área reservada). Este
// arquivo só prova que a MÁQUINA funciona, não que o conteúdo está certo.
function fakeContentProvider() {
  return {
    listImpulses: () => [
      { id: 'impulse_a', label: 'Opção A' },
      { id: 'impulse_b', label: 'Opção B' }
    ],
    listScars: () => [
      { id: 'scar_x', label: 'Cicatriz X' },
      { id: 'scar_y', label: 'Cicatriz Y' }
    ],
    listOrigins: () => [
      { id: 'origin_p', label: 'Origem P' },
      { id: 'origin_q', label: 'Origem Q' }
    ]
  };
}

async function fixture(t) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'shogun-nexo-onboarding-'));
  t.after(() => fs.rm(tempDirectory, { recursive: true, force: true }));
  const store = await NexoSqliteStore.open({ filename: path.join(tempDirectory, 'nexo.sqlite') });
  t.after(() => store.close());
  const repository = new NexoRepository(store);
  await repository.upsertGroup({ transportChatId: 'grupo@g.us', name: 'Estação Zero' });
  const group = await repository.getGroupByTransportChatId('grupo@g.us');
  await repository.setGroupStatus(group.id, 'ACTIVE');
  return repository;
}

function makeContext({ userId = 'user-1', chatId = 'grupo@g.us', messageId = 'wamid-1' } = {}) {
  return {
    incoming: { chatId, groupId: chatId, messageId },
    actor: { canonicalUserId: userId }
  };
}

test('grupo sem NEXO ativo rejeita !entrar', async t => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'shogun-nexo-onboarding-inactive-'));
  t.after(() => fs.rm(tempDirectory, { recursive: true, force: true }));
  const store = await NexoSqliteStore.open({ filename: path.join(tempDirectory, 'nexo.sqlite') });
  t.after(() => store.close());
  const repository = new NexoRepository(store);

  await assert.rejects(
    startOnboarding({ repository, context: makeContext(), contentProvider: fakeContentProvider() }),
    NexoValidationError
  );
});

test('modo inválido é rejeitado', async t => {
  const repository = await fixture(t);
  await assert.rejects(
    startOnboarding({
      repository,
      context: makeContext(),
      mode: 'nao-existe',
      contentProvider: fakeContentProvider()
    }),
    NexoValidationError
  );
});

test('fluxo completo entrar -> impulso -> cicatriz cria personagem em 3 mensagens', async t => {
  const repository = await fixture(t);
  const contentProvider = fakeContentProvider();

  const first = await startOnboarding({
    repository,
    context: makeContext({ messageId: 'wamid-1' }),
    mode: 'rapido',
    contentProvider
  });
  assert.equal(first.kind, 'LIST');
  assert.match(first.sections[0].lines[0], /Opção A/);

  const second = await answerOnboardingStep({
    repository,
    context: makeContext({ messageId: 'wamid-2' }),
    contentProvider,
    optionIndex: 1
  });
  assert.equal(second.kind, 'LIST');
  assert.match(second.sections[0].lines[0], /Cicatriz X/);

  const third = await answerOnboardingStep({
    repository,
    context: makeContext({ messageId: 'wamid-3' }),
    contentProvider,
    optionIndex: 2
  });
  assert.equal(third.kind, 'CARD');

  const group = await repository.getGroupByTransportChatId('grupo@g.us');
  const player = await repository.getOrCreatePlayer({ userId: 'user-1', groupId: group.id });
  const character = await repository.getCharacterByPlayerId(player.id);
  assert.equal(character.impulse, 'impulse_a');
  assert.equal(character.scar, 'scar_y');
});

test('reprocessar a última resposta (mesmo messageId) não cria dois personagens', async t => {
  const repository = await fixture(t);
  const contentProvider = fakeContentProvider();

  await startOnboarding({ repository, context: makeContext({ messageId: 'wamid-1' }), contentProvider });
  await answerOnboardingStep({
    repository,
    context: makeContext({ messageId: 'wamid-2' }),
    contentProvider,
    optionIndex: 1
  });

  const finalContext = makeContext({ messageId: 'wamid-3' });
  await answerOnboardingStep({ repository, context: finalContext, contentProvider, optionIndex: 1 });
  // reprocessar a mesma mensagem final -- não deve lançar nem duplicar
  await assert.rejects(
    answerOnboardingStep({ repository, context: finalContext, contentProvider, optionIndex: 1 }),
    NexoValidationError
  );

  const group = await repository.getGroupByTransportChatId('grupo@g.us');
  const player = await repository.getOrCreatePlayer({ userId: 'user-1', groupId: group.id });
  const character = await repository.getCharacterByPlayerId(player.id);
  assert.ok(character);
});

test('jogador que já tem personagem não pode entrar de novo', async t => {
  const repository = await fixture(t);
  const contentProvider = fakeContentProvider();

  await startOnboarding({ repository, context: makeContext({ messageId: 'wamid-1' }), contentProvider });
  await answerOnboardingStep({
    repository,
    context: makeContext({ messageId: 'wamid-2' }),
    contentProvider,
    optionIndex: 1
  });
  await answerOnboardingStep({
    repository,
    context: makeContext({ messageId: 'wamid-3' }),
    contentProvider,
    optionIndex: 1
  });

  await assert.rejects(
    startOnboarding({ repository, context: makeContext({ messageId: 'wamid-4' }), contentProvider }),
    NexoValidationError
  );
});

test('!cancelar encerra o onboarding sem criar personagem', async t => {
  const repository = await fixture(t);
  const contentProvider = fakeContentProvider();
  const context = makeContext({ messageId: 'wamid-1' });

  await startOnboarding({ repository, context, contentProvider });
  const cancelled = await cancelOnboarding({ repository, context: makeContext({ messageId: 'wamid-2' }) });
  assert.equal(cancelled.kind, 'CONFIRMATION');

  const group = await repository.getGroupByTransportChatId('grupo@g.us');
  const player = await repository.getOrCreatePlayer({ userId: 'user-1', groupId: group.id });
  const character = await repository.getCharacterByPlayerId(player.id);
  assert.equal(character, null);

  // depois de cancelado, !entrar de novo abre uma sessão nova (não fica preso)
  const restarted = await startOnboarding({
    repository,
    context: makeContext({ messageId: 'wamid-3' }),
    contentProvider
  });
  assert.equal(restarted.kind, 'LIST');
});

test('escolha fora do intervalo é rejeitada sem avançar o estado', async t => {
  const repository = await fixture(t);
  const contentProvider = fakeContentProvider();
  await startOnboarding({ repository, context: makeContext({ messageId: 'wamid-1' }), contentProvider });

  await assert.rejects(
    answerOnboardingStep({
      repository,
      context: makeContext({ messageId: 'wamid-2' }),
      contentProvider,
      optionIndex: 99
    }),
    NexoValidationError
  );

  // a interação pendente continua em AWAITING_IMPULSE, resposta válida ainda funciona
  const second = await answerOnboardingStep({
    repository,
    context: makeContext({ messageId: 'wamid-3' }),
    contentProvider,
    optionIndex: 1
  });
  assert.equal(second.kind, 'LIST');
  assert.match(second.sections[0].lines[0], /Cicatriz/);
});
