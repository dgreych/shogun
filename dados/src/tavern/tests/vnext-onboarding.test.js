import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { CLASS_STARTER_CARD_IDS, NEUTRAL_STARTER_CARD_IDS, createStarterDeck } from '../domain/starterDeck.js';
import { createDefaultRegistries } from '../domain/registries.js';
import { MatchEngine } from '../domain/MatchEngine.js';
import { TavernRuleError, TavernValidationError } from '../errors.js';
import { TavernGameService } from '../TavernGameService.js';
import { TavernService } from '../TavernService.js';
import { TavernVNextRhythmController } from '../experience/TavernVNextRhythmController.js';
import { VNextBoardRenderer } from '../rendering/VNextBoardRenderer.js';
import { VNextHandRenderer } from '../rendering/VNextHandRenderer.js';

const INTRO_CLASSES = ['GUARDIAN', 'EXILE', 'STORM'];

function makeTransport() {
  return {
    groupTexts: [],
    groupImages: [],
    privateTexts: [],
    privateImages: [],
    async sendCurrentText(text, options = {}) { this.groupTexts.push({ text, options }); },
    async sendGroupText(text, options = {}) { this.groupTexts.push({ text, options }); },
    async sendGroupImage(buffer, options = {}) { this.groupImages.push({ buffer, options }); },
    async sendPrivateText(playerId, text) { this.privateTexts.push({ playerId, text }); },
    async sendPrivateImage(playerId, buffer, options = {}) { this.privateImages.push({ playerId, buffer, options }); },
    async getDisplayName(id) { return id.startsWith('one') ? 'Jogador Um' : 'Jogador Dois'; }
  };
}

let sequence = 0;
function ctx({ transport, playerId = 'one@s.whatsapp.net', chatId = 'group-onboarding@g.us', args = [], mentionedJids = [], messageId = null, isAdmin = false }) {
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
    messageId: messageId || `msg-${++sequence}`,
    botId: 'bot@s.whatsapp.net'
  };
}

async function createFixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gyomei-tavern-onboarding-'));
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

async function playThroughMulligan(fixture, transport, chatId = 'group-onboarding@g.us') {
  await fixture.controller.handle('duelo', ctx({
    transport, playerId: 'one@s.whatsapp.net', chatId, args: ['@two'], mentionedJids: ['two@s.whatsapp.net']
  }));
  await fixture.controller.handle('aceitar', ctx({ transport, playerId: 'two@s.whatsapp.net', chatId }));
  await fixture.controller.handle('mulligan', ctx({ transport, playerId: 'one@s.whatsapp.net', chatId, args: ['manter'] }));
  await fixture.controller.handle('mulligan', ctx({ transport, playerId: 'two@s.whatsapp.net', chatId, args: ['manter'] }));
  return fixture.game.getActiveMatch(chatId, 'one@s.whatsapp.net');
}

test('as 18 cartas do mini-set validam pelo CardRegistry real e pertencem à classe correta', async () => {
  const { cardRegistry } = await createDefaultRegistries();
  for (const classId of INTRO_CLASSES) {
    const cardIds = CLASS_STARTER_CARD_IDS[classId];
    assert.equal(cardIds.length, 6, `${classId} precisa ter 6 cartas próprias`);
    for (const cardId of cardIds) {
      const card = cardRegistry.get(cardId);
      assert.equal(card.classId, classId, `${cardId} deveria pertencer a ${classId}`);
      assert.equal(card.collectible, true);
    }
  }
  const allIds = Object.values(CLASS_STARTER_CARD_IDS).flat();
  assert.equal(new Set(allIds).size, 18, 'as 18 cartas precisam ter IDs únicos');
});

test('cada efeito das 18 cartas realmente executa no EffectEngine', async () => {
  const { cardRegistry, heroRegistry } = await createDefaultRegistries();
  const engine = new MatchEngine({ cardRegistry, heroRegistry });

  for (const classId of INTRO_CLASSES) {
    for (const cardId of CLASS_STARTER_CARD_IDS[classId]) {
      const state = engine.createMatch({
        groupId: 'group-test@g.us',
        seed: `seed-${cardId}`,
        players: [
          { id: 'one@s.whatsapp.net', classId, deck: createStarterDeck(classId) },
          { id: 'two@s.whatsapp.net', classId: classId === 'STORM' ? 'GUARDIAN' : 'STORM', deck: createStarterDeck(classId === 'STORM' ? 'GUARDIAN' : 'STORM') }
        ],
        startingPlayerId: 'one@s.whatsapp.net'
      });
      // preparação: mantém as duas mãos para ir direto ao MAIN
      let current = state;
      for (const playerId of current.playerOrder) {
        current = engine.applyAction(current, { type: 'MULLIGAN', actorId: playerId, cards: [] }).state;
      }
      const actorId = current.turn.activePlayerId;
      const actor = current.players[actorId];
      const card = engine.createCardInstance(current, cardId, actorId);
      actor.hand = [card];
      actor.mana.current = 10;
      actor.mana.max = 10;

      const requiresTarget = card.effects.some(effect => effect.trigger === 'ON_PLAY' && effect.target === 'TARGET');
      let target = null;
      if (requiresTarget) {
        const enemyId = current.playerOrder.find(id => id !== actorId);
        target = { kind: 'HERO', playerId: enemyId };
      }

      const result = engine.applyAction(current, { type: 'PLAY_CARD', actorId, card: card.instanceId, target });
      assert.ok(
        result.event.results.some(event => event.type === 'CARD_PLAYED'),
        `${cardId} precisa jogar sem lançar erro`
      );
    }
  }
});

test('Carrasco do Caminho (GY-EX-206) dispara o Último Suspiro ao morrer, não ao ser jogado', async () => {
  const { cardRegistry, heroRegistry } = await createDefaultRegistries();
  const engine = new MatchEngine({ cardRegistry, heroRegistry });
  let state = engine.createMatch({
    groupId: 'group-test@g.us',
    seed: 'seed-deathrattle',
    players: [
      { id: 'one@s.whatsapp.net', classId: 'EXILE', deck: createStarterDeck('EXILE') },
      { id: 'two@s.whatsapp.net', classId: 'GUARDIAN', deck: createStarterDeck('GUARDIAN') }
    ],
    startingPlayerId: 'one@s.whatsapp.net'
  });
  for (const playerId of state.playerOrder) {
    state = engine.applyAction(state, { type: 'MULLIGAN', actorId: playerId, cards: [] }).state;
  }
  const actorId = state.turn.activePlayerId;
  const carrasco = engine.createCardInstance(state, 'GY-EX-206', actorId);
  state.players[actorId].hand = [carrasco];
  state.players[actorId].mana.current = 10;

  const playResult = engine.applyAction(state, { type: 'PLAY_CARD', actorId, card: carrasco.instanceId });
  assert.equal(
    playResult.event.results.some(event => event.type === 'HERO_DAMAGED'),
    false,
    'jogar a carta não deveria disparar o Último Suspiro'
  );

  // Setup independente, espelhando o teste já existente do Último Suspiro (GY-042)
  // em registry-engine.test.js: o atacante ativo mata a criatura com Último Suspiro
  // no campo inimigo, e o próprio atacante sofre o dano ao herói.
  const enemyId = state.playerOrder.find(id => id !== actorId);
  const attacker = engine.createCardInstance(state, 'GY-027', actorId);
  attacker.attack = 10;
  attacker.canAttack = true;
  const deathrattleOnBoard = engine.createCardInstance(state, 'GY-EX-206', enemyId);
  deathrattleOnBoard.health = 1;
  state.players[actorId].board = [attacker];
  state.players[enemyId].board = [deathrattleOnBoard];
  const beforeHp = state.players[actorId].hero.hp;

  const attackResult = engine.applyAction(state, {
    type: 'ATTACK',
    actorId,
    source: attacker.instanceId,
    target: { kind: 'MINION', playerId: enemyId, instanceId: deathrattleOnBoard.instanceId }
  });
  assert.equal(
    attackResult.state.players[actorId].hero.hp,
    beforeHp - 2,
    'Último Suspiro causa 2 de dano ao herói inimigo ao morrer'
  );
});

test('cartas de alvo (TARGET) exigem alvo pelo caminho real de comando', async () => {
  const { engine } = await (async () => {
    const { cardRegistry, heroRegistry } = await createDefaultRegistries();
    return { engine: new MatchEngine({ cardRegistry, heroRegistry }) };
  })();
  let state = engine.createMatch({
    groupId: 'group-test@g.us',
    seed: 'seed-target',
    players: [
      { id: 'one@s.whatsapp.net', classId: 'EXILE', deck: createStarterDeck('EXILE') },
      { id: 'two@s.whatsapp.net', classId: 'GUARDIAN', deck: createStarterDeck('GUARDIAN') }
    ],
    startingPlayerId: 'one@s.whatsapp.net'
  });
  for (const playerId of state.playerOrder) {
    state = engine.applyAction(state, { type: 'MULLIGAN', actorId: playerId, cards: [] }).state;
  }
  const actorId = state.turn.activePlayerId;
  const actor = state.players[actorId];
  const card = engine.createCardInstance(state, 'GY-EX-203', actorId);
  actor.hand = [card];
  actor.mana.current = 10;

  assert.throws(
    () => engine.applyAction(state, { type: 'PLAY_CARD', actorId, card: card.instanceId }),
    TavernRuleError
  );
});

test('cada starter tem 30 cartas, respeita limites de cópia e usa as 6 cartas próprias da classe', async () => {
  const { cardRegistry, heroRegistry } = await createDefaultRegistries();
  const engine = new MatchEngine({ cardRegistry, heroRegistry });

  for (const classId of INTRO_CLASSES) {
    const deck = createStarterDeck(classId);
    assert.equal(deck.length, 30);
    engine.validateDeck(deck, classId);

    const counts = new Map();
    for (const cardId of deck) counts.set(cardId, (counts.get(cardId) || 0) + 1);
    for (const [cardId, count] of counts) assert.equal(count, 2, `${cardId} deveria ter exatamente 2 cópias`);

    const classCardIds = new Set(CLASS_STARTER_CARD_IDS[classId]);
    const classSlots = deck.filter(cardId => classCardIds.has(cardId)).length;
    assert.equal(classSlots, 12, '6 cartas próprias × 2 cópias = 12 de 30 (40%)');

    const neutralSlots = deck.filter(cardId => NEUTRAL_STARTER_CARD_IDS.includes(cardId)).length;
    assert.equal(neutralSlots, 18);
  }
});

test('classes avançadas sem mini-set continuam com starter válido, sem regressão', async () => {
  const { cardRegistry, heroRegistry } = await createDefaultRegistries();
  const engine = new MatchEngine({ cardRegistry, heroRegistry });
  for (const classId of ['ORACLE', 'SHAMAN', 'PROFANE']) {
    const deck = createStarterDeck(classId);
    assert.equal(deck.length, 30);
    engine.validateDeck(deck, classId);
  }
});

test('MatchEngine recusa deck com carta de outra classe introdutória', async () => {
  const { cardRegistry, heroRegistry } = await createDefaultRegistries();
  const engine = new MatchEngine({ cardRegistry, heroRegistry });
  const deck = createStarterDeck('EXILE').slice(0, 28).concat(['GY-GD-201', 'GY-GD-201']);
  assert.throws(() => engine.validateDeck(deck, 'EXILE'), /não pertence à classe/);
});

test('!tavern estilo persiste a classe e a home orienta quem ainda não escolheu', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  await fixture.game.setGroupEnabled('group-onboarding@g.us', true);

  await fixture.controller.handle('tavern', ctx({ transport, playerId: 'two@s.whatsapp.net', args: [] }));
  assert.match(transport.groupTexts.at(-1).text, /duelo bot/);
  assert.match(transport.groupTexts.at(-1).text, /estilo bastiao/);

  await fixture.controller.handle('tavern', ctx({ transport, playerId: 'two@s.whatsapp.net', args: ['estilo', 'cacada'] }));
  assert.match(transport.groupTexts.at(-1).text, /CAÇADA/);
  const player = await fixture.tavern.repository.getPlayer('two@s.whatsapp.net');
  assert.equal(player.activeClassId, 'EXILE');

  await fixture.controller.handle('tavern', ctx({ transport, playerId: 'two@s.whatsapp.net', args: [] }));
  assert.match(transport.groupTexts.at(-1).text, /Seu estilo: \*CAÇADA\*/);
});

test('jogador legado com classe já definida não é resetado ao passar pela home', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  await fixture.game.setGroupEnabled('group-onboarding@g.us', true);
  await fixture.tavern.repository.setPlayerClass('one@s.whatsapp.net', 'STORM');

  await fixture.controller.handle('tavern', ctx({ transport, playerId: 'one@s.whatsapp.net', args: [] }));
  const player = await fixture.tavern.repository.getPlayer('one@s.whatsapp.net');
  assert.equal(player.activeClassId, 'STORM');
  assert.match(transport.groupTexts.at(-1).text, /TEMPESTADE/);
});

test('estilo desconhecido recusa com mensagem clara e não muta a classe do jogador', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  await fixture.game.setGroupEnabled('group-onboarding@g.us', true);

  await fixture.controller.handle('tavern', ctx({ transport, playerId: 'one@s.whatsapp.net', args: ['estilo', 'nao-existe'] }));
  assert.match(transport.groupTexts.at(-1).text, /Estilo desconhecido/);
  // handle() agora registra o jogador (nome real) em todo comando, então o
  // registro passa a existir — o que este teste protege é que a classe
  // continua intocada por um estilo inválido, não a ausência do registro.
  const player = await fixture.tavern.repository.getPlayer('one@s.whatsapp.net');
  assert.equal(player.activeClassId, null);
});

test('acceptChallenge monta um starter compatível com a classe real de cada jogador', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  await fixture.game.setGroupEnabled('group-onboarding@g.us', true);
  await fixture.tavern.repository.setPlayerClass('one@s.whatsapp.net', 'GUARDIAN');
  await fixture.tavern.repository.setPlayerClass('two@s.whatsapp.net', 'STORM');

  await fixture.controller.handle('duelo', ctx({
    transport, playerId: 'one@s.whatsapp.net', args: ['@two'], mentionedJids: ['two@s.whatsapp.net']
  }));
  await fixture.controller.handle('aceitar', ctx({ transport, playerId: 'two@s.whatsapp.net' }));

  const match = await fixture.game.getActiveMatch('group-onboarding@g.us', 'one@s.whatsapp.net');
  const oneDeckIds = new Set([
    ...match.state.players['one@s.whatsapp.net'].deck.map(card => card.cardId),
    ...match.state.players['one@s.whatsapp.net'].hand.map(card => card.cardId)
  ]);
  const twoDeckIds = new Set([
    ...match.state.players['two@s.whatsapp.net'].deck.map(card => card.cardId),
    ...match.state.players['two@s.whatsapp.net'].hand.map(card => card.cardId)
  ]);

  assert.ok(CLASS_STARTER_CARD_IDS.GUARDIAN.some(id => oneDeckIds.has(id)), 'jogador um deveria ter cartas do Bastião');
  assert.ok(!CLASS_STARTER_CARD_IDS.STORM.some(id => oneDeckIds.has(id)), 'jogador um não deveria ter cartas do Arcano');
  assert.ok(CLASS_STARTER_CARD_IDS.STORM.some(id => twoDeckIds.has(id)), 'jogador dois deveria ter cartas do Arcano');
  assert.ok(!CLASS_STARTER_CARD_IDS.GUARDIAN.some(id => twoDeckIds.has(id)), 'jogador dois não deveria ter cartas do Bastião');
});

test('convite e mulligan usam VNextSceneRenderer sem vazar a mão no grupo', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  await fixture.game.setGroupEnabled('group-onboarding@g.us', true);
  await fixture.tavern.repository.setPlayerClass('one@s.whatsapp.net', 'GUARDIAN');
  await fixture.tavern.repository.setPlayerClass('two@s.whatsapp.net', 'EXILE');

  await fixture.controller.handle('duelo', ctx({
    transport, playerId: 'one@s.whatsapp.net', args: ['@two'], mentionedJids: ['two@s.whatsapp.net']
  }));
  assert.equal(transport.groupImages.length, 1);
  assert.equal(transport.groupImages[0].buffer.subarray(1, 4).toString(), 'PNG');

  await fixture.controller.handle('aceitar', ctx({ transport, playerId: 'two@s.whatsapp.net' }));
  const mulliganImages = transport.privateImages.filter(item => item.options.caption?.includes('abertura chegou'));
  assert.equal(mulliganImages.length, 2);
  for (const image of mulliganImages) {
    assert.equal(image.buffer.subarray(1, 4).toString(), 'PNG');
  }

  const publicText = transport.groupTexts.map(item => item.text).join('\n');
  assert.doesNotMatch(publicText, /Porteiro do Lampião|Batedor da Cinza/);
});

test('turno gera cena privada uma vez para o jogador ativo e vitória substitui o board público', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  await fixture.game.setGroupEnabled('group-onboarding@g.us', true);
  await fixture.tavern.repository.setPlayerClass('one@s.whatsapp.net', 'GUARDIAN');
  await fixture.tavern.repository.setPlayerClass('two@s.whatsapp.net', 'EXILE');

  const match = await playThroughMulligan(fixture, transport);
  const turnScenes = transport.privateImages.filter(item => item.options.caption?.startsWith('🔥 Turno'));
  assert.equal(turnScenes.length, 1, 'exatamente uma cena de turno ao iniciar o MAIN');

  const activeId = match.state.turn.activePlayerId;
  await fixture.controller.handle('desistir', ctx({ transport, playerId: activeId }));
  const lastImage = transport.groupImages.at(-1);
  assert.match(lastImage.options.caption, /Mesa encerrada/);
  assert.equal(lastImage.buffer.subarray(1, 4).toString(), 'PNG');
});

test('erro guiado preserva a causa oficial no público e só orienta o jogador ativo no privado', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  await fixture.game.setGroupEnabled('group-onboarding@g.us', true);
  await fixture.tavern.repository.setPlayerClass('one@s.whatsapp.net', 'GUARDIAN');
  await fixture.tavern.repository.setPlayerClass('two@s.whatsapp.net', 'EXILE');
  const match = await playThroughMulligan(fixture, transport);
  const activeId = match.state.turn.activePlayerId;
  const inactiveId = match.state.playerOrder.find(id => id !== activeId);

  transport.groupTexts = [];
  transport.privateTexts = [];
  await fixture.controller.handle('jogar', ctx({ transport, playerId: activeId, args: ['99'] }));
  assert.equal(transport.groupTexts.at(-1).text, '⚠️ Carta não encontrada na mão');
  const guidance = transport.privateTexts.find(item => item.playerId === activeId);
  assert.ok(guidance, 'jogador ativo recebe orientação privada');
  assert.match(guidance.text, /Pra te ajudar agora/);

  transport.groupTexts = [];
  transport.privateTexts = [];
  await fixture.controller.handle('atacar', ctx({ transport, playerId: inactiveId, args: ['1', 'heroi'] }));
  assert.match(transport.groupTexts.at(-1).text, /⚠️/);
  assert.equal(transport.privateTexts.length, 0, 'jogador fora do turno não recebe orientação privada');
});

test('regressão: announceState usa o prefixo real do contexto em vez de vazar [object Object] ou undefined', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  await fixture.game.setGroupEnabled('group-onboarding@g.us', true);

  await fixture.controller.handle('duelo', ctx({
    transport, playerId: 'one@s.whatsapp.net', args: ['@two'], mentionedJids: ['two@s.whatsapp.net']
  }));
  await fixture.controller.handle('aceitar', ctx({ transport, playerId: 'two@s.whatsapp.net' }));
  const acceptCaption = transport.groupImages.at(-1).options.caption;
  assert.match(acceptCaption, /Duelo aceito por @two/);
  assert.doesNotMatch(acceptCaption, /\[object Object\]|undefined/);

  await fixture.controller.handle('mulligan', ctx({ transport, playerId: 'one@s.whatsapp.net', args: ['manter'] }));
  await fixture.controller.handle('mulligan', ctx({ transport, playerId: 'two@s.whatsapp.net', args: ['manter'] }));
  const mainCaption = transport.groupImages.at(-1).options.caption;
  assert.match(mainCaption, /Preparação concluída/);
  assert.match(mainCaption, /!campo atualiza a mesa/);
  assert.doesNotMatch(mainCaption, /\[object Object\]|undefined/);

  await fixture.controller.handle('campo', ctx({ transport, playerId: 'one@s.whatsapp.net' }));
  assert.match(transport.groupImages.at(-1).options.caption, /!campo atualiza a mesa/);
});

test('duplicidade de messageId no aceite não duplica cenas de convite/mulligan', async t => {
  const fixture = await createFixture(t);
  const transport = makeTransport();
  await fixture.game.setGroupEnabled('group-onboarding@g.us', true);

  await fixture.controller.handle('duelo', ctx({
    transport, playerId: 'one@s.whatsapp.net', args: ['@two'], mentionedJids: ['two@s.whatsapp.net']
  }));
  const acceptContext = ctx({ transport, playerId: 'two@s.whatsapp.net', messageId: 'accept-fixed' });
  await fixture.controller.handle('aceitar', acceptContext);
  const imagesAfterFirst = transport.privateImages.length;
  await fixture.controller.handle('aceitar', acceptContext);
  assert.equal(transport.privateImages.length, imagesAfterFirst, 'reenvio com mesmo messageId não gera novas cenas');
  assert.match(transport.groupTexts.at(-1).text, /já foi processado/);
});
