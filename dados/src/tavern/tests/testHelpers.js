import { createTavernConfig } from '../config.js';
import { MatchEngine } from '../domain/MatchEngine.js';
import { createDefaultRegistries } from '../domain/registries.js';

const TEST_DECK = Object.freeze(['GY-001', 'GY-014', 'GY-027', 'GY-103']);

async function createTestEngine(options = {}) {
  const { cardRegistry, heroRegistry } = await createDefaultRegistries();
  const config = createTavernConfig({
    defaults: {
      mulliganEnabled: options.mulliganEnabled ?? false
    },
    limits: {
      deckSize: TEST_DECK.length,
      normalCopies: 4,
      legendaryCopies: 1,
      ...(options.limits || {})
    },
    turnSeconds: options.turnSeconds
  });
  let now = options.now ?? Date.parse('2026-08-08T12:00:00.000Z');
  const engine = new MatchEngine({
    cardRegistry,
    heroRegistry,
    config,
    now: () => now,
    idFactory: () => 'match-test',
    seedFactory: () => 'seed-test'
  });
  return {
    cardRegistry,
    heroRegistry,
    config,
    engine,
    getNow: () => now,
    setNow: value => { now = value; }
  };
}

function createMatch(engine, overrides = {}) {
  return engine.createMatch({
    matchId: overrides.matchId || 'match-test',
    groupId: overrides.groupId || 'group-test@g.us',
    seed: overrides.seed || 'seed-test',
    startingPlayerId: overrides.startingPlayerId || 'one@s.whatsapp.net',
    mode: overrides.mode || 'NORMAL',
    players: overrides.players || [
      { id: 'one@s.whatsapp.net', classId: 'GUARDIAN', deck: [...TEST_DECK] },
      { id: 'two@s.whatsapp.net', classId: 'PROFANE', deck: [...TEST_DECK] }
    ]
  });
}

export { TEST_DECK, createMatch, createTestEngine };
