import assert from 'node:assert/strict';
import test from 'node:test';

import Jimp from 'jimp';

import {
  VNextHandRenderer,
  fitTextToWidth,
  handPage
} from '../rendering/VNextHandRenderer.js';

const PLAYER = 'player-one';

function card(index, overrides = {}) {
  return {
    instanceId: `instance-${index}`,
    cardId: `GY-${String(index).padStart(3, '0')}`,
    name: index === 1
      ? 'Sentinela de Pedra com um nome deliberadamente comprido demais para a placa'
      : `Carta ${index}`,
    type: 'MINION',
    rarity: 'COMMON',
    cost: 2,
    attack: 2,
    health: 3,
    keywords: ['GUARD'],
    classId: 'GUARDIAN',
    text: 'Protege a mesa.',
    ...overrides
  };
}

function stateWithHand(count, overrides = {}) {
  return {
    status: 'ACTIVE',
    phase: 'MAIN',
    turn: { activePlayerId: PLAYER },
    players: {
      [PLAYER]: {
        id: PLAYER,
        classId: 'GUARDIAN',
        mana: { current: 10, max: 10 },
        nextSpellDiscount: 0,
        board: [],
        hand: Array.from({ length: count }, (_, index) => card(index + 1, overrides))
      }
    }
  };
}

class MinimalAssets {
  constructor() {
    this.requestedImages = [];
  }

  async font(size) {
    return Jimp.loadFont(size >= 32 ? Jimp.FONT_SANS_32_WHITE : Jimp.FONT_SANS_16_WHITE);
  }

  async image(key) {
    this.requestedImages.push(key);
    return null;
  }
}

test('paginação local limita cinco cartas e conserva índices globais', () => {
  const player = stateWithHand(10).players[PLAYER];
  assert.deepEqual(handPage(player, 1).entries.map(entry => entry.globalIndex), [1, 2, 3, 4, 5]);
  assert.deepEqual(handPage(player, 2).entries.map(entry => entry.globalIndex), [6, 7, 8, 9, 10]);
  assert.throws(() => handPage(player, 3), /Página inválida/);
});

test('nome local é truncado pela largura real em pixels', async () => {
  const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  const fitted = fitTextToWidth(font, 'Uma carta com um nome longo demais para o quadro', 120);
  assert.match(fitted, /\.\.\.$/);
  assert.ok(Jimp.measureText(font, fitted) <= 120);
});

test('chrome local não solicita frame de criatura para feitiço', async () => {
  const assets = new MinimalAssets();
  const renderer = new VNextHandRenderer({ assets });
  const output = await renderer.render(stateWithHand(1, {
    type: 'SPELL', attack: undefined, health: undefined, keywords: ['ARCANE']
  }), PLAYER);

  assert.equal(output.subarray(1, 4).toString(), 'PNG');
  assert.equal(assets.requestedImages.some(key => key.startsWith('frame.')), false);
});

test('página local dois contém a sexta carta e mantém moldura de criatura', async () => {
  const assets = new MinimalAssets();
  const renderer = new VNextHandRenderer({ assets });
  const output = await renderer.render(stateWithHand(6), PLAYER, { page: 2 });
  const image = await Jimp.read(output);

  assert.equal(output.subarray(1, 4).toString(), 'PNG');
  assert.deepEqual([image.bitmap.width, image.bitmap.height], [720, 960]);
  assert.equal(assets.requestedImages.includes('card.GY-006'), true);
  assert.equal(assets.requestedImages.includes('card.GY-001'), false);
  assert.equal(assets.requestedImages.some(key => key.startsWith('frame.')), true);
});
