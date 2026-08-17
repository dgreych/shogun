import { NexoValidationError } from '../errors.js';

// Espelho local (validação em JS puro) do contrato Render View v1 que o
// GPT definiu e congelou em BunnyFy: src/nexoGame/contracts/renderView.ts
// (schemaVersion 1, GPT-NEXO-002, revisado e aceito por Claude). Isso
// garante que o Gyomei nunca monta nem envia um payload malformado --
// falha aqui, local e barato, em vez de descobrir só depois de uma
// viagem de rede pra BunnyFy rejeitar. Os limites e regex ABAIXO
// precisam continuar batendo com o lado BunnyFy; se um dia divergirem,
// é sinal de que o contrato mudou lá e isso aqui precisa ser atualizado
// junto (não é dono da fonte de verdade -- só um espelho).

const NEXO_RENDER_SCHEMA_VERSION = 1;

const FORBIDDEN_WHATSAPP_FRAGMENT = /@(s\.whatsapp\.net|g\.us|lid|broadcast|newsletter)/i;
const FORBIDDEN_IDENTITY_SENTINEL = /\b(?:jid|phone|telefone|seed|pn|lid|chat[\s_-]*id|user[\s_-]*id|history|hist[oó]rico|hidden(?:[\s_-]*content)?|conte[uú]do[\s_-]*oculto)\b/i;
const PHONE_LIKE_FRAGMENT = /(?:^|\D)\+?\d(?:[\s().-]*\d){8,}(?:$|\D)/;
const UUID_LIKE_FRAGMENT = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const LONG_HEX_FRAGMENT = /\b[0-9a-f]{24,}\b/i;

const NEXO_RENDER_LIMITS = Object.freeze({
  labelLength: 96,
  titleLength: 120,
  metrics: 12,
  highlights: 8,
  techniques: 8,
  traits: 8,
  encounterActions: 6,
  encounterStatuses: 8,
  numericMagnitude: 999_999
});

function bad(message) {
  throw new NexoValidationError(message, { code: 'RENDER_VIEW_INVALID' });
}

function assertLabel(value, label, max = NEXO_RENDER_LIMITS.labelLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    bad(`${label} inválido`);
  }
  if (FORBIDDEN_WHATSAPP_FRAGMENT.test(value)) bad(`${label} contém fragmento de identificador do WhatsApp`);
  if (FORBIDDEN_IDENTITY_SENTINEL.test(value)) bad(`${label} contém sentinela de identidade/estado interno`);
  if (PHONE_LIKE_FRAGMENT.test(value)) bad(`${label} parece um telefone`);
  if (UUID_LIKE_FRAGMENT.test(value) || LONG_HEX_FRAGMENT.test(value)) bad(`${label} parece um identificador bruto`);
  return value;
}

function assertLabelArray(values, label, max) {
  if (!Array.isArray(values) || values.length > max) bad(`${label} inválido`);
  return values.map((value, index) => assertLabel(value, `${label}[${index}]`));
}

function assertBoundedInt(value, label) {
  if (!Number.isInteger(value) || Math.abs(value) > NEXO_RENDER_LIMITS.numericMagnitude) {
    bad(`${label} inválido`);
  }
  return value;
}

function assertMetric(metric, label) {
  if (!metric || typeof metric !== 'object') bad(`${label} inválido`);
  const keys = Object.keys(metric);
  const allowed = new Set(['label', 'value', 'max']);
  if (keys.some(key => !allowed.has(key))) bad(`${label} tem campo extra`);
  assertLabel(metric.label, `${label}.label`);
  assertBoundedInt(metric.value, `${label}.value`);
  if (metric.max !== undefined) {
    if (!Number.isInteger(metric.max) || metric.max < 0 || metric.max > NEXO_RENDER_LIMITS.numericMagnitude) {
      bad(`${label}.max inválido`);
    }
    if (metric.value > metric.max) bad(`${label}.value não pode exceder ${label}.max`);
  }
  return { label: metric.label, value: metric.value, ...(metric.max !== undefined ? { max: metric.max } : {}) };
}

function assertMetrics(values, label) {
  if (!Array.isArray(values) || values.length > NEXO_RENDER_LIMITS.metrics) bad(`${label} inválido`);
  return values.map((metric, index) => assertMetric(metric, `${label}[${index}]`));
}

function assertNoExtraKeys(value, allowedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad(`${label} inválido`);
  const keys = Object.keys(value);
  if (keys.some(key => !allowedKeys.includes(key))) bad(`${label} tem campo extra`);
}

function assertCircleRenderView(view) {
  assertNoExtraKeys(view, ['schemaVersion', 'kind', 'titleLabel', 'modeLabel', 'statusLabel', 'metrics', 'highlights'], 'circle');
  if (view.schemaVersion !== NEXO_RENDER_SCHEMA_VERSION || view.kind !== 'circle') bad('circle.schemaVersion/kind inválido');
  return {
    schemaVersion: NEXO_RENDER_SCHEMA_VERSION,
    kind: 'circle',
    titleLabel: assertLabel(view.titleLabel, 'circle.titleLabel', NEXO_RENDER_LIMITS.titleLength),
    modeLabel: assertLabel(view.modeLabel, 'circle.modeLabel'),
    statusLabel: assertLabel(view.statusLabel, 'circle.statusLabel'),
    metrics: assertMetrics(view.metrics, 'circle.metrics'),
    highlights: assertLabelArray(view.highlights, 'circle.highlights', NEXO_RENDER_LIMITS.highlights)
  };
}

function assertCharacterRenderView(view) {
  assertNoExtraKeys(view, [
    'schemaVersion', 'kind', 'titleLabel', 'originLabel', 'toneLabel',
    'impulseLabel', 'scarLabel', 'metrics', 'techniqueLabels', 'traitLabels'
  ], 'character');
  if (view.schemaVersion !== NEXO_RENDER_SCHEMA_VERSION || view.kind !== 'character') {
    bad('character.schemaVersion/kind inválido');
  }
  return {
    schemaVersion: NEXO_RENDER_SCHEMA_VERSION,
    kind: 'character',
    titleLabel: assertLabel(view.titleLabel, 'character.titleLabel', NEXO_RENDER_LIMITS.titleLength),
    originLabel: assertLabel(view.originLabel, 'character.originLabel'),
    toneLabel: assertLabel(view.toneLabel, 'character.toneLabel'),
    impulseLabel: assertLabel(view.impulseLabel, 'character.impulseLabel'),
    scarLabel: assertLabel(view.scarLabel, 'character.scarLabel'),
    metrics: assertMetrics(view.metrics, 'character.metrics'),
    techniqueLabels: assertLabelArray(view.techniqueLabels, 'character.techniqueLabels', NEXO_RENDER_LIMITS.techniques),
    traitLabels: assertLabelArray(view.traitLabels, 'character.traitLabels', NEXO_RENDER_LIMITS.traits)
  };
}

function assertEncounterSide(value, label) {
  assertNoExtraKeys(value, ['label', 'metrics'], label);
  return {
    label: assertLabel(value.label, `${label}.label`),
    metrics: assertMetrics(value.metrics, `${label}.metrics`)
  };
}

function assertEncounterRenderView(view) {
  assertNoExtraKeys(view, [
    'schemaVersion', 'kind', 'titleLabel', 'round', 'postureLabel',
    'outcomeLabel', 'actor', 'enemy', 'actionLabels', 'statusLabels'
  ], 'encounter');
  if (view.schemaVersion !== NEXO_RENDER_SCHEMA_VERSION || view.kind !== 'encounter') {
    bad('encounter.schemaVersion/kind inválido');
  }
  if (!Number.isInteger(view.round) || view.round < 1 || view.round > 9_999) bad('encounter.round inválido');

  assertNoExtraKeys(view.actor, ['label', 'metrics'], 'encounter.actor');
  const actor = assertEncounterSide(view.actor, 'encounter.actor');

  assertNoExtraKeys(view.enemy, ['label', 'metrics', 'intentLabel'], 'encounter.enemy');
  const enemySide = assertEncounterSide({ label: view.enemy.label, metrics: view.enemy.metrics }, 'encounter.enemy');
  const enemy = { ...enemySide, intentLabel: assertLabel(view.enemy.intentLabel, 'encounter.enemy.intentLabel') };

  return {
    schemaVersion: NEXO_RENDER_SCHEMA_VERSION,
    kind: 'encounter',
    titleLabel: assertLabel(view.titleLabel, 'encounter.titleLabel', NEXO_RENDER_LIMITS.titleLength),
    round: view.round,
    postureLabel: assertLabel(view.postureLabel, 'encounter.postureLabel'),
    ...(view.outcomeLabel !== undefined ? { outcomeLabel: assertLabel(view.outcomeLabel, 'encounter.outcomeLabel') } : {}),
    actor,
    enemy,
    actionLabels: assertLabelArray(view.actionLabels, 'encounter.actionLabels', NEXO_RENDER_LIMITS.encounterActions),
    statusLabels: assertLabelArray(view.statusLabels, 'encounter.statusLabels', NEXO_RENDER_LIMITS.encounterStatuses)
  };
}

export {
  NEXO_RENDER_LIMITS,
  NEXO_RENDER_SCHEMA_VERSION,
  assertCharacterRenderView,
  assertCircleRenderView,
  assertEncounterRenderView
};
