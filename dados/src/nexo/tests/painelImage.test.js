import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NEXO_DATABASE_PATH = ':memory:';

const { handleNexoCommand, handleNexoPlayerCommand } = await import('../runtime.js');

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

function createSocketThatRejectsImages() {
  const sent = [];
  return {
    sent,
    sendMessage: async (chatId, content) => {
      if (content.image) throw new Error('WhatsApp recusou o envio de mídia');
      sent.push({ chatId, content });
      return { key: { id: `sent-${sent.length}` } };
    }
  };
}

async function activateGroup(socket, chatId) {
  await handleNexoCommand({
    socket,
    raw: {
      chatId, groupId: chatId, senderLid: '900000002@lid', pushName: 'Admin',
      timestamp: Date.now(), messageId: `${chatId}-activate-1`
    },
    args: ['ativar', 'casual'],
    isGroupAdmin: true
  });
  const token = socket.sent.at(-1).content.text.match(/confirmar (\w+)/)[1];
  await handleNexoCommand({
    socket,
    raw: {
      chatId, groupId: chatId, senderLid: '900000002@lid', pushName: 'Admin',
      timestamp: Date.now(), messageId: `${chatId}-activate-2`
    },
    args: ['confirmar', token],
    isGroupAdmin: true
  });
}

const BUNNYFY_ENV = { BUNNYFY_ENABLED: 'true', BUNNYFY_NEXO_RENDER_MODE: 'exclusive' };

test('painel anexa a imagem do círculo quando a BunnyFy responde', async () => {
  const chatId = 'grupo-painel-img@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);

  await handleNexoPlayerCommand({
    socket,
    raw: { chatId, groupId: chatId, senderLid: '944444444@lid', timestamp: Date.now(), messageId: `${chatId}-painel` },
    command: 'painel',
    args: [],
    bunnyfyEnv: BUNNYFY_ENV,
    bunnyfyClientFactory: () => ({
      async renderNexoCircle() {
        return { width: 1200, height: 675, media: { mediaId: 'painel-abcdefghij' } };
      },
      async downloadMedia() {
        return { buffer: Buffer.from('png-painel'), mime: 'image/png' };
      }
    })
  });

  const sent = socket.sent.at(-1).content;
  assert.equal(sent.image.toString(), 'png-painel');
  assert.match(sent.caption, /Painel do Círculo/);
  assert.equal(sent.text, undefined);
});

test('painel cai no texto puro quando o RENDER funciona mas o envio da mídia falha (achado GPT-NEXO-007, severidade ALTA)', async () => {
  const chatId = 'grupo-painel-envio-falha@g.us';
  const socket = createSocketThatRejectsImages();
  await activateGroup(socket, chatId);

  await handleNexoPlayerCommand({
    socket,
    raw: { chatId, groupId: chatId, senderLid: '911122233@lid', timestamp: Date.now(), messageId: `${chatId}-painel` },
    command: 'painel',
    args: [],
    bunnyfyEnv: BUNNYFY_ENV,
    bunnyfyClientFactory: () => ({
      async renderNexoCircle() {
        return { width: 1200, height: 675, media: { mediaId: 'painel-abcdefghij' } };
      },
      async downloadMedia() {
        return { buffer: Buffer.from('png-painel-valido'), mime: 'image/png' };
      }
    })
  });

  const sent = socket.sent.at(-1).content;
  assert.equal(sent.image, undefined);
  assert.match(sent.text, /Painel do Círculo/);
});

test('painel cai no texto puro quando a BunnyFy falha, sem quebrar a resposta', async () => {
  const chatId = 'grupo-painel-fallback@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);

  await handleNexoPlayerCommand({
    socket,
    raw: { chatId, groupId: chatId, senderLid: '955555555@lid', timestamp: Date.now(), messageId: `${chatId}-painel` },
    command: 'painel',
    args: [],
    bunnyfyEnv: BUNNYFY_ENV,
    bunnyfyClientFactory: () => ({
      async renderNexoCircle() { throw new Error('rede fora'); }
    })
  });

  const sent = socket.sent.at(-1).content;
  assert.equal(sent.image, undefined);
  assert.match(sent.text, /Painel do Círculo/);
});

test('ficha sem personagem não tenta imagem, mesmo com a BunnyFy configurada', async () => {
  const chatId = 'grupo-ficha-sem-imagem@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);
  let renderCalls = 0;

  await handleNexoPlayerCommand({
    socket,
    raw: { chatId, groupId: chatId, senderLid: '966666666@lid', timestamp: Date.now(), messageId: `${chatId}-ficha` },
    command: 'ficha',
    args: [],
    bunnyfyEnv: BUNNYFY_ENV,
    bunnyfyClientFactory: () => ({
      async renderNexoCharacter() { renderCalls += 1; return { media: {} }; },
      async renderNexoCircle() { renderCalls += 1; return { media: {} }; }
    })
  });

  assert.equal(renderCalls, 0);
  const sent = socket.sent.at(-1).content;
  assert.equal(sent.image, undefined);
  assert.equal(typeof sent.text, 'string');
});

test('ficha anexa a imagem do personagem real quando a BunnyFy responde', async () => {
  const chatId = 'grupo-ficha-img@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);
  const raw = { chatId, groupId: chatId, senderLid: '977777777@lid', pushName: 'Nara', timestamp: Date.now() };

  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m1` }, command: 'entrar', args: [] });
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m2` }, command: '1', args: [] });
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m3` }, command: '1', args: [] });

  await handleNexoPlayerCommand({
    socket,
    raw: { ...raw, messageId: `${chatId}-ficha` },
    command: 'ficha',
    args: [],
    bunnyfyEnv: BUNNYFY_ENV,
    bunnyfyClientFactory: () => ({
      async renderNexoCharacter(view) {
        assert.equal(view.titleLabel, 'Nara');
        return { width: 1200, height: 675, media: { mediaId: 'ficha-abcdefghij' } };
      },
      async downloadMedia() {
        return { buffer: Buffer.from('png-ficha'), mime: 'image/png' };
      }
    })
  });

  const sent = socket.sent.at(-1).content;
  assert.equal(sent.image.toString(), 'png-ficha');
  assert.match(sent.caption, /Ficha/);
});
