import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { TavernCommandController } from '../commands/TavernCommandController.js';
import { TavernRateLimiter } from '../commands/TavernRateLimiter.js';
import { TavernGameService } from '../TavernGameService.js';
import { TavernService } from '../TavernService.js';
import { shouldRoutePrivateTavernCommand } from '../runtime.js';
import { WhatsAppTavernTransport } from '../transport/WhatsAppTavernTransport.js';

class FastBoardRenderer {
  render() {
    return Promise.resolve(Buffer.from('campo-teste'));
  }
}

class FastHandRenderer {
  render(state, playerId) {
    return Promise.resolve(Buffer.from(`mao:${playerId}:${state.players[playerId].hand.length}`));
  }
}

class RoutedFakeTransport {
  constructor({ currentChatId, groupChatId = currentChatId, deliveries = [] }) {
    this.currentChatId = currentChatId;
    this.groupChatId = groupChatId;
    this.deliveries = deliveries;
  }

  withGroupChat(groupChatId) {
    return new RoutedFakeTransport({
      currentChatId: this.currentChatId,
      groupChatId,
      deliveries: this.deliveries
    });
  }

  sendCurrentText(text, options = {}) {
    this.deliveries.push({ channel: 'current', target: this.currentChatId, text, options });
    return Promise.resolve({});
  }

  sendGroupText(text, options = {}) {
    this.deliveries.push({ channel: 'group', target: this.groupChatId, text, options });
    return Promise.resolve({});
  }

  sendGroupImage(buffer, options = {}) {
    this.deliveries.push({ channel: 'group', target: this.groupChatId, buffer, options });
    return Promise.resolve({});
  }

  sendPrivateText(playerId, text) {
    this.deliveries.push({ channel: 'private', target: playerId, text });
    return Promise.resolve({});
  }

  sendPrivateImage(playerId, buffer, options = {}) {
    this.deliveries.push({ channel: 'private', target: playerId, buffer, options });
    return Promise.resolve({});
  }

  getDisplayName(playerId) {
    return Promise.resolve(playerId.split('@')[0]);
  }
}

let messageSequence = 0;

function commandContext({
  transport,
  playerId = 'one@s.whatsapp.net',
  chatId = 'group-private-actions@g.us',
  args = [],
  mentionedJids = [],
  isGroup = true,
  isAdmin = false
}) {
  return {
    transport,
    playerId,
    chatId,
    args,
    mentionedJids,
    isGroup,
    isAdmin,
    pushName: playerId.split('@')[0],
    prefix: '!',
    messageId: `private-actions-${++messageSequence}`,
    botId: 'bot@s.whatsapp.net'
  };
}

async function createFixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gyomei-tavern-private-actions-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const tavern = await TavernService.create({
    databasePath: path.join(directory, 'tavern.sqlite'),
    seedFactory: () => 'private-actions-seed'
  });
  t.after(() => tavern.close());
  let challengeSequence = 0;
  const game = new TavernGameService({
    tavern,
    idFactory: () => `private-challenge-${++challengeSequence}`
  });
  const controller = new TavernCommandController({
    game,
    boardRenderer: new FastBoardRenderer(),
    handRenderer: new FastHandRenderer(),
    rateLimiter: new TavernRateLimiter({ maxCommands: 100 })
  });
  return { tavern, game, controller };
}

async function startMatch(fixture, transport, groupId = 'group-private-actions@g.us') {
  await fixture.controller.handle('tavern', commandContext({
    transport,
    chatId: groupId,
    args: ['on'],
    isAdmin: true
  }));
  await fixture.controller.handle('duelo', commandContext({
    transport,
    chatId: groupId,
    args: ['@two'],
    mentionedJids: ['two@s.whatsapp.net']
  }));
  await fixture.controller.handle('aceitar', commandContext({
    transport,
    chatId: groupId,
    playerId: 'two@s.whatsapp.net'
  }));
}

function privateContext(playerId, deliveries, args = []) {
  return commandContext({
    transport: new RoutedFakeTransport({ currentChatId: playerId, deliveries }),
    playerId,
    chatId: playerId,
    args,
    isGroup: false
  });
}

test('transporte separa resposta atual no privado de atualização pública no grupo', async () => {
  const sent = [];
  const quoted = { key: { id: 'dm-message' } };
  const socket = {
    async sendMessage(target, payload, options) {
      sent.push({ target, payload, options });
      return {};
    }
  };
  const transport = new WhatsAppTavernTransport({
    socket,
    chatId: 'one@s.whatsapp.net',
    quoted
  }).withGroupChat('group-private-actions@g.us');

  await transport.sendCurrentText('resposta privada');
  await transport.sendGroupText('evento público');
  await transport.sendGroupImage(Buffer.from('png'), { caption: 'mesa' });

  assert.equal(sent[0].target, 'one@s.whatsapp.net');
  assert.deepEqual(sent[0].options, { quoted });
  assert.equal(sent[1].target, 'group-private-actions@g.us');
  assert.equal(sent[1].options, undefined, 'mensagem do privado não pode ser citada em outro chat');
  assert.equal(sent[2].target, 'group-private-actions@g.us');
  assert.equal(sent[2].options, undefined);
});

test('roteador privado preserva comandos compartilhados fora da Tavern e assume quando há partida', () => {
  assert.equal(shouldRoutePrivateTavernCommand('jogar', 0), false, 'UNO continua recebendo jogar sem mesa Tavern');
  assert.equal(shouldRoutePrivateTavernCommand('mao', 0), false, 'UNO continua recebendo mao sem mesa Tavern');
  assert.equal(shouldRoutePrivateTavernCommand('jogar', 1), true);
  assert.equal(shouldRoutePrivateTavernCommand('mao', 2), true, 'ambiguidade precisa chegar ao erro guiado da Tavern');
  assert.equal(shouldRoutePrivateTavernCommand('mulligan', 0), true, 'comando exclusivo recebe resposta Tavern mesmo sem mesa');
  assert.equal(shouldRoutePrivateTavernCommand('duelo', 1), false, 'duelo genérico continua fora do privado Tavern');
});

test('sequência PvP aceita mulligan, jogar, fim, atacar, poder e desistir pelo privado', async t => {
  const fixture = await createFixture(t);
  const deliveries = [];
  const groupId = 'group-private-actions@g.us';
  const groupTransport = new RoutedFakeTransport({ currentChatId: groupId, deliveries });
  await startMatch(fixture, groupTransport, groupId);

  await fixture.controller.handle('mulligan', privateContext('one@s.whatsapp.net', deliveries, ['manter']));
  await fixture.controller.handle('mulligan', privateContext('two@s.whatsapp.net', deliveries, ['manter']));

  let match = await fixture.game.getActiveMatch(groupId, 'one@s.whatsapp.net');
  assert.equal(match.state.phase, 'MAIN');
  const firstPlayerId = match.state.turn.activePlayerId;
  const secondPlayerId = match.state.playerOrder.find(id => id !== firstPlayerId);
  const firstPlayer = match.state.players[firstPlayerId];
  const playableIndex = firstPlayer.hand.findIndex(card => card.type === 'MINION' && card.cost <= firstPlayer.mana.current);
  assert.ok(playableIndex >= 0, 'a mão inicial precisa conter criatura jogável para o fluxo de teste');

  await fixture.controller.handle('jogar', privateContext(firstPlayerId, deliveries, [String(playableIndex + 1)]));
  match = await fixture.game.getActiveMatch(groupId, firstPlayerId);
  assert.equal(match.state.players[firstPlayerId].board.length, 1);

  await fixture.controller.handle('fim', privateContext(firstPlayerId, deliveries));
  await fixture.controller.handle('fim', privateContext(secondPlayerId, deliveries));

  match = await fixture.game.getActiveMatch(groupId, firstPlayerId);
  assert.equal(match.state.turn.activePlayerId, firstPlayerId);
  assert.equal(match.state.players[firstPlayerId].board[0].canAttack, true);

  await fixture.controller.handle('atacar', privateContext(firstPlayerId, deliveries, ['1', 'heroi']));
  await fixture.controller.handle('poder', privateContext(firstPlayerId, deliveries));
  await fixture.controller.handle('mao', privateContext(firstPlayerId, deliveries));
  await fixture.controller.handle('campo', privateContext(firstPlayerId, deliveries));
  await fixture.controller.handle('desistir', privateContext(firstPlayerId, deliveries));

  const finished = await fixture.tavern.repository.getMatch(match.matchId);
  assert.equal(finished.state.status, 'FINISHED');
  assert.ok(
    deliveries.some(item => item.channel === 'group' && item.target === groupId && item.buffer),
    'ações privadas precisam continuar atualizando a mesa no grupo correto'
  );
  assert.ok(
    deliveries.some(item => item.channel === 'private' && item.target === firstPlayerId && item.buffer),
    'a mão continua sendo entregue somente ao jogador'
  );
  assert.equal(
    deliveries.some(item => item.channel === 'group' && item.target === firstPlayerId),
    false,
    'saída pública não pode cair no chat privado por engano'
  );
});

test('mais de uma partida ativa torna o comando privado ambíguo e não muta nenhuma mesa', async t => {
  const fixture = await createFixture(t);
  const deliveries = [];
  const firstGroup = 'group-private-one@g.us';
  const secondGroup = 'group-private-two@g.us';
  await startMatch(fixture, new RoutedFakeTransport({ currentChatId: firstGroup, deliveries }), firstGroup);

  await fixture.controller.handle('tavern', commandContext({
    transport: new RoutedFakeTransport({ currentChatId: secondGroup, deliveries }),
    chatId: secondGroup,
    args: ['on'],
    isAdmin: true
  }));
  await fixture.game.createChallenge({
    groupId: secondGroup,
    challengerId: 'one@s.whatsapp.net',
    challengedId: 'three@s.whatsapp.net'
  });
  await fixture.game.acceptChallenge(secondGroup, 'three@s.whatsapp.net');

  const matchesBefore = await fixture.tavern.repository.listActiveMatchesForPlayer('one@s.whatsapp.net');
  const versionsBefore = matchesBefore.map(item => item.version);
  await fixture.controller.handle('fim', privateContext('one@s.whatsapp.net', deliveries));
  const matchesAfter = await fixture.tavern.repository.listActiveMatchesForPlayer('one@s.whatsapp.net');

  assert.deepEqual(matchesAfter.map(item => item.version), versionsBefore);
  const response = deliveries.findLast(item => item.channel === 'current' && item.target === 'one@s.whatsapp.net');
  assert.match(response.text, /mais de uma partida ativa/i);
});

test('ação privada sem partida recebe explicação Tavern em vez de silêncio', async t => {
  const fixture = await createFixture(t);
  const deliveries = [];
  await fixture.controller.handle('mulligan', privateContext('one@s.whatsapp.net', deliveries, ['manter']));
  const response = deliveries.findLast(item => item.channel === 'current');
  assert.match(response.text, /Não encontrei uma partida ativa/i);
});
