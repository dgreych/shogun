import { CardRegistry } from './CardRegistry.js';
import { HeroRegistry } from './HeroRegistry.js';

const DEFAULT_CARDS_URL = new URL('../data/cards.alpha.json', import.meta.url);
const DEFAULT_CLASSES_URL = new URL('../data/classes.json', import.meta.url);

async function createDefaultRegistries() {
  const [cardRegistry, heroRegistry] = await Promise.all([
    CardRegistry.fromFile(DEFAULT_CARDS_URL),
    HeroRegistry.fromFile(DEFAULT_CLASSES_URL)
  ]);
  return { cardRegistry, heroRegistry };
}

export {
  DEFAULT_CARDS_URL,
  DEFAULT_CLASSES_URL,
  createDefaultRegistries
};
