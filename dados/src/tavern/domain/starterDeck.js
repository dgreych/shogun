const NEUTRAL_STARTER_CARD_IDS = Object.freeze([
  'GY-001',
  'GY-002',
  'GY-003',
  'GY-004',
  'GY-005',
  'GY-006',
  'GY-007',
  'GY-008',
  'GY-009'
]);

// Pool genérico pré-mini-set, sem restrição de classe. Mantido como starter
// das classes avançadas (Oráculo, Xamã, Profano) até que recebam seu próprio
// mini-set — preserva o comportamento já aprovado para quem já jogava com
// essas classes, sem regressão.
const LEGACY_GENERIC_CARD_IDS = Object.freeze([
  'GY-014',
  'GY-027',
  'GY-042',
  'GY-061',
  'GY-088',
  'GY-103'
]);

const CLASS_STARTER_CARD_IDS = Object.freeze({
  GUARDIAN: Object.freeze([
    'GY-GD-201',
    'GY-GD-202',
    'GY-GD-203',
    'GY-GD-204',
    'GY-GD-205',
    'GY-GD-206'
  ]),
  EXILE: Object.freeze([
    'GY-EX-201',
    'GY-EX-202',
    'GY-EX-203',
    'GY-EX-204',
    'GY-EX-205',
    'GY-EX-206'
  ]),
  STORM: Object.freeze([
    'GY-ST-201',
    'GY-ST-202',
    'GY-ST-203',
    'GY-ST-204',
    'GY-ST-205',
    'GY-ST-206'
  ])
});

function createStarterDeck(classId) {
  const classCardIds = CLASS_STARTER_CARD_IDS[classId] || LEGACY_GENERIC_CARD_IDS;
  return [...NEUTRAL_STARTER_CARD_IDS, ...classCardIds].flatMap(cardId => [cardId, cardId]);
}

export {
  CLASS_STARTER_CARD_IDS,
  LEGACY_GENERIC_CARD_IDS,
  NEUTRAL_STARTER_CARD_IDS,
  createStarterDeck
};
