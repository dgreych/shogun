import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NEXO_DATABASE_PATH = ':memory:';

const { handleNexoCommand, handleNexoPlayerCommand, shouldHandleNexoPlayerCommand } = await import('../runtime.js');

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

async function activateGroup(socket, chatId) {
  await handleNexoCommand({
    socket,
    raw: { chatId, groupId: chatId, senderLid: '900000003@lid', pushName: 'Admin', timestamp: Date.now(), messageId: `${chatId}-activate-1` },
    args: ['ativar', 'casual'],
    isGroupAdmin: true
  });
  const token = socket.sent.at(-1).content.text.match(/confirmar (\w+)/)[1];
  await handleNexoCommand({
    socket,
    raw: { chatId, groupId: chatId, senderLid: '900000003@lid', pushName: 'Admin', timestamp: Date.now(), messageId: `${chatId}-activate-2` },
    args: ['confirmar', token],
    isGroupAdmin: true
  });
}

test('shouldHandleNexoPlayerCommand reconhece !combate', () => {
  assert.equal(shouldHandleNexoPlayerCommand('combate'), true);
});

test('!combate sem argumentos explica o uso, sem lançar', async () => {
  const chatId = 'grupo-combate-uso@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);
  const raw = { chatId, groupId: chatId, senderLid: '988888888@lid', pushName: 'Rio', timestamp: Date.now() };
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m1` }, command: 'entrar', args: [] });
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m2` }, command: '1', args: [] });
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m3` }, command: '1', args: [] });

  const result = await handleNexoPlayerCommand({
    socket, raw: { ...raw, messageId: `${chatId}-combate` }, command: 'combate', args: []
  });
  assert.equal(result.kind, 'ERROR');
  assert.match(socket.sent.at(-1).content.text, /Uso do combate/);
});

test('!combate real via runtime ataca um inimigo publicado e mostra o resultado', async () => {
  const chatId = 'grupo-combate-real@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);
  const raw = { chatId, groupId: chatId, senderLid: '999888777@lid', pushName: 'Vale', timestamp: Date.now() };
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m1` }, command: 'entrar', args: [] });
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m2` }, command: '1', args: [] });
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m3` }, command: '1', args: [] });

  const result = await handleNexoPlayerCommand({
    socket,
    raw: { ...raw, messageId: `${chatId}-combate1` },
    command: 'combate',
    args: ['cao_de_rasura', 'solar_strike', 'pulso']
  });
  assert.equal(result.kind, 'CARD');
  assert.match(socket.sent.at(-1).content.text, /Cão de Rasura/);
});

test('!combate com técnica inexistente vira erro claro, não exceção', async () => {
  const chatId = 'grupo-combate-tecnica-invalida@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);
  const raw = { chatId, groupId: chatId, senderLid: '977766655@lid', pushName: 'Bru', timestamp: Date.now() };
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m1` }, command: 'entrar', args: [] });
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m2` }, command: '1', args: [] });
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m3` }, command: '1', args: [] });

  const result = await handleNexoPlayerCommand({
    socket,
    raw: { ...raw, messageId: `${chatId}-combate1` },
    command: 'combate',
    args: ['cao_de_rasura', 'tecnica_inexistente']
  });
  assert.equal(result.kind, 'ERROR');
});
