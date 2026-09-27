import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createCommandContext,
  createIncomingMessage,
  createMessageViewModel
} from '../domain/messageContracts.js';
import { NexoValidationError } from '../errors.js';
import { NexoSqliteStore } from '../persistence/NexoSqliteStore.js';
import { NexoRepository } from '../persistence/NexoRepository.js';
import { IdentityService } from '../identity/IdentityService.js';
import { normalizeIncomingMessage } from '../transport/normalizeIncomingMessage.js';

test('cria um IncomingMessage mínimo válido', () => {
  const message = createIncomingMessage({
    messageId: 'wamid-1',
    chatId: 'grupo@g.us',
    groupId: 'grupo@g.us',
    sender: { canonicalId: 'user-uuid-1', addressingId: '123@lid' },
    text: 'entrar',
    timestamp: Date.now()
  });
  assert.equal(message.messageId, 'wamid-1');
  assert.equal(message.sender.canonicalId, 'user-uuid-1');
  assert.deepEqual(message.mentions, []);
  assert.equal(message.capabilities.text, true);
});

test('rejeita IncomingMessage sem messageId ou chatId', () => {
  assert.throws(() => createIncomingMessage({
    chatId: 'grupo@g.us',
    sender: { canonicalId: 'u1', addressingId: '123@lid' },
    timestamp: Date.now()
  }), NexoValidationError);

  assert.throws(() => createIncomingMessage({
    messageId: 'wamid-1',
    sender: { canonicalId: 'u1', addressingId: '123@lid' },
    timestamp: Date.now()
  }), NexoValidationError);
});

test('rejeita sender sem canonicalId (nunca aceitar JID cru como identidade)', () => {
  assert.throws(() => createIncomingMessage({
    messageId: 'wamid-1',
    chatId: 'grupo@g.us',
    sender: { addressingId: '123@lid' },
    timestamp: Date.now()
  }), NexoValidationError);
});

test('cria um CommandContext válido a partir de um IncomingMessage', () => {
  const incoming = createIncomingMessage({
    messageId: 'wamid-1',
    chatId: 'grupo@g.us',
    sender: { canonicalId: 'user-uuid-1', addressingId: '123@lid' },
    timestamp: Date.now()
  });
  const context = createCommandContext({
    correlationId: 'c-1',
    incoming,
    actor: { canonicalUserId: 'user-uuid-1' },
    idempotencyKey: 'wamid-1'
  });
  assert.equal(context.locale, 'pt-BR');
  assert.equal(context.actor.canonicalUserId, 'user-uuid-1');
});

test('MessageViewModel exige kind, privacy e priority válidos', () => {
  assert.throws(() => createMessageViewModel({
    kind: 'NAO_EXISTE',
    privacy: 'GROUP',
    priority: 'NORMAL'
  }), NexoValidationError);

  const viewModel = createMessageViewModel({
    kind: 'CARD',
    title: 'NEXO // Círculo Ativado',
    sections: [{ heading: 'Mundo', lines: ['Estação Zero'] }],
    actions: [{ id: '1', label: 'Entrar', command: '!entrar' }],
    privacy: 'GROUP',
    priority: 'STATE'
  });
  assert.equal(viewModel.kind, 'CARD');
  assert.equal(viewModel.sections[0].lines[0], 'Estação Zero');
});

test('normalizeIncomingMessage resolve identidade canônica e nunca vaza o JID como canonicalId', async t => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'shogun-nexo-transport-'));
  t.after(() => fs.rm(tempDirectory, { recursive: true, force: true }));
  const store = await NexoSqliteStore.open({ filename: path.join(tempDirectory, 'nexo.sqlite') });
  t.after(() => store.close());
  const repository = new NexoRepository(store);
  const identityService = new IdentityService(repository);

  const message = await normalizeIncomingMessage({
    identityService,
    raw: {
      messageId: 'wamid-42',
      chatId: 'grupo@g.us',
      groupId: 'grupo@g.us',
      senderLid: '123456789012345@lid',
      senderJid: '5511999999999@s.whatsapp.net',
      pushName: 'Lume',
      text: '!entrar',
      mentionedJids: [],
      timestamp: Date.now()
    }
  });

  assert.notEqual(message.sender.canonicalId, '123456789012345@lid');
  assert.notEqual(message.sender.canonicalId, '5511999999999@s.whatsapp.net');
  assert.equal(message.sender.displayName, 'Lume');
  assert.equal(message.sender.addressingId, '123456789012345@lid');

  const secondMessage = await normalizeIncomingMessage({
    identityService,
    raw: {
      messageId: 'wamid-43',
      chatId: 'grupo@g.us',
      senderLid: '123456789012345@lid',
      senderJid: '5511999999999@s.whatsapp.net',
      timestamp: Date.now()
    }
  });
  assert.equal(secondMessage.sender.canonicalId, message.sender.canonicalId);
});
