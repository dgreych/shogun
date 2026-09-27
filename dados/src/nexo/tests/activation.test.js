import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { NexoSqliteStore } from '../persistence/NexoSqliteStore.js';
import { NexoRepository } from '../persistence/NexoRepository.js';
import {
  confirmActivation,
  deactivateGroup,
  getStatus,
  previewActivation
} from '../domain/activation.js';
import { NexoConflictError, NexoValidationError } from '../errors.js';

async function fixture(t) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'shogun-nexo-activation-'));
  t.after(() => fs.rm(tempDirectory, { recursive: true, force: true }));
  const store = await NexoSqliteStore.open({ filename: path.join(tempDirectory, 'nexo.sqlite') });
  t.after(() => store.close());
  const repository = new NexoRepository(store);
  return repository;
}

function makeContext({ userId = 'user-1', chatId = 'grupo@g.us', isGroupAdmin = true, messageId = 'wamid-1' } = {}) {
  return {
    incoming: { chatId, groupId: chatId, messageId },
    actor: { canonicalUserId: userId, isGroupAdmin }
  };
}

test('não-admin não consegue ativar o Círculo', async t => {
  const repository = await fixture(t);
  await assert.rejects(
    previewActivation({ repository, context: makeContext({ isGroupAdmin: false }), mode: 'casual' }),
    NexoValidationError
  );
});

test('modo inválido é rejeitado antes de criar qualquer estado', async t => {
  const repository = await fixture(t);
  await assert.rejects(
    previewActivation({ repository, context: makeContext(), mode: 'modo-que-nao-existe' }),
    NexoValidationError
  );
  const group = await repository.getGroupByTransportChatId('grupo@g.us');
  assert.equal(group, null);
});

test('fluxo completo ativar -> confirmar deixa o grupo e a temporada ACTIVE', async t => {
  const repository = await fixture(t);
  const context = makeContext();

  const preview = await previewActivation({ repository, context, mode: 'casual' });
  assert.equal(preview.kind, 'CONFIRMATION');
  const tokenLine = preview.sections
    .flatMap(section => section.lines)
    .find(line => line.includes('confirmar'));
  const token = tokenLine.match(/confirmar (\w+)/)[1];

  const confirmation = await confirmActivation({
    repository,
    context: makeContext({ messageId: 'wamid-2' }),
    token
  });
  assert.equal(confirmation.kind, 'CARD');

  const group = await repository.getGroupByTransportChatId('grupo@g.us');
  assert.equal(group.status, 'ACTIVE');
  const season = await repository.getActiveSeasonForGroup(group.id);
  assert.ok(season);
  assert.equal(season.status, 'ACTIVE');
});

test('token errado não ativa nada', async t => {
  const repository = await fixture(t);
  const context = makeContext();
  await previewActivation({ repository, context, mode: 'casual' });

  await assert.rejects(
    confirmActivation({ repository, context: makeContext({ messageId: 'wamid-2' }), token: 'ERRADO' }),
    NexoValidationError
  );

  const group = await repository.getGroupByTransportChatId('grupo@g.us');
  assert.equal(group.status, 'INACTIVE');
});

test('reprocessar a mesma confirmação (mesmo messageId) não ativa duas vezes', async t => {
  const repository = await fixture(t);
  const context = makeContext();
  const preview = await previewActivation({ repository, context, mode: 'casual' });
  const token = preview.sections
    .flatMap(section => section.lines)
    .find(line => line.includes('confirmar'))
    .match(/confirmar (\w+)/)[1];

  const confirmContext = makeContext({ messageId: 'wamid-2' });
  await confirmActivation({ repository, context: confirmContext, token });
  await confirmActivation({ repository, context: confirmContext, token });

  const group = await repository.getGroupByTransportChatId('grupo@g.us');
  const seasons = await repository.getActiveSeasonForGroup(group.id);
  assert.equal(group.status, 'ACTIVE');
  assert.ok(seasons);
});

test('ativar de novo um grupo já ativo é rejeitado', async t => {
  const repository = await fixture(t);
  const context = makeContext();
  const preview = await previewActivation({ repository, context, mode: 'casual' });
  const token = preview.sections
    .flatMap(section => section.lines)
    .find(line => line.includes('confirmar'))
    .match(/confirmar (\w+)/)[1];
  await confirmActivation({ repository, context: makeContext({ messageId: 'wamid-2' }), token });

  await assert.rejects(
    previewActivation({ repository, context: makeContext({ messageId: 'wamid-3' }), mode: 'casual' }),
    NexoConflictError
  );
});

test('status reflete corretamente grupo nunca ativado, ativo e pausado', async t => {
  const repository = await fixture(t);
  const context = makeContext();

  const beforeActivation = await getStatus({ repository, context });
  assert.match(beforeActivation.sections[0].lines[0], /não está ativo/);

  const preview = await previewActivation({ repository, context, mode: 'casual' });
  const token = preview.sections
    .flatMap(section => section.lines)
    .find(line => line.includes('confirmar'))
    .match(/confirmar (\w+)/)[1];
  await confirmActivation({ repository, context: makeContext({ messageId: 'wamid-2' }), token });

  const afterActivation = await getStatus({ repository, context });
  assert.match(afterActivation.sections[0].lines[0], /ACTIVE/);

  await deactivateGroup({ repository, context: makeContext({ messageId: 'wamid-3' }) });
  const afterDeactivation = await getStatus({ repository, context });
  assert.match(afterDeactivation.sections[0].lines[0], /não está ativo/);

  const group = await repository.getGroupByTransportChatId('grupo@g.us');
  assert.equal(group.status, 'PAUSED');
});

test('desativar sem estar ativo é rejeitado, sem apagar nada', async t => {
  const repository = await fixture(t);
  await assert.rejects(
    deactivateGroup({ repository, context: makeContext() }),
    NexoValidationError
  );
});
