import fs from 'node:fs/promises';

import { TavernNotFoundError, TavernValidationError } from '../errors.js';
import { EFFECT_TARGETS, EFFECT_TYPES } from './effectTypes.js';

function cloneAndFreeze(value) {
  const cloned = JSON.parse(JSON.stringify(value));
  const freeze = item => {
    if (!item || typeof item !== 'object' || Object.isFrozen(item)) return;
    Object.freeze(item);
    for (const child of Object.values(item)) freeze(child);
  };
  freeze(cloned);
  return cloned;
}

function validateHero(hero) {
  if (!hero || typeof hero !== 'object' || Array.isArray(hero)) {
    throw new TavernValidationError('Classe de herói inválida');
  }
  if (typeof hero.id !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(hero.id)) {
    throw new TavernValidationError('ID de classe inválido');
  }
  if (typeof hero.name !== 'string' || !hero.name.trim()) {
    throw new TavernValidationError(`Nome inválido para a classe ${hero.id}`);
  }
  if (!hero.power || !Number.isInteger(hero.power.cost) || hero.power.cost < 0) {
    throw new TavernValidationError(`Poder inválido para a classe ${hero.id}`);
  }
  if (!Array.isArray(hero.power.effects) || hero.power.effects.length === 0) {
    throw new TavernValidationError(`Poder sem efeitos para a classe ${hero.id}`);
  }
  for (const effect of hero.power.effects) {
    if (!effect || !EFFECT_TYPES.has(effect.effect)) {
      throw new TavernValidationError(`Efeito inválido para a classe ${hero.id}`);
    }
    if (effect.target !== undefined && !EFFECT_TARGETS.has(effect.target)) {
      throw new TavernValidationError(`Alvo de efeito inválido para a classe ${hero.id}`);
    }
  }
  return cloneAndFreeze(hero);
}

class HeroRegistry {
  constructor(heroes = []) {
    this.heroes = new Map();
    for (const hero of heroes) this.register(hero);
  }

  static async fromFile(file) {
    const content = await fs.readFile(file, 'utf8');
    return new HeroRegistry(JSON.parse(content));
  }

  register(heroInput) {
    const hero = validateHero(heroInput);
    if (this.heroes.has(hero.id)) {
      throw new TavernValidationError(`Classe duplicada: ${hero.id}`);
    }
    this.heroes.set(hero.id, hero);
    return hero;
  }

  get(heroId) {
    const hero = this.heroes.get(heroId);
    if (!hero) throw new TavernNotFoundError('Classe não registrada', { heroId });
    return hero;
  }

  list() {
    return [...this.heroes.values()];
  }
}

export { HeroRegistry, validateHero };
