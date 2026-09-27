import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NEXO_DATABASE_PATH = ':memory:';

const { handleNexoCommand, shouldHandleNexoCommand } = await import('../runtime.js');

function createFakeSocket() {
  const sent = [];
  return {
    sent,
    sendMessage: async (chatId, content) => {
      sent.push({ chatId, content });
      return { key: { id: `sent-${sent.length}` } };
    }
  };
}

test('shouldHandleNexoCommand reconhece somente o namespace nexo', () => {
  assert.equal(shouldHandleNexoCommand('nexo'), true);
  assert.equal(shouldHandleNexoCommand('menu'), false);
  assert.equal(shouldHandleNexoCommand('entrar'), false);
});

test('handleNexoCommand: admin ativa e confirma, resposta final chega no grupo', async () => {
  const socket = createFakeSocket();
  const rawBase = {
    chatId: 'grupo-runtime@g.us',
    groupId: 'grupo-runtime@g.us',
    senderLid: '999000111@lid',
    senderJid: '5511999990000@s.whatsapp.net',
    pushName: 'Admin',
    timestamp: Date.now()
  };

  const preview = await handleNexoCommand({
    socket,
    raw: { ...rawBase, messageId: 'wamid-runtime-1' },
    args: ['ativar', 'casual'],
    isGroupAdmin: true
  });
  assert.equal(preview.kind, 'CONFIRMATION');
  assert.equal(socket.sent.length, 1);
  assert.match(socket.sent[0].content.text, /Ativar Círculo/);

  const token = socket.sent[0].content.text.match(/confirmar (\w+)/)[1];

  const confirmed = await handleNexoCommand({
    socket,
    raw: { ...rawBase, messageId: 'wamid-runtime-2' },
    args: ['confirmar', token],
    isGroupAdmin: true
  });
  assert.equal(confirmed.kind, 'CARD');
  assert.equal(socket.sent.length, 2);
  assert.match(socket.sent[1].content.text, /CÍRCULO ATIVADO/);
});

test('handleNexoCommand: quem não é admin recebe recusa, não ativa nada', async () => {
  const socket = createFakeSocket();
  const result = await handleNexoCommand({
    socket,
    raw: {
      chatId: 'grupo-runtime-2@g.us',
      groupId: 'grupo-runtime-2@g.us',
      senderLid: '222333444@lid',
      pushName: 'Membro',
      timestamp: Date.now(),
      messageId: 'wamid-runtime-3'
    },
    args: ['ativar'],
    isGroupAdmin: false
  });
  assert.equal(result.kind, 'ERROR');
  assert.match(socket.sent[0].content.text, /admin ou moderador/);
});

test('handleNexoCommand: nexo status sem ativação prévia responde sem erro', async () => {
  const socket = createFakeSocket();
  const result = await handleNexoCommand({
    socket,
    raw: {
      chatId: 'grupo-runtime-3@g.us',
      groupId: 'grupo-runtime-3@g.us',
      senderLid: '555666777@lid',
      timestamp: Date.now(),
      messageId: 'wamid-runtime-4'
    },
    args: ['status'],
    isGroupAdmin: false
  });
  assert.equal(result.kind, 'CARD');
  assert.match(socket.sent[0].content.text, /não está ativo/);
});
