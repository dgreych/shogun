import assert from 'node:assert/strict';
import test from 'node:test';

import Jimp from 'jimp';

import {
  VNextBoardRenderer,
  prepareBoardArt
} from '../rendering/VNextBoardRenderer.js';
import {
  calculateBoardLineLayout,
  truncateTextToPixelWidth
} from '../rendering/VNextLayoutV4.js';

const PLAYER = 'player-one';
const ENEMY = 'player-two';

function minion(index) {
  return {
    instanceId: `board-${index}`,
    cardId: index % 2 === 0 ? 'GY-001' : 'GY-027',
    name: `Sentinela Extraordinariamente Longa das Ruínas ${index + 1}`,
    type: 'MINION', rarity: 'COMMON', classId: 'GUARDIAN', cost: 2,
    attack: index + 2, health: index + 3, maxHealth: index + 3,
    keywords: index === 0 ? ['GUARD'] : [], effects: [],
    canAttack: index % 2 === 0, attacksThisTurn: 0
  };
}

function state(count) {
  const player = (id, classId, offset) => ({
    id, classId,
    hero: { hp: 29, maxHp: 30, armor: 4, powerCost: 2, powerUsed: false },
    mana: { current: 7, max: 8 }, nextSpellDiscount: 0,
    hand: [minion(20 + offset)],
    board: Array.from({ length: count }, (_, index) => minion(index + offset)),
    deck: [minion(30 + offset)]
  });
  return {
    matchId: 'board-v4', version: 1, status: 'ACTIVE', phase: 'MAIN',
    playerOrder: [PLAYER, ENEMY],
    turn: { number: 12, activePlayerId: PLAYER, deadlineAt: null },
    terrain: { card: { name: 'Salão das Sete Lanternas' } },
    players: {
      [PLAYER]: player(PLAYER, 'GUARDIAN', 0),
      [ENEMY]: player(ENEMY, 'EXILE', 7)
    }
  };
}

test('layout V4 centraliza de 1 a 7 cartas sem clipping nem sobreposição', () => {
  for (let count = 1; count <= 7; count += 1) {
    const layout = calculateBoardLineLayout(count, 154);
    const first = layout.cards[0];
    const last = layout.cards.at(-1);

    assert.ok(first.x >= layout.safeMargin);
    assert.ok(last.x + last.width <= layout.canvasWidth - layout.safeMargin);
    assert.ok(Math.abs(first.x - (layout.canvasWidth - layout.totalWidth) / 2) <= 1);
    for (let index = 1; index < layout.cards.length; index += 1) {
      assert.ok(layout.cards[index - 1].x + layout.cards[index - 1].width < layout.cards[index].x);
    }
  }
});

test('nomes usam largura raster e crop remove a moldura histórica', () => {
  const result = truncateTextToPixelWidth(
    'Dragão Carmesim do Horizonte Impossível',
    90,
    value => value.length * 10
  );
  assert.ok(result.endsWith('...'));
  assert.ok(result.length * 10 <= 90);

  const fullCard = new Jimp(744, 1039, 0x334455ff);
  const cropped = prepareBoardArt(fullCard, 'GY-001');
  assert.deepEqual([cropped.bitmap.width, cropped.bitmap.height], [594, 488]);
  assert.deepEqual([fullCard.bitmap.width, fullCard.bitmap.height], [744, 1039]);

  const normalized = new Jimp(665, 886, 0x334455ff);
  const untouched = prepareBoardArt(normalized, 'GY-002');
  assert.deepEqual([untouched.bitmap.width, untouched.bitmap.height], [665, 886]);

  const replacementPortrait = new Jimp(1024, 1024, 0x334455ff);
  const replacementUntouched = prepareBoardArt(replacementPortrait, 'GY-001');
  assert.deepEqual([replacementUntouched.bitmap.width, replacementUntouched.bitmap.height], [1024, 1024]);
});

test('renderer V4 rasteriza duas linhas completas de sete cartas dentro de 1200x940', async () => {
  const renderer = new VNextBoardRenderer({ now: () => Date.parse('2026-08-15T18:00:00-03:00') });
  const output = await renderer.render(state(7), {
    playerNames: { [PLAYER]: 'Jogadora das Tempestades', [ENEMY]: 'Adversário do Véu' }
  });
  const image = await Jimp.read(output);
  const layout = calculateBoardLineLayout(7, 544);
  const rightmost = layout.cards.at(-1);

  assert.equal(image.bitmap.width, 1200);
  assert.equal(image.bitmap.height, 940);
  assert.ok(rightmost.x + rightmost.width < image.bitmap.width);
  assert.notEqual(image.getPixelColor(rightmost.x + rightmost.width - 8, 544 + 200), 0x00000000);
});
