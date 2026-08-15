import Jimp from 'jimp';

import { TavernValidationError } from '../errors.js';
import { TavernAssetRegistry } from './TavernAssetRegistry.js';

const WIDTH = 1200;
const HEIGHT = 675;

const CLASS_LABELS = Object.freeze({
  GUARDIAN: 'GUARDIÃO',
  EXILE: 'EXILADO',
  ORACLE: 'ORÁCULO',
  SHAMAN: 'XAMÃ',
  PROFANE: 'PROFANO',
  STORM: 'TEMPESTADE'
});

const RARITY_COLORS = Object.freeze({
  COMMON: 0xb8c2ccff,
  RARE: 0x3d9df2ff,
  EPIC: 0xa352e8ff,
  LEGENDARY: 0xf29a28ff
});

function shortText(value, max = 20) {
  const text = String(value || 'Aventureiro');
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function keywordLabel(keywords = []) {
  const labels = {
    GUARD: 'G',
    RUSH: 'I',
    DEATHRATTLE: 'U',
    ON_PLAY: 'A',
    BLEED: 'S',
    BOND: 'V',
    AMBUSH: 'E',
    FRENZY: 'F'
  };
  return keywords.map(keyword => labels[keyword]).filter(Boolean).join(' ');
}

function statText(value) {
  return String(Math.max(0, Number(value) || 0));
}

function drawLayeredPanel(canvas, x, y, width, height, accent, active = false) {
  canvas.composite(new Jimp(width + 8, height + 8, 0x00000088), x + 5, y + 6);
  canvas.composite(new Jimp(width, height, active ? accent : 0x3b3342ff), x, y);
  canvas.composite(new Jimp(width - 4, height - 4, 0x08070cdc), x + 2, y + 2);
  canvas.composite(new Jimp(width - 12, height - 12, 0x15121dcc), x + 6, y + 6);
}

class BoardRenderer {
  constructor({ assets = new TavernAssetRegistry(), now = () => Date.now() } = {}) {
    this.assets = assets;
    this.now = now;
  }

  async createBackground() {
    const asset = await this.assets.image('background.board');
    if (asset) return asset.cover(WIDTH, HEIGHT);
    const image = new Jimp(WIDTH, HEIGHT, 0x171321ff);
    image.composite(new Jimp(WIDTH, 215, 0x302640ff), 0, 0);
    image.composite(new Jimp(WIDTH, 215, 0x182c3cff), 0, 460);
    return image;
  }

  async render(state, { playerNames = {} } = {}) {
    if (!state?.players || !Array.isArray(state.playerOrder)) {
      throw new TavernValidationError('Estado inválido para renderizar o campo');
    }

    const [firstId, secondId] = state.playerOrder;
    const topId = secondId;
    const bottomId = firstId;
    const [font16, font32] = await Promise.all([
      this.assets.font(16),
      this.assets.font(32)
    ]);
    const canvas = await this.createBackground();
    canvas.composite(new Jimp(WIDTH, HEIGHT, 0x00000022), 0, 0);

    const title = state.status === 'FINISHED'
      ? 'GYOMEI TAVERN - PARTIDA ENCERRADA'
      : `GYOMEI TAVERN - TURNO ${state.turn.number}`;
    canvas.print(font32, 28, 12, { text: title, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, WIDTH - 56, 42);

    await this.drawHero(canvas, state, topId, playerNames[topId], 54, font16, font32);
    await this.drawBoard(canvas, state.players[topId].board, 158, font16, font32);

    const terrain = state.terrain?.card?.name || 'Sem terreno ativo';
    const deadline = state.turn.deadlineAt
      ? Math.max(0, Math.ceil((Date.parse(state.turn.deadlineAt) - this.now()) / 1000))
      : 0;
    drawLayeredPanel(canvas, 220, 311, 760, 44, 0x8155b8ff, false);
    canvas.print(font16, 235, 323, {
      text: `${terrain} | ${state.phase === 'MULLIGAN' ? 'Preparação' : `Prazo: ${deadline}s`}`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
    }, 730, 24);

    await this.drawBoard(canvas, state.players[bottomId].board, 371, font16, font32);
    await this.drawHero(canvas, state, bottomId, playerNames[bottomId], 526, font16, font32);
    return canvas.getBufferAsync(Jimp.MIME_PNG);
  }

  async drawHero(canvas, state, playerId, displayName, y, font16, font32) {
    const player = state.players[playerId];
    const active = state.status === 'ACTIVE' && state.turn.activePlayerId === playerId;
    const accent = active ? 0xd89a2aff : 0x765197ff;
    drawLayeredPanel(canvas, 30, y, 1140, 92, accent, active);

    const [classIcon, healthIcon, armorIcon, manaIcon, cardBack, panelFrame] = await Promise.all([
      this.assets.image(`class.${player.classId}`),
      this.assets.image('resource.health'),
      this.assets.image('resource.armor'),
      this.assets.image('resource.mana'),
      this.assets.image('card.back'),
      this.assets.image(active ? 'panel.gold' : 'panel.purple')
    ]);
    if (panelFrame) canvas.composite(panelFrame.resize(1140, 92).opacity(0.78), 30, y);
    if (classIcon) canvas.composite(classIcon.contain(72, 72), 42, y + 10);
    canvas.print(font32, 126, y + 8, shortText(displayName, 25), 410, 40);
    canvas.print(
      font16,
      128,
      y + 54,
      `${CLASS_LABELS[player.classId] || player.classId}${active ? '  |  SUA VEZ' : ''}`,
      405,
      22
    );

    if (healthIcon) canvas.composite(healthIcon.contain(38, 38), 548, y + 10);
    canvas.print(font32, 590, y + 12, `${statText(player.hero.hp)}/${statText(player.hero.maxHp)}`, 150, 38);
    if (armorIcon) canvas.composite(armorIcon.contain(30, 30), 552, y + 54);
    canvas.print(font16, 590, y + 58, `Armadura ${statText(player.hero.armor)}`, 150, 22);

    if (manaIcon) canvas.composite(manaIcon.contain(38, 38), 750, y + 10);
    canvas.print(font32, 793, y + 12, `${statText(player.mana.current)}/${statText(player.mana.max)}`, 130, 38);
    canvas.print(font16, 753, y + 58, `Poder ${player.hero.powerUsed ? 'usado' : `${player.hero.powerCost} mana`}`, 174, 22);

    if (cardBack) canvas.composite(cardBack.cover(42, 60), 941, y + 16);
    canvas.print(font32, 992, y + 11, `${player.hand.length}`, 60, 38);
    canvas.print(font16, 992, y + 55, `mão`, 62, 22);
    canvas.print(font32, 1061, y + 11, `${player.deck.length}`, 70, 38);
    canvas.print(font16, 1058, y + 55, `deck`, 72, 22);
  }

  async drawBoard(canvas, cards, y, font16, font32) {
    const cardWidth = 142;
    const cardHeight = 140;
    const gap = 12;
    const totalWidth = cards.length * cardWidth + Math.max(0, cards.length - 1) * gap;
    let x = Math.max(30, Math.floor((WIDTH - totalWidth) / 2));
    if (!cards.length) {
      canvas.composite(new Jimp(420, 2, 0x8b6a3d77), 390, y + 68);
      canvas.print(font16, 0, y + 55, {
        text: 'CAMPO VAZIO',
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
      }, WIDTH, 24);
      return;
    }

    for (const [index, card] of cards.entries()) {
      const canAttack = card.canAttack && card.attacksThisTurn < 1;
      const accent = canAttack ? 0xe3a43fff : (RARITY_COLORS[card.rarity] || RARITY_COLORS.COMMON);
      drawLayeredPanel(canvas, x, y, cardWidth, cardHeight, accent, true);
      const keywordIcon = card.keywords?.[0]
        ? await this.assets.image(`keyword.${card.keywords[0]}`)
        : null;
      if (keywordIcon) canvas.composite(keywordIcon.contain(42, 42).opacity(0.9), x + 50, y + 48);
      canvas.composite(new Jimp(cardWidth - 12, 38, 0x050408dd), x + 6, y + 6);
      canvas.print(font16, x + 9, y + 10, `${index + 1}. ${shortText(card.name, 15)}`, cardWidth - 18, 28);
      canvas.composite(new Jimp(48, 32, 0xa94c22ee), x + 8, y + 97);
      canvas.composite(new Jimp(48, 32, 0x9b2432ee), x + cardWidth - 56, y + 97);
      canvas.print(font32, x + 10, y + 97, {
        text: statText(card.attack),
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
      }, 44, 32);
      canvas.print(font32, x + cardWidth - 53, y + 97, {
        text: statText(card.health),
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
      }, 44, 32);
      const keywords = keywordLabel(card.keywords);
      if (keywords) canvas.print(font16, x + 59, y + 107, keywords, 26, 20);
      if (canAttack) canvas.composite(new Jimp(cardWidth - 12, 3, 0xf7c85cff), x + 6, y + cardHeight - 8);
      x += cardWidth + gap;
    }
  }
}

export { BoardRenderer, HEIGHT as BOARD_HEIGHT, WIDTH as BOARD_WIDTH };
