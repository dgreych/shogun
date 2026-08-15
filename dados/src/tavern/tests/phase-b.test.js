import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { TavernCommandController } from '../commands/TavernCommandController.js';
import { TavernRateLimiter } from '../commands/TavernRateLimiter.js';
import { TavernGameService } from '../TavernGameService.js';
import { TavernService } from '../TavernService.js';
import { BoardRenderer } from '../rendering/BoardRenderer.js';
import { HandRenderer } from '../rendering/HandRenderer.js';

class FakeTransport {
  constructor({ failPrivateFor = [] } = {}) {
    this.failPrivateFor = new Set(failPrivateFor);
    this.groupTexts = [];
    this.groupImages = [];
    this.privateTexts = [];
    this.privateImages = [];
  }

  sendCurrentText(text, options = {}) {
    this.groupTexts.push({ text, options });
    return Promise.resolve({});
  }

  sendGroupText(text, options = {}) {
    this.groupTexts.push({ text, options });
    return Promise.resolve({});
  }

  sendGroupImage(buffer, options = {}) {
    this.groupImages.push({ buffer, options });
    return Promise.resolve({});
  }

  sendPrivateText(playerId, text) {
    if (this.failPrivateFor.has(playerId)) return Promise.reject(new Error('DM indisponível'));
    this.privateTexts.push({ playerId, text });
    return Promise.resolve({});
  }

  sendPrivateImage(playerId, buffer, options = {}) {
    if (this.failPrivateFor.has(playerId)) return Promise.reject(new Error('DM indisponível'));
    this.privateImages.push({ playerId, buffer, options });
    return Promise.resolve({});
  }

  getDisplayName(playerId) {
    return Promise.resolve(playerId.startsWith('one') ? 'Jogador Um' : 'Jogador Dois');
  }
}

class FastBoardRenderer {
  render() {
    return Promise.resolve(Buffer.from('campo-publico'));
  }
}

class FastHandRenderer {
  render(state, playerId) {
    return Promise.resolve(Buffer.from(`mao:${playerId}:${state.players[playerId].hand.length}`));
  }
}

let contextSequence = 0;

async function createFixture(t, { mutableClock = false } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gyomei-tavern-phase-b-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const databasePath = path.join(directory, 'tavern.sqlite');
  let timestamp = Date.parse('2026-08-09T12:00:00.000Z');
  const now = () => timestamp;
  const tavern = await TavernService.create({ databasePath, now });
  let id = 0;
  const game = new TavernGameService({
    tavern,
    now,
    idFactory: () => `challenge-${++id}`
  });
  const controller = new TavernCommandController({
    game,
    boardRenderer: new FastBoardRenderer(),
    handRenderer: new FastHandRenderer(),
    rateLimiter: new TavernRateLimiter({ maxCommands: 100, now })
  });
  const close = async () => tavern.close();
  if (!mutableClock) t.after(close);
  return {
    databasePath,
    tavern,
    game,
    controller,
    now,
    setNow: value => { timestamp = value; },
    close
  };
}

function context({
  transport,
  playerId = 'one@s.whatsapp.net',
  chatId = 'group-one@g.us',
  args = [],
  mentionedJids = [],
  isAdmin = false,
  messageId = null
}) {
  return {
    transport,
    playerId,
    chatId,
    args,
    mentionedJids,
    isAdmin,
    isGroup: true,
    pushName: playerId.startsWith('one') ? 'Jogador Um' : 'Jogador Dois',
    prefix: '!',
    messageId: messageId || `message-${++contextSequence}`,
    botId: 'bot@s.whatsapp.net'
  };
}

async function enableAndChallenge(fixture, transport) {
  await fixture.controller.handle('tavern', context({
    transport,
    args: ['on'],
    isAdmin: true,
    messageId: 'enable'
  }));
  await fixture.controller.handle('duelo', context({
    transport,
    args: ['@two', 'normal'],
    mentionedJids: ['two@s.whatsapp.net'],
    messageId: 'challenge'
  }));
}

test('tutorial e referência de comandos ficam acessíveis antes da ativação', async t => {
  const fixture = await createFixture(t);
  const transport = new FakeTransport();

  await fixture.controller.handle('tavern', context({
    transport,
    args: ['tutorial'],
    messageId: 'tutorial'
  }));
  assert.match(transport.groupTexts.at(-1).text, /TUTORIAL DA GYOMEI TAVERN/);
  assert.match(transport.groupTexts.at(-1).text, /!mulligan manter/);
  assert.match(transport.groupTexts.at(-1).text, /mão nunca é publicada/i);

  await fixture.controller.handle('tavern', context({
    transport,
    args: ['comandos'],
    messageId: 'commands'
  }));
  assert.match(transport.groupTexts.at(-1).text, /COMANDOS DA GYOMEI TAVERN/);
  assert.match(transport.groupTexts.at(-1).text, /!atacar <criatura> <alvo\|heroi>/);
  assert.match(transport.groupTexts.at(-1).text, /!tavern tutorial/);

  await fixture.controller.handle('tavern', context({
    transport,
    args: ['ajuda'],
    messageId: 'help'
  }));
  assert.match(transport.groupTexts.at(-1).text, /COMANDOS DA GYOMEI TAVERN/);
  assert.equal(await fixture.game.getGroup('group-one@g.us'), null);
});

test('ativação da Taverna é isolada por grupo e exige administrador', async t => {
  const fixture = await createFixture(t);
  const transport = new FakeTransport();

  await fixture.controller.handle('tavern', context({ transport, args: ['on'], messageId: 'denied' }));
  assert.match(transport.groupTexts.at(-1).text, /Somente administradores/);

  await fixture.controller.handle('tavern', context({
    transport,
    args: ['on'],
    isAdmin: true,
    messageId: 'allowed'
  }));
  assert.equal((await fixture.game.getGroup('group-one@g.us')).enabled, true);
  assert.equal(await fixture.game.getGroup('group-two@g.us'), null);

  await fixture.controller.handle('tavern', context({
    transport,
    args: ['config', 'turno', 'blitz'],
    isAdmin: true,
    messageId: 'config-turn'
  }));
  assert.equal((await fixture.game.getGroup('group-one@g.us')).settings.turnMode, 'BLITZ');
});

test('duelo aceito cria partida e envia cada mão somente por DM', async t => {
  const fixture = await createFixture(t);
  const transport = new FakeTransport();
  await enableAndChallenge(fixture, transport);

  await fixture.controller.handle('aceitar', context({
    transport,
    playerId: 'two@s.whatsapp.net',
    messageId: 'accept'
  }));

  const match = await fixture.game.getActiveMatch('group-one@g.us', 'one@s.whatsapp.net');
  assert.equal(match.state.phase, 'MULLIGAN');
  assert.equal(transport.privateImages.length, 2);
  assert.deepEqual(
    transport.privateImages.map(item => item.playerId).sort(),
    ['one@s.whatsapp.net', 'two@s.whatsapp.net']
  );
  assert.equal(transport.groupImages.length, 1);
  const publicText = transport.groupTexts.map(item => item.text).join('\n');
  assert.doesNotMatch(publicText, /Sentinela de Pedra|Bruxa do Véu|Lobo da Bruma/);

  await fixture.controller.handle('tavern', context({
    transport,
    args: ['off'],
    isAdmin: true,
    messageId: 'disable-active'
  }));
  assert.equal((await fixture.game.getGroup('group-one@g.us')).enabled, true);
  assert.match(transport.groupTexts.at(-1).text, /partida ativa/);

  await fixture.controller.handle('aceitar', context({
    transport,
    playerId: 'two@s.whatsapp.net',
    messageId: 'accept'
  }));
  assert.equal(transport.privateImages.length, 2);
  assert.match(transport.groupTexts.at(-1).text, /já foi processado/);
});

test('falha de DM avisa o grupo sem revelar a mão', async t => {
  const fixture = await createFixture(t);
  const transport = new FakeTransport({ failPrivateFor: ['two@s.whatsapp.net'] });
  await enableAndChallenge(fixture, transport);
  await fixture.controller.handle('aceitar', context({
    transport,
    playerId: 'two@s.whatsapp.net',
    messageId: 'accept-dm-failure'
  }));

  const publicText = transport.groupTexts.map(item => item.text).join('\n');
  assert.match(publicText, /Não consegui enviar a mão no privado/);
  assert.doesNotMatch(publicText, /Sentinela de Pedra|Bruxa do Véu|Lobo da Bruma/);
  assert.equal(transport.privateImages.some(item => item.playerId === 'two@s.whatsapp.net'), false);
});

test('mulligan, turno e idempotência funcionam pelo controlador', async t => {
  const fixture = await createFixture(t);
  const transport = new FakeTransport();
  await enableAndChallenge(fixture, transport);
  await fixture.controller.handle('aceitar', context({
    transport,
    playerId: 'two@s.whatsapp.net',
    messageId: 'accept-flow'
  }));
  await fixture.controller.handle('mulligan', context({
    transport,
    playerId: 'one@s.whatsapp.net',
    args: ['manter'],
    messageId: 'mulligan-one'
  }));
  await fixture.controller.handle('mulligan', context({
    transport,
    playerId: 'two@s.whatsapp.net',
    args: ['manter'],
    messageId: 'mulligan-two'
  }));

  let match = await fixture.game.getActiveMatch('group-one@g.us', 'one@s.whatsapp.net');
  assert.equal(match.state.phase, 'MAIN');
  const activePlayerId = match.state.turn.activePlayerId;
  const endContext = context({
    transport,
    playerId: activePlayerId,
    messageId: 'same-end-turn'
  });
  await fixture.controller.handle('fim', endContext);
  await fixture.controller.handle('fim', endContext);
  match = await fixture.game.getActiveMatch('group-one@g.us', activePlayerId);
  assert.equal(match.version, 3);
  assert.match(transport.groupTexts.at(-1).text, /já foi processada/);
});

test('usuário externo e outro grupo não controlam a partida', async t => {
  const fixture = await createFixture(t);
  const transport = new FakeTransport();
  await enableAndChallenge(fixture, transport);
  await fixture.controller.handle('aceitar', context({
    transport,
    playerId: 'two@s.whatsapp.net',
    messageId: 'accept-isolation'
  }));

  await fixture.controller.handle('campo', context({
    transport,
    playerId: 'outsider@s.whatsapp.net',
    messageId: 'outsider'
  }));
  assert.match(transport.groupTexts.at(-1).text, /não participa de uma partida ativa/);
  await fixture.controller.handle('campo', context({
    transport,
    chatId: 'group-two@g.us',
    playerId: 'one@s.whatsapp.net',
    messageId: 'other-group'
  }));
  assert.match(transport.groupTexts.at(-1).text, /não está ativa neste grupo/);
});

test('job de prazos recupera o mulligan e passa turno expirado', async t => {
  const fixture = await createFixture(t, { mutableClock: true });
  t.after(() => fixture.close());
  const transport = new FakeTransport();
  await enableAndChallenge(fixture, transport);
  await fixture.controller.handle('aceitar', context({
    transport,
    playerId: 'two@s.whatsapp.net',
    messageId: 'accept-timeout'
  }));

  let match = await fixture.game.getActiveMatch('group-one@g.us', 'one@s.whatsapp.net');
  fixture.setNow(Date.parse(match.state.turn.deadlineAt) + 1);
  let results = await fixture.controller.processTimeouts(() => transport);
  assert.equal(results.length, 1);
  assert.equal(results[0].state.phase, 'MAIN');
  assert.match(transport.groupImages.at(-1).options.caption, /tempo de preparação terminou/i);

  match = await fixture.game.getActiveMatch('group-one@g.us', 'one@s.whatsapp.net');
  const previousPlayer = match.state.turn.activePlayerId;
  fixture.setNow(Date.parse(match.state.turn.deadlineAt) + 1);
  results = await fixture.controller.processTimeouts(() => transport);
  assert.equal(results.length, 1);
  assert.notEqual(results[0].state.turn.activePlayerId, previousPlayer);
  assert.match(transport.groupImages.at(-1).options.caption, /passado automaticamente/i);
});

test('partida e convite são recuperados do SQLite após reabrir o processo', async t => {
  const fixture = await createFixture(t, { mutableClock: true });
  const transport = new FakeTransport();
  await enableAndChallenge(fixture, transport);
  const pendingBefore = await fixture.game.getPendingChallenge('group-one@g.us', 'two@s.whatsapp.net');
  assert.equal(pendingBefore.status, 'OPEN');
  await fixture.controller.handle('aceitar', context({
    transport,
    playerId: 'two@s.whatsapp.net',
    messageId: 'accept-recovery'
  }));
  const before = await fixture.game.getActiveMatch('group-one@g.us', 'one@s.whatsapp.net');
  await fixture.close();

  const reopened = await TavernService.create({ databasePath: fixture.databasePath, now: fixture.now });
  t.after(() => reopened.close());
  const restored = await reopened.repository.findActiveMatchForPlayer(
    'group-one@g.us',
    'one@s.whatsapp.net'
  );
  assert.equal(restored.matchId, before.matchId);
  assert.equal(restored.state.turn.deadlineAt, before.state.turn.deadlineAt);
  assert.equal(
    restored.state.players['one@s.whatsapp.net'].hand.length,
    before.state.players['one@s.whatsapp.net'].hand.length
  );
});

test('renderizadores produzem PNGs válidos para campo público e mão privada', async t => {
  const fixture = await createFixture(t);
  await fixture.game.setGroupEnabled('group-one@g.us', true);
  await fixture.game.createChallenge({
    groupId: 'group-one@g.us',
    challengerId: 'one@s.whatsapp.net',
    challengedId: 'two@s.whatsapp.net',
    challengerName: 'Jogador Um',
    challengedName: 'Jogador Dois'
  });
  const { match: state } = await fixture.game.acceptChallenge('group-one@g.us', 'two@s.whatsapp.net');
  const names = await fixture.game.getPlayerNames(state);
  const board = await new BoardRenderer({ now: fixture.now }).render(state, { playerNames: names });
  const hand = await new HandRenderer().render(state, 'one@s.whatsapp.net');
  assert.equal(board.subarray(1, 4).toString(), 'PNG');
  assert.equal(hand.subarray(1, 4).toString(), 'PNG');
  assert.ok(board.length > 10_000);
  assert.ok(hand.length > 10_000);
});
