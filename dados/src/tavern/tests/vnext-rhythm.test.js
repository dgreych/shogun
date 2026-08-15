import assert from 'node:assert/strict';
import test from 'node:test';

import { TavernEventNarrator, publicResults } from '../experience/TavernEventNarrator.js';
import { TavernVNextRhythmController } from '../experience/TavernVNextRhythmController.js';

const PLAYER = 'player-one';
const ENEMY = 'player-two';

function makeState() {
  return {
    matchId: 'rhythm-match',
    version: 3,
    status: 'ACTIVE',
    phase: 'MAIN',
    playerOrder: [PLAYER, ENEMY],
    turn: {
      number: 4,
      activePlayerId: PLAYER,
      deadlineAt: '2026-08-13T21:00:00.000Z'
    },
    terrain: null,
    mulligan: { responses: {} },
    players: {
      [PLAYER]: {
        id: PLAYER,
        classId: 'GUARDIAN',
        hero: { hp: 30, maxHp: 30, armor: 0, powerCost: 2, powerUsed: false },
        mana: { current: 2, max: 4 },
        nextSpellDiscount: 0,
        hand: [],
        board: [{
          instanceId: 'attacker',
          cardId: 'GY-001',
          name: 'Sentinela de Pedra',
          type: 'MINION',
          rarity: 'COMMON',
          attack: 2,
          health: 3,
          keywords: ['GUARD'],
          attacksThisTurn: 1,
          canAttack: false
        }],
        graveyard: [],
        deck: []
      },
      [ENEMY]: {
        id: ENEMY,
        classId: 'EXILE',
        hero: { hp: 28, maxHp: 30, armor: 0, powerCost: 2, powerUsed: false },
        mana: { current: 0, max: 3 },
        nextSpellDiscount: 0,
        hand: [{ name: 'Mão que não pode aparecer' }],
        board: [],
        graveyard: [],
        deck: []
      }
    }
  };
}

const cardRegistry = {
  get(id) {
    const names = {
      'GY-001': 'Sentinela de Pedra',
      'GY-027': 'Lobo da Bruma'
    };
    return { id, name: names[id] || id };
  }
};

test('narrador elimina eventos privados antes de construir saída pública', () => {
  const event = {
    type: 'PLAY_CARD',
    actorId: PLAYER,
    results: [
      { type: 'CARD_DRAWN', playerId: PLAYER, cardId: 'GY-027', private: true },
      { type: 'CARD_PLAYED', playerId: PLAYER, cardId: 'GY-001' }
    ]
  };

  assert.deepEqual(publicResults(event), [
    { type: 'CARD_PLAYED', playerId: PLAYER, cardId: 'GY-001' }
  ]);
  const narration = new TavernEventNarrator({ cardRegistry }).narrate(event, makeState());
  assert.match(narration.text, /Sentinela de Pedra/);
  assert.doesNotMatch(narration.text, /Lobo da Bruma/);
});

test('ataque simples usa narrativa compacta sem exigir novo board', () => {
  const event = {
    type: 'ATTACK',
    actorId: PLAYER,
    results: [
      { type: 'ATTACK_DECLARED', playerId: PLAYER, source: 'attacker', target: ENEMY },
      { type: 'HERO_DAMAGED', playerId: ENEMY, value: 2, absorbed: 0 }
    ]
  };
  const narration = new TavernEventNarrator({ cardRegistry }).narrate(event, makeState());

  assert.equal(narration.renderBoard, false);
  assert.match(narration.text, /Sentinela de Pedra/);
  assert.match(narration.text, /2.*dano/);
});

test('morte, fim de turno e encerramento exigem atualização visual da mesa', () => {
  const narrator = new TavernEventNarrator({ cardRegistry });
  const death = narrator.narrate({
    type: 'ATTACK',
    actorId: PLAYER,
    results: [{ type: 'MINION_DIED', playerId: ENEMY, cardId: 'GY-027', instanceId: 'dead' }]
  }, makeState());
  assert.equal(death.renderBoard, true);

  const nextState = makeState();
  nextState.turn.activePlayerId = ENEMY;
  const end = narrator.narrate({
    type: 'END_TURN',
    actorId: PLAYER,
    results: [{ type: 'TURN_STARTED', playerId: ENEMY, turn: 5 }]
  }, nextState);
  assert.equal(end.renderBoard, true);
  assert.equal(end.refreshActiveHand, true);

  const finished = makeState();
  finished.status = 'FINISHED';
  finished.winnerId = PLAYER;
  const finish = narrator.narrate({
    type: 'ATTACK',
    actorId: PLAYER,
    results: [{ type: 'MATCH_FINISHED', winnerId: PLAYER, reason: 'HERO_DEFEATED' }]
  }, finished);
  assert.equal(finish.renderBoard, true);
});

function makeTransport() {
  return {
    groupTexts: [],
    groupImages: [],
    privateTexts: [],
    privateImages: [],
    async sendGroupText(text, options = {}) { this.groupTexts.push({ text, options }); },
    async sendGroupImage(buffer, options = {}) { this.groupImages.push({ buffer, options }); },
    async sendPrivateText(playerId, text) { this.privateTexts.push({ playerId, text }); },
    async sendPrivateImage(playerId, buffer, options = {}) { this.privateImages.push({ playerId, buffer, options }); }
  };
}

function makeController() {
  const game = {
    now: () => Date.parse('2026-08-13T20:59:20.000Z'),
    getPlayerNames: async () => ({ [PLAYER]: 'Jogador Um', [ENEMY]: 'Jogador Dois' }),
    tavern: {
      cardRegistry,
      heroRegistry: {
        get: () => ({ name: 'Guardião', power: { cost: 2, requiresTarget: false, effects: [] } })
      },
      config: { limits: { boardSize: 7 }, defaults: { turnMode: 'NORMAL' } },
      repository: {}
    }
  };
  return new TavernVNextRhythmController({
    game,
    boardRenderer: { render: async () => Buffer.from('board-vnext') },
    handRenderer: { render: async () => Buffer.from('hand-vnext') },
    rateLimiter: { consume() {} }
  });
}

test('afterAction de ataque simples narra no grupo e manda opções restantes só no privado', async () => {
  const controller = makeController();
  const transport = makeTransport();
  const state = makeState();
  const result = {
    duplicate: false,
    state,
    event: {
      type: 'ATTACK',
      actorId: PLAYER,
      results: [
        { type: 'ATTACK_DECLARED', playerId: PLAYER, source: 'attacker', target: ENEMY },
        { type: 'HERO_DAMAGED', playerId: ENEMY, value: 2, absorbed: 0 }
      ]
    }
  };

  await controller.afterAction(result, {
    transport,
    prefix: '!',
    playerId: PLAYER
  });

  assert.equal(transport.groupImages.length, 0);
  assert.equal(transport.groupTexts.length, 1);
  assert.equal(transport.privateTexts.length, 1);
  assert.doesNotMatch(transport.groupTexts[0].text, /Mão que não pode aparecer/);
});

test('afterAction com morte renderiza mesa pública', async () => {
  const controller = makeController();
  const transport = makeTransport();
  const state = makeState();
  state.players[ENEMY].graveyard.push({ cardId: 'GY-027', instanceId: 'dead', reason: 'DESTROYED' });
  const result = {
    duplicate: false,
    state,
    event: {
      type: 'ATTACK',
      actorId: PLAYER,
      results: [
        { type: 'ATTACK_DECLARED', playerId: PLAYER, source: 'attacker', target: 'dead' },
        { type: 'MINION_DIED', playerId: ENEMY, cardId: 'GY-027', instanceId: 'dead' }
      ]
    }
  };

  await controller.afterAction(result, { transport, prefix: '!', playerId: PLAYER });

  assert.equal(transport.groupImages.length, 1);
  assert.match(transport.groupImages[0].options.caption, /Lobo da Bruma/);
});
