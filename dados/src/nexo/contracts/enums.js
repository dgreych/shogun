const freeze = values => Object.freeze([...values]);

export const CIRCLE_MODES = freeze(['CASUAL', 'CAMPAIGN', 'COMMUNITY', 'EVENT']);
export const ONBOARDING_STATES = freeze([
  'NONE',
  'AWAITING_IMPULSE',
  'AWAITING_SCAR',
  'OPTIONAL_DETAILS',
  'GENERATING',
  'COMPLETE',
  'EXPIRED',
  'CANCELLED'
]);
export const TONES = freeze(['FLAME', 'VEIL', 'ROOT', 'ECHO']);
export const ATTRIBUTES = freeze(['IMPACT', 'READING', 'SUSTAIN', 'BEND', 'CONNECTION']);
export const STANCES = freeze(['CAUTION', 'PULSE', 'RUPTURE']);
export const OUTCOMES = freeze(['SETBACK', 'TENSE', 'FULL', 'RUPTURE']);
export const MESSAGE_VIEW_MODEL_KINDS = freeze(['CARD', 'LIST', 'CONFIRMATION', 'ERROR', 'DIGEST']);
export const TECHNIQUE_CATEGORIES = freeze(['OFFENSE', 'CONTROL', 'DEFENSE', 'SUPPORT', 'UTILITY']);
export const TECHNIQUE_RANGES = freeze(['SELF', 'ALLY', 'ENEMY', 'GROUP', 'AREA']);
export const TUTORIAL_STAGE_KINDS = freeze(['CHOICE', 'ANALYSIS', 'ACTION', 'RESONANCE']);

export const TONE_LABELS = Object.freeze({
  FLAME: 'CHAMA',
  VEIL: 'VÉU',
  ROOT: 'RAIZ',
  ECHO: 'ECO'
});

export const ATTRIBUTE_LABELS = Object.freeze({
  IMPACT: 'Impacto',
  READING: 'Leitura',
  SUSTAIN: 'Sustento',
  BEND: 'Dobra',
  CONNECTION: 'Conexão'
});

export const STANCE_LABELS = Object.freeze({
  CAUTION: 'Cautela',
  PULSE: 'Pulso',
  RUPTURE: 'Ruptura'
});

export const OUTCOME_LABELS = Object.freeze({
  SETBACK: 'REVÉS',
  TENSE: 'TENSO',
  FULL: 'PLENO',
  RUPTURE: 'RUPTURA'
});

export const CONTENT_SCHEMA_VERSION = 1;
export const NEXO_MVP_CONTENT_VERSION = '1.0.0';
