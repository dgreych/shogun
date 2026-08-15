import Jimp from 'jimp';

import { TavernValidationError } from '../errors.js';
import { TavernAssetRegistry } from './TavernAssetRegistry.js';

const WIDTH = 1200;
const HEIGHT = 820;
const HAND_WIDTH = WIDTH;
const HAND_HEIGHT = HEIGHT;

const RARITY_COLORS = Object.freeze({
  COMMON: 0xb8c2ccff,
  RARE: 0x3d9df2ff,
  EPIC: 0xa352e8ff,
  LEGENDARY: 0xf29a28ff
});

const KEYWORD_LABELS = Object.freeze({
  GUARD: 'GUARDA',
  RUSH: 'ÍMPETO',
  DEATHRATTLE: 'ÚLTIMO SUSPIRO',
  ON_PLAY: 'APARIÇÃO',
  BLEED: 'SANGRIA',
  BOND: 'VÍNCULO',
  AMBUSH: 'EMBOSCADA',
  FRENZY: 'FRENESI'
});

function shortText(value, max = 24) {
  const text = String(value || 'Carta');
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function drawCardSurface(canvas, x, y, width, height, accent, playable) {
  canvas.composite(new Jimp(width + 8, height + 8, 0x00000088), x + 5, y + 6);
  canvas.composite(new Jimp(width, height, playable ? 0xf2bd4cff : accent), x, y);
  canvas.composite(new Jimp(width - 4, height - 4, 0x0b0910ff), x + 2, y + 2);
}

class HandRenderer {
  constructor({ assets = new TavernAssetRegistry() } = {}) {
    this.assets = assets;
  }

  async render(state, playerId) {
    const player = state?.players?.[playerId];
    if (!player) throw new TavernValidationError('Jogador não encontrado para renderizar a mão');
    const [font16, font32] = await Promise.all([
      this.assets.font(16),
      this.assets.font(32)
    ]);
    const background = await this.assets.image('background.hand');
    const canvas = background
      ? background.cover(WIDTH, HEIGHT)
      : new Jimp(WIDTH, HEIGHT, 0x171321ff);
    canvas.composite(new Jimp(WIDTH, HEIGHT, 0x00000022), 0, 0);
    canvas.composite(new Jimp(WIDTH - 56, 82, 0x08060cbb), 28, 12);
    canvas.print(font32, 42, 21, 'SUA MÃO', WIDTH - 84, 40);
    canvas.print(
      font16,
      44,
      62,
      `${player.hand.length} carta(s)  |  use !jogar <número>`,
      570,
      24
    );
    const manaIcon = await this.assets.image('resource.mana');
    if (manaIcon) canvas.composite(manaIcon.contain(42, 42), 1000, 30);
    canvas.print(font32, 1048, 35, `${player.mana.current}/${player.mana.max}`, 110, 40);

    const columns = 5;
    const cardWidth = 210;
    const cardHeight = 310;
    const gapX = 22;
    const gapY = 24;
    const startY = 120;

    for (let index = 0; index < player.hand.length; index += 1) {
      const card = player.hand[index];
      const column = index % columns;
      const row = Math.floor(index / columns);
      const cardsInRow = Math.min(columns, player.hand.length - row * columns);
      const rowWidth = cardsInRow * cardWidth + Math.max(0, cardsInRow - 1) * gapX;
      const rowStartX = Math.floor((WIDTH - rowWidth) / 2);
      const x = rowStartX + column * (cardWidth + gapX);
      const y = startY + row * (cardHeight + gapY);
      const playable = card.cost <= player.mana.current && state.phase === 'MAIN';
      const rarity = card.rarity || 'COMMON';
      const accent = RARITY_COLORS[rarity] || RARITY_COLORS.COMMON;
      drawCardSurface(canvas, x, y, cardWidth, cardHeight, accent, playable);

      const [cardTexture, classIcon, frame] = await Promise.all([
        this.assets.image('card.back'),
        this.assets.image(`class.${player.classId}`),
        this.assets.image(`frame.${rarity}`)
      ]);
      if (cardTexture) {
        canvas.composite(cardTexture.cover(cardWidth - 18, 132).opacity(0.58), x + 9, y + 43);
      }
      canvas.composite(new Jimp(cardWidth - 18, 132, 0x08060c55), x + 9, y + 43);
      if (classIcon) canvas.composite(classIcon.contain(78, 78).opacity(0.84), x + 66, y + 68);
      if (frame) canvas.composite(frame.resize(cardWidth, cardHeight).opacity(0.88), x, y);

      canvas.composite(new Jimp(cardWidth - 16, 38, 0x050408e8), x + 8, y + 6);
      canvas.composite(new Jimp(44, 42, 0x256dbdff), x + 7, y + 4);
      canvas.composite(new Jimp(40, 36, 0x5e3c18ff), x + cardWidth - 47, y + 7);
      canvas.print(font32, x + 15, y + 8, `${card.cost}`, 32, 34);
      canvas.print(font16, x + cardWidth - 42, y + 16, `${index + 1}`, 32, 22);

      canvas.composite(new Jimp(cardWidth - 18, 39, 0x09070de8), x + 9, y + 165);
      canvas.print(font16, x + 13, y + 175, {
        text: shortText(card.name, 20),
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
      }, cardWidth - 26, 24);
      const keyword = card.keywords?.[0] ? KEYWORD_LABELS[card.keywords[0]] : null;
      if (keyword) canvas.print(font16, x + 13, y + 208, keyword, cardWidth - 26, 22);
      canvas.print(font16, x + 13, y + (keyword ? 232 : 214), shortText(card.text, 52), cardWidth - 26, 44);

      if (card.type === 'MINION') {
        canvas.composite(new Jimp(58, 36, 0xa34c20ff), x + 9, y + cardHeight - 45);
        canvas.composite(new Jimp(58, 36, 0xa22235ff), x + cardWidth - 67, y + cardHeight - 45);
        canvas.print(font16, x + 14, y + cardHeight - 37, `ATQ ${card.attack}`, 50, 22);
        canvas.print(font16, x + cardWidth - 59, y + cardHeight - 37, `HP ${card.health}`, 50, 22);
      } else {
        canvas.print(font16, x + 13, y + cardHeight - 37, 'MAGIA', cardWidth - 26, 22);
      }
    }
    canvas.composite(new Jimp(WIDTH - 72, 38, 0x08060cbb), 36, HEIGHT - 45);
    canvas.print(font16, 48, HEIGHT - 36, {
      text: state.phase === 'MULLIGAN'
        ? 'Preparação: !mulligan manter ou !mulligan 1,3'
        : 'Dourado = jogável agora  |  a mão só aparece no privado',
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
    }, WIDTH - 96, 22);
    return canvas.getBufferAsync(Jimp.MIME_PNG);
  }
}

export { HAND_HEIGHT, HAND_WIDTH, HandRenderer };
