import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NEXO_DATABASE_PATH = ':memory:';

const {
  handleNexoCommand,
  handleNexoPlayerCommand,
  shouldHandleNexoNumericReply,
  shouldHandleNexoPlayerCommand
} = await import('../runtime.js');

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

// messageId precisa ser único NÃO SÓ dentro de um teste, mas em todo o
// arquivo -- todos os testes aqui compartilham o mesmo runtime singleton
// (mesma nexo_processed_messages), exatamente como aconteceria com o bot
// real recebendo IDs de mensagem do WhatsApp. Por isso todo messageId é
// prefixado pelo chatId do próprio teste.
async function activateGroup(socket, chatId) {
  const preview = await handleNexoCommand({
    socket,
    raw: {
      chatId,
      groupId: chatId,
      senderLid: '900000001@lid',
      pushName: 'Admin',
      timestamp: Date.now(),
      messageId: `${chatId}-activate-1`
    },
    args: ['ativar', 'casual'],
    isGroupAdmin: true
  });
  const token = socket.sent.at(-1).content.text.match(/confirmar (\w+)/)[1];
  await handleNexoCommand({
    socket,
    raw: {
      chatId,
      groupId: chatId,
      senderLid: '900000001@lid',
      pushName: 'Admin',
      timestamp: Date.now(),
      messageId: `${chatId}-activate-2`
    },
    args: ['confirmar', token],
    isGroupAdmin: true
  });
  return preview;
}

test('shouldHandleNexoPlayerCommand reconhece os verbos de jogador', () => {
  assert.equal(shouldHandleNexoPlayerCommand('entrar'), true);
  assert.equal(shouldHandleNexoPlayerCommand('painel'), true);
  assert.equal(shouldHandleNexoPlayerCommand('ficha'), true);
  assert.equal(shouldHandleNexoPlayerCommand('privado'), true);
  assert.equal(shouldHandleNexoPlayerCommand('tutorial'), true);
  assert.equal(shouldHandleNexoPlayerCommand('continuar'), true);
  assert.equal(shouldHandleNexoPlayerCommand('cancelar'), true);
  assert.equal(shouldHandleNexoPlayerCommand('menu'), false);
});

test('numero puro só é interceptado quando existe onboarding pendente real', async () => {
  const chatId = 'grupo-numeric@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);

  const semPendencia = await shouldHandleNexoNumericReply({
    command: '1',
    chatId,
    senderAddress: '911111111@lid'
  });
  assert.equal(semPendencia, false);

  await handleNexoPlayerCommand({
    socket,
    raw: { chatId, groupId: chatId, senderLid: '911111111@lid', timestamp: Date.now(), messageId: `${chatId}-entrar` },
    command: 'entrar',
    args: []
  });

  const comPendencia = await shouldHandleNexoNumericReply({
    command: '1',
    chatId,
    senderAddress: '911111111@lid'
  });
  assert.equal(comPendencia, true);
});

test('fluxo completo via runtime: entrar -> 1 -> 1 -> ficha mostra o personagem', async () => {
  const chatId = 'grupo-flow@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);
  const raw = { chatId, groupId: chatId, senderLid: '922222222@lid', pushName: 'Nara', timestamp: Date.now() };

  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m1` }, command: 'entrar', args: [] });
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m2` }, command: '1', args: [] });
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m3` }, command: '1', args: [] });
  const ficha = await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m4` }, command: 'ficha', args: [] });

  assert.equal(ficha.kind, 'CARD');
  const lastText = socket.sent.at(-1).content.text;
  assert.match(lastText, /Ficha/);
});

test('painel funciona antes de qualquer jogador entrar', async () => {
  const chatId = 'grupo-painel@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);

  const painel = await handleNexoPlayerCommand({
    socket,
    raw: { chatId, groupId: chatId, senderLid: '933333333@lid', timestamp: Date.now(), messageId: `${chatId}-painel` },
    command: 'painel',
    args: []
  });
  assert.equal(painel.kind, 'CARD');
  assert.match(socket.sent.at(-1).content.text, /Painel do Círculo/);
});

test('ficha sem personagem responde erro, não cria personagem por engano', async () => {
  const chatId = 'grupo-ficha-vazia@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);

  const result = await handleNexoPlayerCommand({
    socket,
    raw: { chatId, groupId: chatId, senderLid: '944444444@lid', timestamp: Date.now(), messageId: `${chatId}-ficha` },
    command: 'ficha',
    args: []
  });
  assert.equal(result.kind, 'ERROR');
});

test('privado on manda a próxima ficha em DM; privado off volta pro grupo', async () => {
  const chatId = 'grupo-privado@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);
  const raw = { chatId, groupId: chatId, senderLid: '955555555@lid', pushName: 'Vex', timestamp: Date.now() };

  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m1` }, command: 'entrar', args: [] });
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m2` }, command: '2', args: [] });
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m3` }, command: '2', args: [] });

  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m4` }, command: 'privado', args: ['on'] });
  const beforePrivateFicha = socket.sent.length;
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m5` }, command: 'ficha', args: [] });
  assert.equal(socket.sent[beforePrivateFicha].chatId, '955555555@lid');

  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m6` }, command: 'privado', args: ['off'] });
  const beforeGroupFicha = socket.sent.length;
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m7` }, command: 'ficha', args: [] });
  assert.equal(socket.sent[beforeGroupFicha].chatId, chatId);
});

test('!continuar reexibe o passo atual sem avançar o estado', async () => {
  const chatId = 'grupo-continuar@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);
  const raw = { chatId, groupId: chatId, senderLid: '966666666@lid', timestamp: Date.now() };

  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m1` }, command: 'entrar', args: [] });
  const continuar = await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m2` }, command: 'continuar', args: [] });
  assert.equal(continuar.kind, 'LIST');
  assert.match(socket.sent.at(-1).content.text, /primeira marca/);
});

test('!cancelar encerra e !continuar depois diz que não há nada pendente', async () => {
  const chatId = 'grupo-cancelar@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);
  const raw = { chatId, groupId: chatId, senderLid: '977777777@lid', timestamp: Date.now() };

  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m1` }, command: 'entrar', args: [] });
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m2` }, command: 'cancelar', args: [] });
  const continuar = await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-m3` }, command: 'continuar', args: [] });
  assert.match(continuar.sections[0].lines[0], /Não há nenhuma escolha pendente/);
});

test('!tutorial sem personagem pede pra entrar primeiro, não finge que funciona', async () => {
  const chatId = 'grupo-tutorial@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);

  const result = await handleNexoPlayerCommand({
    socket,
    raw: { chatId, groupId: chatId, senderLid: '988888888@lid', timestamp: Date.now(), messageId: `${chatId}-tutorial` },
    command: 'tutorial',
    args: []
  });
  assert.equal(result.kind, 'ERROR');
  assert.match(socket.sent.at(-1).content.text, /!entrar/);
});

test('!tutorial de ponta a ponta via runtime: escolha -> analisar -> agir conclui, uso incorreto dá erro claro', async () => {
  const chatId = 'grupo-tutorial-real@g.us';
  const socket = createFakeSocket();
  await activateGroup(socket, chatId);
  const raw = { chatId, groupId: chatId, senderLid: '999111222@lid', pushName: 'Vex', timestamp: Date.now() };

  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-e1` }, command: 'entrar', args: [] });
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-e2` }, command: '1', args: [] });
  await handleNexoPlayerCommand({ socket, raw: { ...raw, messageId: `${chatId}-e3` }, command: '1', args: [] });

  const usoErrado = await handleNexoPlayerCommand({
    socket, raw: { ...raw, messageId: `${chatId}-t0` }, command: 'tutorial', args: ['xyz']
  });
  assert.equal(usoErrado.kind, 'ERROR');

  const preview = await handleNexoPlayerCommand({
    socket, raw: { ...raw, messageId: `${chatId}-t1` }, command: 'tutorial', args: []
  });
  assert.equal(preview.kind, 'LIST');
  assert.match(preview.title, /A porta responde/);

  const choice = await handleNexoPlayerCommand({
    socket, raw: { ...raw, messageId: `${chatId}-t2` }, command: 'tutorial', args: ['2']
  });
  assert.equal(choice.kind, 'CONFIRMATION');

  const analysis = await handleNexoPlayerCommand({
    socket, raw: { ...raw, messageId: `${chatId}-t3` }, command: 'tutorial', args: ['analisar']
  });
  assert.equal(analysis.kind, 'CARD');

  const action = await handleNexoPlayerCommand({
    socket, raw: { ...raw, messageId: `${chatId}-t4` }, command: 'tutorial', args: ['agir', '1']
  });
  assert.equal(action.kind, 'CARD');
  assert.match(socket.sent.at(-1).content.text, /Golpe Solar/);
});
