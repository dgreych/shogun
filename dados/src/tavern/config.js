const DEFAULT_TAVERN_CONFIG = Object.freeze({
  version: 1,
  defaults: Object.freeze({
    enabled: false,
    turnMode: 'NORMAL',
    mulliganEnabled: true,
    activityXp: true,
    eventFrequency: 'LOW',
    bossEnabled: true,
    rankedEnabled: true,
    arenaEnabled: true,
    brawlEnabled: true
  }),
  limits: Object.freeze({
    heroHp: 30,
    maxMana: 10,
    deckSize: 30,
    handSize: 10,
    boardSize: 7,
    normalCopies: 2,
    legendaryCopies: 1,
    maxEffectChain: 64
  }),
  turnSeconds: Object.freeze({
    BLITZ: 60,
    NORMAL: 180,
    ASYNC: 1800,
    CORRESPONDENCE: 43200
  })
});

function mergeSection(base, override) {
  return Object.freeze({ ...base, ...(override || {}) });
}

function createTavernConfig(overrides = {}) {
  return Object.freeze({
    version: overrides.version || DEFAULT_TAVERN_CONFIG.version,
    defaults: mergeSection(DEFAULT_TAVERN_CONFIG.defaults, overrides.defaults),
    limits: mergeSection(DEFAULT_TAVERN_CONFIG.limits, overrides.limits),
    turnSeconds: mergeSection(DEFAULT_TAVERN_CONFIG.turnSeconds, overrides.turnSeconds)
  });
}

export { DEFAULT_TAVERN_CONFIG, createTavernConfig };
