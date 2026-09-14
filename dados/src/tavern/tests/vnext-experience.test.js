import assert from 'node:assert/strict';
import test from 'node:test';

import { TavernVNextCommandController } from '../experience/TavernVNextCommandController.js';
import { cardIsPlayable } from '../rendering/VNextHandRenderer.js';

const PLAYER = 'player-one';
const ENEMY = 'player-two';

function makeState() {
  return {
    matchId: 'match-vnext',
    version: 2,
    status: 'ACTIVE',
    phase: 'MAIN',
    playerOrder: [PLAYER, ENEMY],
    turn: {
      number: 2,
      activePlayerId: PLAYER,
      deadlineAt: '2026-08-13T20:10:00.000Z'
    },
    mulligan: { responses: {} },
    players: {
      [PLAYER]: {
        id: PLAYER,
        classId: 'GUARDIAN',
        hero: { hp: 30, maxHp: 30, armor: 0, powerCost: 2, powerUsed: false },
        mana: { current: 3, max: 3 },
        nextSpellDiscount: 0,
        hand: [
          {
            instanceId: 'playable',
            cardId: 'GY-001',
            name: 'Sentinela de Pedra',
            type: 'MINION',
            cost: 2,
            attack: 2,
            health: 3,
            keywords: ['GUARD'],
            effects: []
          },
          {
            instanceId: 'expensive',
            cardId: 'GY-148',
            name: 'Dragão Carmesim',
            type: 'MINION',
            cost: 7,
            attack: 7,
            health: 7,
            keywords: ['RUSH'],
            effects: []
          }
        ],
        board: [],
        deck: []
      },
      [ENEMY]: {
        id: ENEMY,
        classId: 'GUARDIAN',
        hero: { hp: 30, maxHp: 30, armor: 0, powerCost: 2, powerUsed: false },
        mana: { current: 2, max: 2 },
        nextSpellDiscount: 0,
        hand: [{ name: 'Informação privada adversária' }],
        board: [],
        deck: []
      }
    }
  };
}

function makeGame({ groupEnabled = true, activeMatch = null, pendingChallenge = null } = {}) {
  return {
    now: () => Date.parse('2026-08-13T20:09:30.000Z'),
    getGroup: async () => groupEnabled
      ? { enabled: true, settings: { turnMode: 'NORMAL' } }
      : null,
    getPendingChallenge: async () => pendingChallenge,
    tavern: {
      heroRegistry: {
        get: () => ({
          name: 'Guardião',
          power: {
            cost: 2,
            requiresTarget: false,
            effects: [{ effect: 'GAIN_ARMOR', target: 'FRIENDLY_HERO', value: 2 }]
          }
        })
      },
      config: {
        defaults: { turnMode: 'NORMAL' },
        limits: { boardSize: 7 }
      },
      repository: {
        findActiveMatchForPlayer: async () => activeMatch
      }
    }
  };
}

function makeController(options = {}) {
  return new TavernVNextCommandController({
    game: options.game || makeGame(),
    boardRenderer: { render: async () => Buffer.from('board') },
    handRenderer: options.handRenderer || { render: async () => Buffer.from('hand') },
    rateLimiter: { consume() {} }
  });
}

function makeTransport() {
  return {
    groupTexts: [],
    privateTexts: [],
    privateImages: [],
    async sendGroupText(text, options = {}) {
      this.groupTexts.push({ text, options });
    },
    async sendPrivateText(playerId, text) {
      this.privateTexts.push({ playerId, text });
    },
    async sendPrivateImage(playerId, buffer, options = {}) {
      this.privateImages.push({ playerId, buffer, options });
    }
  };
}

test('home da mesa fechada apresenta uma única porta de entrada clara', async () => {
  const controller = makeController({ game: makeGame({ groupEnabled: false }) });
  const transport = makeTransport();

  await controller.sendTavernHome({
    chatId: 'group',
    playerId: PLAYER,
    prefix: '!',
    transport,
    isAdmin: true
  });

  const text = transport.groupTexts[0].text;
  assert.match(text, /tavern on/);
  assert.match(text, /tavern tutorial/);
  assert.doesNotMatch(text, /mulligan <|atacar <|poder \[/);
});

test('home durante partida não publica nomes da mão de nenhum jogador', async () => {
  const state = makeState();
  const controller = makeController({ game: makeGame({ activeMatch: { state } }) });
  const transport = makeTransport();

  await controller.sendTavernHome({
    chatId: 'group',
    playerId: PLAYER,
    prefix: '!',
    transport,
    isAdmin: false
  });

  const text = transport.groupTexts[0].text;
  assert.match(text, /É sua vez/);
  assert.match(text, /mão privada/i);
  assert.doesNotMatch(text, /Sentinela de Pedra|Dragão Carmesim|Informação privada adversária/);
});

test('caption privada orienta a jogada possível sem sugerir carta sem mana', () => {
  const state = makeState();
  const controller = makeController();
  const caption = controller.buildPrivateHandCaption(state, PLAYER, '!');

  assert.match(caption, /Sua vez/);
  assert.match(caption, /!jogar 1/);
  assert.match(caption, /Sentinela de Pedra/);
  assert.doesNotMatch(caption, /Dragão Carmesim/);
  assert.doesNotMatch(caption, /Informação privada adversária/);
});

test('falha do renderer mantém a mão no privado em fallback textual', async () => {
  const state = makeState();
  const controller = makeController({
    handRenderer: { render: async () => { throw new Error('renderer indisponível'); } }
  });
  const transport = makeTransport();

  const delivered = await controller.sendPrivateHand(state, PLAYER, transport, '!', { confirmDelivery: true });

  assert.equal(delivered, true);
  assert.equal(transport.privateTexts.length, 1);
  assert.match(transport.privateTexts[0].text, /Sentinela de Pedra/);
  assert.equal(transport.groupTexts.length, 1);
  assert.doesNotMatch(transport.groupTexts[0].text, /Sentinela de Pedra|Dragão Carmesim/);
});

test('regra visual de jogabilidade acompanha turno, mana e espaço de campo', () => {
  const state = makeState();
  const player = state.players[PLAYER];
  const cheap = player.hand[0];
  const expensive = player.hand[1];

  assert.equal(cardIsPlayable(state, player, cheap), true);
  assert.equal(cardIsPlayable(state, player, expensive), false);

  state.turn.activePlayerId = ENEMY;
  assert.equal(cardIsPlayable(state, player, cheap), false);

  state.turn.activePlayerId = PLAYER;
  player.board = Array.from({ length: 7 }, (_, index) => ({ instanceId: `slot-${index}` }));
  assert.equal(cardIsPlayable(state, player, cheap), false);
});
