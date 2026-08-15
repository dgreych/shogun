import assert from 'node:assert/strict';
import test from 'node:test';

import { TavernExperienceAdvisor } from '../experience/TavernExperienceAdvisor.js';

const PLAYER = 'player-one';
const ENEMY = 'player-two';
let sequence = 0;

function card(overrides = {}) {
  sequence += 1;
  return {
    instanceId: overrides.instanceId || `instance-${sequence}`,
    cardId: overrides.cardId || 'GY-001',
    name: overrides.name || 'Sentinela de Pedra',
    type: overrides.type || 'MINION',
    cost: overrides.cost ?? 2,
    attack: overrides.attack ?? 2,
    health: overrides.health ?? 3,
    keywords: overrides.keywords || [],
    effects: overrides.effects || [],
    attacksThisTurn: overrides.attacksThisTurn ?? 0,
    canAttack: overrides.canAttack ?? false,
    collectible: overrides.collectible
  };
}

function makeState() {
  return {
    matchId: 'match-1',
    version: 4,
    status: 'ACTIVE',
    phase: 'MAIN',
    playerOrder: [PLAYER, ENEMY],
    turn: {
      number: 3,
      activePlayerId: PLAYER,
      deadlineAt: '2026-08-13T20:05:00.000Z'
    },
    mulligan: { responses: {} },
    players: {
      [PLAYER]: {
        classId: 'GUARDIAN',
        hero: { powerCost: 2, powerUsed: false },
        mana: { current: 3, max: 3 },
        nextSpellDiscount: 0,
        hand: [],
        board: []
      },
      [ENEMY]: {
        classId: 'GUARDIAN',
        hero: { powerCost: 2, powerUsed: false },
        mana: { current: 3, max: 3 },
        hand: [],
        board: []
      }
    }
  };
}

const heroRegistry = {
  get(classId) {
    return {
      id: classId,
      name: 'Guardião',
      power: {
        cost: 2,
        requiresTarget: false,
        effects: [{ effect: 'GAIN_ARMOR', target: 'FRIENDLY_HERO', value: 2 }]
      }
    };
  }
};

const now = () => Date.parse('2026-08-13T20:04:10.000Z');
const advisor = () => new TavernExperienceAdvisor({ heroRegistry, now, limits: { boardSize: 7 } });

test('orienta o jogador ativo somente com ações cabíveis no estado', () => {
  const state = makeState();
  state.players[PLAYER].hand = [
    card({ instanceId: 'cheap', name: 'Lobo da Bruma', cost: 2 }),
    card({ instanceId: 'expensive', name: 'Dragão Carmesim', cost: 7 }),
    card({ instanceId: 'spell', name: 'Sopro Restaurador', type: 'SPELL', cost: 2 })
  ];
  state.players[PLAYER].board = [card({ instanceId: 'ready', name: 'Vigilante', canAttack: true })];

  const result = advisor().analyze(state, PLAYER, { prefix: '!' });

  assert.equal(result.isActivePlayer, true);
  assert.equal(result.secondsRemaining, 50);
  assert.deepEqual(result.playableCards.map(item => item.instanceId), ['cheap', 'spell']);
  assert.equal(result.attackers.length, 1);
  assert.equal(result.heroPower.available, true);
  assert.ok(result.nextActions.some(action => action.command === '!jogar 1'));
  assert.ok(result.nextActions.some(action => action.command === '!poder'));
  assert.ok(result.nextActions.some(action => action.command === '!fim'));
});

test('Guarda restringe alvos sugeridos ao defensor obrigatório', () => {
  const state = makeState();
  state.players[PLAYER].board = [card({ instanceId: 'attacker', canAttack: true })];
  state.players[ENEMY].board = [
    card({ instanceId: 'guard', name: 'Muralha Rúnica', keywords: ['GUARD'] }),
    card({ instanceId: 'free', name: 'Corvo das Ruínas' })
  ];
  state.players[ENEMY].hand = [card({ instanceId: 'hidden', name: 'Carta Privada' })];

  const result = advisor().analyze(state, PLAYER);
  const targets = result.attackers[0].targets;

  assert.equal(targets.length, 1);
  assert.equal(targets[0].instanceId, 'guard');
  assert.equal(JSON.stringify(result).includes('Carta Privada'), false);
  assert.equal(targets.some(target => target.kind === 'HERO'), false);
});

test('fora do turno não oferece ações ilegais', () => {
  const state = makeState();
  state.turn.activePlayerId = ENEMY;
  state.players[PLAYER].hand = [card({ cost: 1 })];
  state.players[PLAYER].board = [card({ canAttack: true })];

  const result = advisor().analyze(state, PLAYER, { prefix: '?' });

  assert.equal(result.isActivePlayer, false);
  assert.equal(result.playableCards.length, 0);
  assert.equal(result.attackers.length, 0);
  assert.equal(result.heroPower.available, false);
  assert.deepEqual(result.nextActions.map(action => action.command), ['?campo']);
});

test('mulligan vira decisão simples e ignora carta não colecionável', () => {
  const state = makeState();
  state.phase = 'MULLIGAN';
  state.players[PLAYER].hand = [
    card({ instanceId: 'one', collectible: true }),
    card({ instanceId: 'spark', name: 'Centelha de Iniciativa', type: 'SPELL', cost: 0, collectible: false })
  ];

  const result = advisor().analyze(state, PLAYER, { prefix: '!' });

  assert.equal(result.mulligan.alreadyConfirmed, false);
  assert.deepEqual(result.mulligan.exchangeable.map(item => item.instanceId), ['one']);
  assert.ok(result.nextActions.some(action => action.command === '!mulligan manter'));
});

test('campo cheio bloqueia criatura e poder que invoca', () => {
  const summonHeroRegistry = {
    get() {
      return {
        name: 'Xamã',
        power: {
          cost: 2,
          requiresTarget: false,
          effects: [{ effect: 'SUMMON_RANDOM', target: 'FRIENDLY_BOARD' }]
        }
      };
    }
  };
  const state = makeState();
  state.players[PLAYER].classId = 'SHAMAN';
  state.players[PLAYER].hand = [
    card({ instanceId: 'minion', type: 'MINION', cost: 1 }),
    card({ instanceId: 'spell', type: 'SPELL', cost: 1 })
  ];
  state.players[PLAYER].board = Array.from({ length: 7 }, (_, index) => card({ instanceId: `board-${index}` }));

  const result = new TavernExperienceAdvisor({
    heroRegistry: summonHeroRegistry,
    now,
    limits: { boardSize: 7 }
  }).analyze(state, PLAYER);

  assert.deepEqual(result.playableCards.map(item => item.instanceId), ['spell']);
  assert.equal(result.heroPower.available, false);
  assert.equal(result.heroPower.reason, 'Campo cheio');
});

test('partida encerrada não oferece novas ações', () => {
  const state = makeState();
  state.status = 'FINISHED';
  state.winnerId = PLAYER;
  state.finishReason = 'HERO_DEFEATED';

  const result = advisor().analyze(state, PLAYER);

  assert.equal(result.summary, 'Você venceu a partida.');
  assert.deepEqual(result.nextActions, [{ type: 'INFO', label: 'o herói foi derrotado' }]);
});
