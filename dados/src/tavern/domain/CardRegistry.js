import fs from 'node:fs/promises';

import { TavernNotFoundError, TavernValidationError } from '../errors.js';
import { EFFECT_TARGETS, EFFECT_TRIGGERS, EFFECT_TYPES } from './effectTypes.js';

const CARD_TYPES = new Set(['MINION', 'SPELL', 'ARTIFACT', 'TERRAIN']);
const CARD_RARITIES = new Set(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);
const CARD_KEYWORDS = new Set([
  'GUARD',
  'RUSH',
  'DEATHRATTLE',
  'ON_PLAY',
  'BLEED',
  'BOND',
  'AMBUSH',
  'FRENZY'
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function assertText(value, field, { max = 500 } = {}) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new TavernValidationError(`Campo ${field} inválido`);
  }
}

function assertInteger(value, field, { min = 0, max = 999 } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new TavernValidationError(`Campo ${field} inválido`);
  }
}

function validateEffect(effect, cardId) {
  if (!effect || typeof effect !== 'object' || Array.isArray(effect)) {
    throw new TavernValidationError(`Efeito inválido em ${cardId}`);
  }
  assertText(effect.trigger, `${cardId}.effects.trigger`, { max: 64 });
  assertText(effect.effect, `${cardId}.effects.effect`, { max: 64 });
  if (effect.target !== undefined) assertText(effect.target, `${cardId}.effects.target`, { max: 64 });
  if (effect.value !== undefined) assertInteger(effect.value, `${cardId}.effects.value`, { min: 0, max: 9999 });
  if (!EFFECT_TRIGGERS.has(effect.trigger)) {
    throw new TavernValidationError(`Gatilho desconhecido em ${cardId}: ${effect.trigger}`);
  }
  if (!EFFECT_TYPES.has(effect.effect)) {
    throw new TavernValidationError(`Efeito desconhecido em ${cardId}: ${effect.effect}`);
  }
  if (effect.target !== undefined && !EFFECT_TARGETS.has(effect.target)) {
    throw new TavernValidationError(`Alvo desconhecido em ${cardId}: ${effect.target}`);
  }
}

function validateCard(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TavernValidationError('Definição de carta inválida');
  }

  const card = clone(input);
  assertText(card.id, 'id', { max: 64 });
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(card.id)) {
    throw new TavernValidationError(`ID de carta inválido: ${card.id}`);
  }
  assertText(card.name, `${card.id}.name`, { max: 100 });
  if (!CARD_TYPES.has(card.type)) throw new TavernValidationError(`Tipo inválido em ${card.id}`);
  if (!CARD_RARITIES.has(card.rarity)) throw new TavernValidationError(`Raridade inválida em ${card.id}`);
  assertInteger(card.cost, `${card.id}.cost`, { min: 0, max: 30 });

  if (card.type === 'MINION') {
    assertInteger(card.attack, `${card.id}.attack`, { min: 0, max: 99 });
    assertInteger(card.health, `${card.id}.health`, { min: 1, max: 99 });
  }

  card.schemaVersion = card.schemaVersion || 1;
  card.collectible = card.collectible !== false;
  card.keywords = card.keywords || [];
  card.effects = card.effects || [];

  if (!Array.isArray(card.keywords) || !Array.isArray(card.effects)) {
    throw new TavernValidationError(`Keywords ou efeitos inválidos em ${card.id}`);
  }
  for (const keyword of card.keywords) {
    if (!CARD_KEYWORDS.has(keyword)) {
      throw new TavernValidationError(`Keyword desconhecida em ${card.id}: ${keyword}`);
    }
  }
  for (const effect of card.effects) validateEffect(effect, card.id);

  return deepFreeze(card);
}

class CardRegistry {
  constructor(cards = []) {
    this.cards = new Map();
    this.registerMany(cards);
  }

  static async fromFile(file) {
    const content = await fs.readFile(file, 'utf8');
    return new CardRegistry(JSON.parse(content));
  }

  register(cardInput) {
    const card = validateCard(cardInput);
    if (this.cards.has(card.id)) {
      throw new TavernValidationError(`Carta duplicada: ${card.id}`);
    }
    this.cards.set(card.id, card);
    return card;
  }

  registerMany(cards) {
    if (!Array.isArray(cards)) throw new TavernValidationError('Catálogo de cartas inválido');
    for (const card of cards) this.register(card);
    return this;
  }

  has(cardId) {
    return this.cards.has(cardId);
  }

  get(cardId) {
    const card = this.cards.get(cardId);
    if (!card) throw new TavernNotFoundError('Carta não registrada', { cardId });
    return card;
  }

  list({ collectible } = {}) {
    return [...this.cards.values()].filter(card => (
      collectible === undefined || card.collectible === collectible
    ));
  }
}

export {
  CARD_KEYWORDS,
  CARD_RARITIES,
  CARD_TYPES,
  CardRegistry,
  validateCard
};
