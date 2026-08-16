import assert from 'node:assert/strict';
import test from 'node:test';

import Jimp from 'jimp';

import { TavernAssetRegistry } from '../rendering/TavernAssetRegistry.js';
import { VNextBoardRenderer } from '../rendering/VNextBoardRenderer.js';
import { VNextHandRenderer } from '../rendering/VNextHandRenderer.js';

const PLAYER = 'player-one';
const ENEMY = 'player-two';

class TrackingAssets extends TavernAssetRegistry {
  constructor() {
    super();
    this.requested = [];
  }

  image(key) {
    this.requested.push(key);
    return super.image(key);
  }
}

function minion(instanceId, overrides = {}) {
  return {
    instanceId,
    cardId: overrides.cardId || 'GY-001',
    name: overrides.name || 'Sentinela de Pedra',
    type: 'MINION',
    rarity: overrides.rarity || 'COMMON',
    cost: overrides.cost ?? 2,
    attack: overrides.attack ?? 2,
    health: overrides.health ?? 3,
    maxHealth: overrides.maxHealth ?? 3,
    keywords: overrides.keywords || ['GUARD'],
    effects: [],
    attacksThisTurn: overrides.attacksThisTurn ?? 0,
    canAttack: overrides.canAttack ?? true
  };
}

function state() {
  return {
    matchId: 'visual-vnext',
    version: 1,
    status: 'ACTIVE',
    phase: 'MAIN',
    playerOrder: [PLAYER, ENEMY],
    turn: {
      number: 2,
      activePlayerId: PLAYER,
      deadlineAt: '2026-08-13T20:10:00.000Z'
    },
    terrain: null,
    players: {
      [PLAYER]: {
        id: PLAYER,
        classId: 'GUARDIAN',
        hero: { hp: 29, maxHp: 30, armor: 2, powerCost: 2, powerUsed: false },
        mana: { current: 3, max: 3 },
        nextSpellDiscount: 0,
        hand: [minion('hand-1')],
        board: [minion('board-1')],
        deck: [minion('deck-1', { canAttack: false })]
      },
      [ENEMY]: {
        id: ENEMY,
        classId: 'EXILE',
        hero: { hp: 24, maxHp: 30, armor: 0, powerCost: 2, powerUsed: true },
        mana: { current: 0, max: 2 },
        nextSpellDiscount: 0,
        hand: [minion('enemy-hand', { canAttack: false })],
        board: [minion('enemy-board', { cardId: 'GY-027', name: 'Lobo da Bruma', keywords: ['RUSH'], canAttack: false })],
        deck: [minion('enemy-deck', { canAttack: false })]
      }
    }
  };
}

test('mão vNext gera PNG retrato 720x960 e consulta arte específica da carta', async () => {
  const assets = new TrackingAssets();
  const renderer = new VNextHandRenderer({ assets });
  const buffer = await renderer.render(state(), PLAYER);
  const image = await Jimp.read(buffer);

  assert.equal(image.bitmap.width, 720);
  assert.equal(image.bitmap.height, 960);
  assert.ok(assets.requested.includes('card.GY-001'));
  assert.ok(assets.requested.includes('frame.COMMON'));
  assert.ok(assets.requested.includes('keyword.GUARD'));
});

test('mesa vNext gera PNG 1200x940 e consulta artes das criaturas visíveis', async () => {
  const assets = new TrackingAssets();
  const renderer = new VNextBoardRenderer({
    assets,
    now: () => Date.parse('2026-08-13T20:09:30.000Z')
  });
  const buffer = await renderer.render(state(), {
    playerNames: { [PLAYER]: 'Jogador Um', [ENEMY]: 'Jogador Dois' }
  });
  const image = await Jimp.read(buffer);

  assert.equal(image.bitmap.width, 1200);
  assert.equal(image.bitmap.height, 940);
  assert.ok(assets.requested.includes('card.GY-001'));
  assert.ok(assets.requested.includes('card.GY-027'));
  assert.ok(assets.requested.includes('class.GUARDIAN'));
  assert.ok(assets.requested.includes('class.EXILE'));
});
