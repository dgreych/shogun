import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { TAVERN_BOT_PLAYER_ID } from '../domain/TavernBotPlayer.js';
import { TavernGameService } from '../TavernGameService.js';
import { TavernService } from '../TavernService.js';
import { TavernVNextRhythmController } from '../experience/TavernVNextRhythmController.js';
import { VNextBoardRenderer } from '../rendering/VNextBoardRenderer.js';
import { VNextHandRenderer } from '../rendering/VNextHandRenderer.js';

function makeTransport() {
  return {
    groupTexts: [],
    groupImages: [],
    privateTexts: [],
    privateImages: [],
    async sendCurrentText(text, options = {}) { this.groupTexts.push({ text, options }); },
    async sendGroupText(text, options = {}) { this.groupTexts.push({ text, options }); },
    async sendGroupImage(buffer, options = {}) { this.groupImages.push({ buffer, options }); },
    async sendPrivateText(playerId, text) {
      if (playerId === TAVERN_BOT_PLAYER_ID) throw new Error('não deveria mandar texto privado pro bot');
      this.privateTexts.push({ playerId, text });
    },
    async sendPrivateImage(playerId, buffer, options = {}) {
      if (playerId === TAVERN_BOT_PLAYER_ID) throw new Error('não deveria mandar imagem privada pro bot');
      this.privateImages.push({ playerId, buffer, options });
    },
    async getDisplayName(id) { return id === TAVERN_BOT_PLAYER_ID ? 'Golem da Taverna' : 'Jogador Humano'; }
  };
}

let sequence = 0;
function ctx({ transport, playerId = 'human@s.whatsapp.net', chatId = 'group-bot@g.us', args = [], mentionedJids = [] }) {
  return {
    transport,
    playerId,
    chatId,
    args,
    mentionedJids,
    isAdmin: false,
    isGroup: true,
    pushName: 'Jogador Humano',
    prefix: '!',
    messageId: `msg-${++sequence}`,
    botId: 'bot@s.whatsapp.net'
  };
}

async function createFixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gyomei-tavern-bot-duel-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const databasePath = path.join(directory, 'tavern.sqlite');
  const tavern = await TavernService.create({ databasePath });
  t.after(() => tavern.close());
  const game = new TavernGameService({ tavern, idFactory: () => `challenge-${++sequence}` });
  const controller = new TavernVNextRhythmController({
    game,
    boardRenderer: new VNextBoardRenderer({}),
    handRenderer: new VNextHandRenderer({}),
    rateLimiter: { consume() {} }
  });
  return { tavern, game, controller };
}

test('!duelo bot cria a partida na hora, sem aceite, com humano sempre começando', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  await fixture.game.setGroupEnabled('group-bot@g.us', true);

  await fixture.controller.handle('duelo', ctx({ transport, args: ['bot'] }));

  const match = await fixture.game.getActiveMatch('group-bot@g.us', 'human@s.whatsapp.net');
  assert.equal(match.state.playerOrder.includes(TAVERN_BOT_PLAYER_ID), true);
  assert.equal(match.state.turn.number, 1);
  // humano sempre começa
  assert.equal(match.state.playerOrder[0], 'human@s.whatsapp.net');
  // bot já resolveu o próprio mulligan sozinho
  assert.equal(match.state.mulligan.responses[TAVERN_BOT_PLAYER_ID]?.done, true);
  assert.equal(match.state.mulligan.responses['human@s.whatsapp.net'], undefined);

  // nenhuma tentativa de mandar mensagem privada pro bot em momento nenhum
  assert.equal(transport.privateTexts.some(m => m.playerId === TAVERN_BOT_PLAYER_ID), false);
  assert.equal(transport.privateImages.some(m => m.playerId === TAVERN_BOT_PLAYER_ID), false);

  // humano recebeu a mão privada
  assert.equal(transport.privateImages.some(m => m.playerId === 'human@s.whatsapp.net'), true);
});

test('!duelo @bot (mencionando o contato real do bot) também cria a partida contra a máquina', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  await fixture.game.setGroupEnabled('group-bot@g.us', true);

  await fixture.controller.handle('duelo', ctx({
    transport,
    args: ['@bot'],
    mentionedJids: ['bot@s.whatsapp.net']
  }));

  const match = await fixture.game.getActiveMatch('group-bot@g.us', 'human@s.whatsapp.net');
  assert.equal(match.state.playerOrder.includes(TAVERN_BOT_PLAYER_ID), true);
  assert.equal(transport.groupTexts.some(m => /não participa de duelos/.test(m.text)), false);
});

test('depois do mulligan do humano e alguns !fim, o bot joga sozinho e devolve o turno', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  await fixture.game.setGroupEnabled('group-bot@g.us', true);

  await fixture.controller.handle('duelo', ctx({ transport, args: ['bot'] }));
  await fixture.controller.handle('mulligan', ctx({ transport, args: [] }));

  let match = await fixture.game.getActiveMatch('group-bot@g.us', 'human@s.whatsapp.net');
  assert.equal(match.state.phase, 'MAIN');
  assert.equal(match.state.turn.activePlayerId, 'human@s.whatsapp.net');

  for (let i = 0; i < 6 && match.state.status === 'ACTIVE'; i += 1) {
    await fixture.controller.handle('fim', ctx({ transport, args: [] }));
    match = await fixture.game.getActiveMatch('group-bot@g.us', 'human@s.whatsapp.net').catch(() => match);
    if (match.state.status !== 'ACTIVE') break;
    // depois de handleEndTurn resolver o bot inteiro, o turno sempre volta
    // pro humano (ou a partida termina) — nunca deveria sobrar parado no bot
    assert.notEqual(match.state.turn.activePlayerId, TAVERN_BOT_PLAYER_ID);
  }

  assert.equal(transport.privateTexts.some(m => m.playerId === TAVERN_BOT_PLAYER_ID), false);
  assert.equal(transport.privateImages.some(m => m.playerId === TAVERN_BOT_PLAYER_ID), false);
});

test('limite de 3 partidas simultâneas contra o bot por grupo', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  await fixture.game.setGroupEnabled('group-bot@g.us', true);

  for (let i = 0; i < 3; i += 1) {
    await fixture.controller.handle('duelo', ctx({ transport, playerId: `human${i}@s.whatsapp.net`, args: ['bot'] }));
  }

  // handle() intercepta TavernError e responde no grupo, não rejeita a promise
  await fixture.controller.handle('duelo', ctx({ transport, playerId: 'human4@s.whatsapp.net', args: ['bot'] }));
  const lastText = transport.groupTexts.at(-1).text;
  assert.match(lastText, /Já existem 3 partidas/);
});

test('duas partidas PvE no mesmo grupo nunca despacham o bot para a mesa errada', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  const groupId = 'group-bot@g.us';
  const firstHuman = 'human-one@s.whatsapp.net';
  const secondHuman = 'human-two@s.whatsapp.net';
  await fixture.game.setGroupEnabled(groupId, true);

  await fixture.controller.handle('duelo', ctx({ transport, playerId: firstHuman, args: ['bot'] }));
  await fixture.controller.handle('mulligan', ctx({ transport, playerId: firstHuman, args: ['manter'] }));
  await fixture.controller.handle('duelo', ctx({ transport, playerId: secondHuman, args: ['bot'] }));
  await fixture.controller.handle('mulligan', ctx({ transport, playerId: secondHuman, args: ['manter'] }));

  const firstBefore = await fixture.game.getActiveMatch(groupId, firstHuman);
  const secondBefore = await fixture.game.getActiveMatch(groupId, secondHuman);
  assert.notEqual(firstBefore.matchId, secondBefore.matchId);
  assert.equal(firstBefore.state.turn.activePlayerId, firstHuman);
  assert.equal(secondBefore.state.turn.activePlayerId, secondHuman);

  await fixture.controller.handle('fim', ctx({ transport, playerId: firstHuman }));

  const firstAfter = await fixture.game.getActiveMatch(groupId, firstHuman);
  const secondAfter = await fixture.game.getActiveMatch(groupId, secondHuman);
  assert.notEqual(firstAfter.state.turn.activePlayerId, TAVERN_BOT_PLAYER_ID);
  assert.equal(firstAfter.version > firstBefore.version, true, 'a primeira mesa precisa avançar');
  assert.equal(secondAfter.version, secondBefore.version, 'a segunda mesa não pode receber ações do bot alheio');
  assert.deepEqual(secondAfter.state, secondBefore.state);
});

test('matchId explícito recusa outro grupo ou ator antes de mutar a partida', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  const groupId = 'group-bot@g.us';
  const humanId = 'human-security@s.whatsapp.net';
  await fixture.game.setGroupEnabled(groupId, true);
  await fixture.controller.handle('duelo', ctx({ transport, playerId: humanId, args: ['bot'] }));
  const match = await fixture.game.getActiveMatch(groupId, humanId);

  await assert.rejects(
    fixture.game.dispatchForPlayer('other-group@g.us', TAVERN_BOT_PLAYER_ID, { type: 'MULLIGAN', cards: [] }, {
      matchId: match.matchId
    }),
    /não corresponde a esta mesa ou jogador/
  );
  await assert.rejects(
    fixture.game.dispatchForPlayer(groupId, 'outsider@s.whatsapp.net', { type: 'MULLIGAN', cards: [] }, {
      matchId: match.matchId
    }),
    /não corresponde a esta mesa ou jogador/
  );

  const after = await fixture.tavern.repository.getMatch(match.matchId);
  assert.equal(after.version, match.version);
  assert.deepEqual(after.state, match.state);
});

test('recupera duas partidas PvE simultaneamente paradas no turno do bot', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  const groupId = 'group-bot@g.us';
  const humans = ['human-stuck-one@s.whatsapp.net', 'human-stuck-two@s.whatsapp.net'];
  await fixture.game.setGroupEnabled(groupId, true);

  for (const humanId of humans) {
    await fixture.controller.handle('duelo', ctx({ transport, playerId: humanId, args: ['bot'] }));
    await fixture.controller.handle('mulligan', ctx({ transport, playerId: humanId, args: ['manter'] }));
    const match = await fixture.game.getActiveMatch(groupId, humanId);
    await fixture.game.dispatchForPlayer(groupId, humanId, { type: 'END_TURN' }, { matchId: match.matchId });
  }

  for (const humanId of humans) {
    const stuck = await fixture.game.getActiveMatch(groupId, humanId);
    assert.equal(stuck.state.turn.activePlayerId, TAVERN_BOT_PLAYER_ID);
  }

  await fixture.controller.resumeStuckBotMatches(() => transport, '!');

  for (const humanId of humans) {
    const recovered = await fixture.game.getActiveMatch(groupId, humanId);
    assert.notEqual(recovered.state.turn.activePlayerId, TAVERN_BOT_PLAYER_ID);
  }
});

test('resumeStuckBotMatches retoma um turno do bot que ficou preso (ex: reinício no meio do laço)', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  await fixture.game.setGroupEnabled('group-bot@g.us', true);

  await fixture.controller.handle('duelo', ctx({ transport, args: ['bot'] }));
  await fixture.controller.handle('mulligan', ctx({ transport, args: [] }));

  // Passa o turno pro bot direto pelo game service, sem passar pelo
  // controller.handleEndTurn — reproduz exatamente o cenário real: o
  // estado fica salvo com o bot como jogador ativo e ninguém jamais
  // conduziu o turno dele (equivalente a o processo cair bem no meio do
  // laço, antes de qualquer ação do bot ser despachada).
  await fixture.game.dispatchForPlayer('group-bot@g.us', 'human@s.whatsapp.net', { type: 'END_TURN' }, {});

  let match = await fixture.game.getActiveMatch('group-bot@g.us', 'human@s.whatsapp.net');
  assert.equal(match.state.turn.activePlayerId, TAVERN_BOT_PLAYER_ID);

  await fixture.controller.resumeStuckBotMatches(() => transport, '!');

  match = await fixture.game.getActiveMatch('group-bot@g.us', 'human@s.whatsapp.net');
  assert.notEqual(match.state.turn.activePlayerId, TAVERN_BOT_PLAYER_ID);
});
