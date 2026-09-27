import assert from 'node:assert/strict';
import test from 'node:test';

import { BOT_INTRO_CLASSES, chooseAction, chooseMulliganDiscards, pickRandomIntroClass } from '../domain/TavernBotPlayer.js';

function minion(overrides = {}) {
  return {
    instanceId: 'm1', cardId: 'GY-X', name: 'Minion', type: 'MINION',
    cost: 2, attack: 2, health: 2, keywords: [], canAttack: true, attacksThisTurn: 0,
    ...overrides
  };
}

function baseState(overrides = {}) {
  return {
    playerOrder: ['bot', 'human'],
    players: {
      bot: {
        id: 'bot', classId: 'GUARDIAN',
        hero: { hp: 30, maxHp: 30, armor: 0, powerUsed: false, powerCost: 2 },
        mana: { current: 3, max: 3 }, nextSpellDiscount: 0,
        hand: [], board: [], deck: []
      },
      human: {
        id: 'human', classId: 'EXILE',
        hero: { hp: 30, maxHp: 30, armor: 0, powerUsed: false, powerCost: 2 },
        mana: { current: 3, max: 3 }, nextSpellDiscount: 0,
        hand: [], board: [], deck: []
      }
    },
    ...overrides
  };
}

test('pickRandomIntroClass sempre devolve uma das três classes introdutórias', () => {
  for (const value of [0, 0.33, 0.66, 0.99]) {
    const classId = pickRandomIntroClass(() => value);
    assert.ok(BOT_INTRO_CLASSES.includes(classId));
  }
});

test('mulligan descarta apenas cartas de custo acima do limiar', () => {
  const hand = [
    { instanceId: 'a', cost: 2, collectible: true },
    { instanceId: 'b', cost: 5, collectible: true },
    { instanceId: 'c', cost: 6, collectible: true },
    { instanceId: 'd', cost: 1, collectible: false }
  ];
  assert.deepEqual(chooseMulliganDiscards(hand), ['b', 'c']);
});

test('vai para o lethal quando o ataque disponível mata o herói inimigo sem Guarda', () => {
  const state = baseState();
  state.players.bot.board = [minion({ instanceId: 'atk1', attack: 30, health: 3 })];
  state.players.human.hero.hp = 10;
  const action = chooseAction(state, 'bot', () => 0.5);
  assert.equal(action.type, 'ATTACK');
  assert.equal(action.target.kind, 'HERO');
});

test('respeita Guarda: ataque obrigatoriamente mira o Guarda de menor vida, não o herói', () => {
  const state = baseState();
  state.players.bot.board = [minion({ instanceId: 'atk1', attack: 3, health: 3 })];
  state.players.human.board = [
    minion({ instanceId: 'g1', keywords: ['GUARD'], health: 5, attack: 1 }),
    minion({ instanceId: 'g2', keywords: ['GUARD'], health: 2, attack: 1 })
  ];
  const action = chooseAction(state, 'bot', () => 0.99);
  assert.equal(action.type, 'ATTACK');
  assert.equal(action.target.instanceId, 'g2');
});

test('joga a carta afordável mais impactante disponível em vez de passar o turno à toa', () => {
  const state = baseState();
  state.players.bot.hand = [
    { instanceId: 'cheap', cardId: 'GY-C', type: 'MINION', cost: 1, attack: 1, health: 1, effects: [] },
    { instanceId: 'costly', cardId: 'GY-D', type: 'MINION', cost: 3, attack: 3, health: 3, effects: [] }
  ];
  const action = chooseAction(state, 'bot', () => 0);
  assert.equal(action.type, 'PLAY_CARD');
  assert.equal(action.card, 'costly');
});

test('carta de dano com alvo obrigatório mira criatura inimiga que ela consegue matar', () => {
  const state = baseState();
  state.players.bot.hand = [{
    instanceId: 'bolt', cardId: 'GY-BOLT', type: 'SPELL', cost: 2,
    effects: [{ trigger: 'ON_PLAY', effect: 'DAMAGE', target: 'TARGET', value: 3 }]
  }];
  state.players.human.board = [
    minion({ instanceId: 'big', health: 8, attack: 5 }),
    minion({ instanceId: 'small', health: 2, attack: 1 })
  ];
  const action = chooseAction(state, 'bot', () => 0);
  assert.equal(action.type, 'PLAY_CARD');
  assert.equal(action.target.kind, 'MINION');
  assert.equal(action.target.instanceId, 'small');
});

test('sem nada mais pra fazer, usa o poder de herói antes de passar o turno', () => {
  const state = baseState();
  const action = chooseAction(state, 'bot', () => 0.5);
  assert.equal(action.type, 'HERO_POWER');
});

test('poder de herói já usado e mão vazia sem campo: passa o turno', () => {
  const state = baseState();
  state.players.bot.hero.powerUsed = true;
  const action = chooseAction(state, 'bot', () => 0.5);
  assert.equal(action.type, 'END_TURN');
});
