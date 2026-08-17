import { ATTRIBUTES, OUTCOMES } from './enums.js';
import {
  NexoContractValidationError,
  assertNoExtraKeys,
  deepFreeze,
  requireArray,
  requireEnum,
  requireInteger,
  requirePlainObject,
  requireString,
  requireUniqueStrings,
  validateContentId,
  validateContentVersion,
  validateDefinitionVersion
} from './validation.js';

export const ESTACAO_ZERO_SCHEMA_VERSION = 1;
export const ESTACAO_ZERO_CONTENT_VERSION = '1.0.0';
export const QUEST_TYPES = Object.freeze(['INVESTIGATION', 'EXPEDITION', 'DEFENSE', 'DIPLOMACY']);
export const QUEST_NODE_TYPES = Object.freeze(['CHOICE', 'TEST']);

const RUNTIME_PLACEHOLDER_PATTERN = /(?:\{\{?[^}]+\}?\}|<[^>]+>|%[sdif]|@[a-z0-9_]+)/i;

function baseIdentity(input, label, allowedKeys) {
  requirePlainObject(input, label);
  assertNoExtraKeys(input, allowedKeys, label);
  return {
    id: validateContentId(input.id, `${label}.id`),
    version: validateDefinitionVersion(input.version, `${label}.version`)
  };
}

function requirePresentationText(value, label, { max = 220 } = {}) {
  const text = requireString(value, label, { max });
  if (RUNTIME_PLACEHOLDER_PATTERN.test(text)) {
    throw new NexoContractValidationError(`${label} não pode conter placeholder de runtime`);
  }
  return text;
}

function requireNodeRef(value, label) {
  if (value === null) return null;
  return validateContentId(value, label);
}

export function validateLocationDefinition(input, index = 0) {
  const label = `estacaoZero.map.locations[${index}]`;
  const identity = baseIdentity(input, label, ['id', 'version', 'name', 'description']);
  return deepFreeze({
    ...identity,
    name: requirePresentationText(input.name, `${label}.name`, { max: 100 }),
    description: requirePresentationText(input.description, `${label}.description`, { max: 260 })
  });
}

export function validateMapDefinition(input) {
  const label = 'estacaoZero.map';
  const identity = baseIdentity(input, label, ['id', 'version', 'name', 'description', 'locations']);
  const locations = requireArray(input.locations, `${label}.locations`, { min: 4, max: 5 }).map(validateLocationDefinition);
  const locationIds = locations.map(location => location.id);
  if (new Set(locationIds).size !== locationIds.length) {
    throw new NexoContractValidationError(`${label}.locations contém ids duplicados`);
  }
  return deepFreeze({
    ...identity,
    name: requirePresentationText(input.name, `${label}.name`, { max: 100 }),
    description: requirePresentationText(input.description, `${label}.description`, { max: 320 }),
    locations
  });
}

function validateEnemyCore(input, label, allowedKeys) {
  const identity = baseIdentity(input, label, allowedKeys);
  const intentLabels = requireUniqueStrings(input.intentLabels, `${label}.intentLabels`, {
    min: 2,
    max: 4,
    itemMax: 120
  }).map((intent, index) => requirePresentationText(intent, `${label}.intentLabels[${index}]`, { max: 120 }));

  return {
    ...identity,
    name: requirePresentationText(input.name, `${label}.name`, { max: 100 }),
    hpBase: requireInteger(input.hpBase, `${label}.hpBase`, { min: 1, max: 999 }),
    guarda: requireInteger(input.guarda, `${label}.guarda`, { min: 0, max: 20 }),
    atributoPrincipal: requireEnum(input.atributoPrincipal, `${label}.atributoPrincipal`, ATTRIBUTES),
    intentLabels
  };
}

export function validateEnemyDefinition(input, index = 0) {
  const label = `estacaoZero.enemies[${index}]`;
  return deepFreeze(validateEnemyCore(input, label, [
    'id', 'version', 'name', 'hpBase', 'guarda', 'atributoPrincipal', 'intentLabels'
  ]));
}

function validateFractureDefinition(input, index) {
  const label = `estacaoZero.boss.fraturas[${index}]`;
  assertNoExtraKeys(input, ['id', 'hint'], label);
  return {
    id: validateContentId(input.id, `${label}.id`),
    hint: requirePresentationText(input.hint, `${label}.hint`, { max: 180 })
  };
}

export function validateBossDefinition(input) {
  const label = 'estacaoZero.boss';
  const base = validateEnemyCore(input, label, [
    'id', 'version', 'name', 'hpBase', 'guarda', 'atributoPrincipal', 'intentLabels', 'fraturas', 'ancora'
  ]);
  const fraturas = requireArray(input.fraturas, `${label}.fraturas`, { min: 2, max: 3 }).map(validateFractureDefinition);
  const fractureIds = fraturas.map(fracture => fracture.id);
  if (new Set(fractureIds).size !== fractureIds.length) {
    throw new NexoContractValidationError(`${label}.fraturas contém ids duplicados`);
  }
  return deepFreeze({
    ...base,
    fraturas,
    ...(input.ancora === undefined
      ? {}
      : { ancora: requirePresentationText(input.ancora, `${label}.ancora`, { max: 180 }) })
  });
}

function validateOutcomeRoutes(input, label) {
  assertNoExtraKeys(input, OUTCOMES, label);
  const normalized = {};
  for (const outcome of OUTCOMES) {
    if (!(outcome in input)) {
      throw new NexoContractValidationError(`${label} precisa declarar a rota ${outcome}`);
    }
    normalized[outcome] = requireNodeRef(input[outcome], `${label}.${outcome}`);
  }
  return normalized;
}

function validateQuestTest(input, label) {
  assertNoExtraKeys(input, ['attribute', 'difficulty', 'nextByOutcome'], label);
  return {
    attribute: requireEnum(input.attribute, `${label}.attribute`, ATTRIBUTES),
    difficulty: requireInteger(input.difficulty, `${label}.difficulty`, { min: 4, max: 24 }),
    nextByOutcome: validateOutcomeRoutes(requirePlainObject(input.nextByOutcome, `${label}.nextByOutcome`), `${label}.nextByOutcome`)
  };
}

function validateQuestOption(input, label, nodeType) {
  assertNoExtraKeys(input, ['id', 'label', 'next', 'test'], label);
  const id = validateContentId(input.id, `${label}.id`);
  const optionLabel = requirePresentationText(input.label, `${label}.label`, { max: 140 });

  if (nodeType === 'CHOICE') {
    if (!Object.hasOwn(input, 'next') || Object.hasOwn(input, 'test')) {
      throw new NexoContractValidationError(`${label} CHOICE precisa declarar next e não pode declarar test`);
    }
    return { id, label: optionLabel, next: requireNodeRef(input.next, `${label}.next`) };
  }

  if (!Object.hasOwn(input, 'test') || Object.hasOwn(input, 'next')) {
    throw new NexoContractValidationError(`${label} TEST precisa declarar test e não pode declarar next`);
  }
  return {
    id,
    label: optionLabel,
    test: validateQuestTest(requirePlainObject(input.test, `${label}.test`), `${label}.test`)
  };
}

function validateQuestTimeout(input, label, optionIds) {
  assertNoExtraKeys(input, ['minutes', 'defaultOption'], label);
  const defaultOption = validateContentId(input.defaultOption, `${label}.defaultOption`);
  if (!optionIds.has(defaultOption)) {
    throw new NexoContractValidationError(`${label}.defaultOption referencia opção inexistente: ${defaultOption}`);
  }
  return {
    minutes: requireInteger(input.minutes, `${label}.minutes`, { min: 1, max: 1440 }),
    defaultOption
  };
}

export function validateQuestNode(input, index = 0) {
  const label = `quest.nodes[${index}]`;
  assertNoExtraKeys(input, ['id', 'type', 'prompt', 'options', 'timeout'], label);
  const id = validateContentId(input.id, `${label}.id`);
  const type = requireEnum(input.type, `${label}.type`, QUEST_NODE_TYPES);
  const options = requireArray(input.options, `${label}.options`, {
    min: type === 'CHOICE' ? 2 : 1,
    max: type === 'CHOICE' ? 4 : 1
  }).map((option, optionIndex) => validateQuestOption(
    requirePlainObject(option, `${label}.options[${optionIndex}]`),
    `${label}.options[${optionIndex}]`,
    type
  ));
  const optionIds = new Set(options.map(option => option.id));
  if (optionIds.size !== options.length) throw new NexoContractValidationError(`${label}.options contém ids duplicados`);

  return deepFreeze({
    id,
    type,
    prompt: requirePresentationText(input.prompt, `${label}.prompt`, { max: 360 }),
    options,
    ...(input.timeout === undefined
      ? {}
      : { timeout: validateQuestTimeout(requirePlainObject(input.timeout, `${label}.timeout`), `${label}.timeout`, optionIds) })
  });
}

function collectNodeTargets(node) {
  const targets = [];
  for (const option of node.options) {
    if ('next' in option) targets.push(option.next);
    if ('test' in option) targets.push(...OUTCOMES.map(outcome => option.test.nextByOutcome[outcome]));
  }
  return targets;
}

function assertQuestGraph(mission) {
  const nodeById = new Map(mission.nodes.map(node => [node.id, node]));
  if (!nodeById.has(mission.startNodeId)) {
    throw new NexoContractValidationError(`mission ${mission.id} referencia startNodeId inexistente: ${mission.startNodeId}`);
  }

  let hasTerminal = false;
  for (const node of mission.nodes) {
    for (const target of collectNodeTargets(node)) {
      if (target === null) {
        hasTerminal = true;
      } else if (!nodeById.has(target)) {
        throw new NexoContractValidationError(`mission ${mission.id} referencia nó inexistente: ${target}`);
      }
    }
  }
  if (!hasTerminal) throw new NexoContractValidationError(`mission ${mission.id} precisa possuir ao menos uma rota terminal`);

  const reachable = new Set();
  const queue = [mission.startNodeId];
  while (queue.length) {
    const nodeId = queue.shift();
    if (reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    const node = nodeById.get(nodeId);
    for (const target of collectNodeTargets(node)) if (target !== null && !reachable.has(target)) queue.push(target);
  }
  if (reachable.size !== mission.nodes.length) {
    const missing = mission.nodes.filter(node => !reachable.has(node.id)).map(node => node.id);
    throw new NexoContractValidationError(`mission ${mission.id} possui nós inalcançáveis: ${missing.join(', ')}`);
  }
}

export function validateMissionDefinition(input, index = 0) {
  const label = `estacaoZero.missions[${index}]`;
  const identity = baseIdentity(input, label, [
    'id', 'version', 'name', 'type', 'description', 'locationIds', 'enemyIds', 'startNodeId', 'nodes'
  ]);
  const mission = {
    ...identity,
    name: requirePresentationText(input.name, `${label}.name`, { max: 120 }),
    type: requireEnum(input.type, `${label}.type`, QUEST_TYPES),
    description: requirePresentationText(input.description, `${label}.description`, { max: 300 }),
    locationIds: requireUniqueStrings(input.locationIds, `${label}.locationIds`, { min: 1, max: 5, itemMax: 64 })
      .map((id, locationIndex) => validateContentId(id, `${label}.locationIds[${locationIndex}]`)),
    enemyIds: requireUniqueStrings(input.enemyIds, `${label}.enemyIds`, { min: 1, max: 4, itemMax: 64 })
      .map((id, enemyIndex) => validateContentId(id, `${label}.enemyIds[${enemyIndex}]`)),
    startNodeId: validateContentId(input.startNodeId, `${label}.startNodeId`),
    nodes: requireArray(input.nodes, `${label}.nodes`, { min: 2, max: 10 })
      .map((node, nodeIndex) => validateQuestNode(requirePlainObject(node, `${label}.nodes[${nodeIndex}]`), nodeIndex))
  };
  const nodeIds = mission.nodes.map(node => node.id);
  if (new Set(nodeIds).size !== nodeIds.length) throw new NexoContractValidationError(`${label}.nodes contém ids duplicados`);
  assertQuestGraph(mission);
  return deepFreeze(mission);
}

function assertUniqueIds(items, label) {
  const ids = items.map(item => item.id);
  if (new Set(ids).size !== ids.length) throw new NexoContractValidationError(`${label} contém ids duplicados`);
}

function assertPackReferences(pack) {
  const locationIds = new Set(pack.map.locations.map(location => location.id));
  const enemyIds = new Set([...pack.enemies.map(enemy => enemy.id), pack.boss.id]);
  for (const mission of pack.missions) {
    for (const locationId of mission.locationIds) {
      if (!locationIds.has(locationId)) {
        throw new NexoContractValidationError(`mission ${mission.id} referencia local inexistente: ${locationId}`);
      }
    }
    for (const enemyId of mission.enemyIds) {
      if (!enemyIds.has(enemyId)) {
        throw new NexoContractValidationError(`mission ${mission.id} referencia inimigo inexistente: ${enemyId}`);
      }
    }
  }
}

export function validateEstacaoZeroContentPack(input) {
  const label = 'estacaoZero';
  assertNoExtraKeys(input, ['schemaVersion', 'contentVersion', 'map', 'enemies', 'boss', 'missions'], label);
  if (input.schemaVersion !== ESTACAO_ZERO_SCHEMA_VERSION) {
    throw new NexoContractValidationError(`${label}.schemaVersion precisa ser ${ESTACAO_ZERO_SCHEMA_VERSION}`);
  }

  const map = validateMapDefinition(requirePlainObject(input.map, `${label}.map`));
  const enemies = requireArray(input.enemies, `${label}.enemies`, { min: 6, max: 6 })
    .map((enemy, index) => validateEnemyDefinition(requirePlainObject(enemy, `${label}.enemies[${index}]`), index));
  const boss = validateBossDefinition(requirePlainObject(input.boss, `${label}.boss`));
  const missions = requireArray(input.missions, `${label}.missions`, { min: 6, max: 6 })
    .map((mission, index) => validateMissionDefinition(requirePlainObject(mission, `${label}.missions[${index}]`), index));

  assertUniqueIds(enemies, `${label}.enemies`);
  if (enemies.some(enemy => enemy.id === boss.id)) {
    throw new NexoContractValidationError(`${label}.boss.id colide com inimigo comum`);
  }
  assertUniqueIds(missions, `${label}.missions`);
  for (const questType of QUEST_TYPES) {
    if (!missions.some(mission => mission.type === questType)) {
      throw new NexoContractValidationError(`${label}.missions precisa cobrir o tipo ${questType}`);
    }
  }

  const pack = {
    schemaVersion: ESTACAO_ZERO_SCHEMA_VERSION,
    contentVersion: validateContentVersion(input.contentVersion, `${label}.contentVersion`),
    map,
    enemies,
    boss,
    missions
  };
  assertPackReferences(pack);
  return deepFreeze(pack);
}
