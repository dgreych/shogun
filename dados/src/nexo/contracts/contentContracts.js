import {
  ATTRIBUTES,
  CONTENT_SCHEMA_VERSION,
  STANCES,
  TECHNIQUE_CATEGORIES,
  TECHNIQUE_RANGES,
  TONES,
  TUTORIAL_STAGE_KINDS
} from './enums.js';
import {
  NexoContractValidationError,
  TAG_PATTERN,
  assertNoExtraKeys,
  deepFreeze,
  requireArray,
  requireBoolean,
  requireEnum,
  requireInteger,
  requirePlainObject,
  requireString,
  requireUniqueStrings,
  validateContentId,
  validateContentVersion,
  validateDefinitionVersion
} from './validation.js';

function baseIdentity(input, label, allowedKeys) {
  assertNoExtraKeys(input, allowedKeys, label);
  return {
    id: validateContentId(input.id, `${label}.id`),
    version: validateDefinitionVersion(input.version, `${label}.version`)
  };
}

function requireDistinctPair(value, label, allowed) {
  const pair = requireArray(value, label, { min: 2, max: 2 }).map((item, index) =>
    requireEnum(item, `${label}[${index}]`, allowed)
  );
  if (pair[0] === pair[1]) throw new NexoContractValidationError(`${label} precisa conter dois valores diferentes`);
  return pair;
}

export function validateImpulseDefinition(input) {
  const label = 'impulse';
  const identity = baseIdentity(input, label, ['id', 'version', 'name', 'signature', 'favoredAttributes', 'fantasy']);
  return deepFreeze({
    ...identity,
    name: requireString(input.name, `${label}.name`, { max: 80 }),
    signature: requireDistinctPair(input.signature, `${label}.signature`, TONES),
    favoredAttributes: requireDistinctPair(input.favoredAttributes, `${label}.favoredAttributes`, ATTRIBUTES),
    fantasy: requireString(input.fantasy, `${label}.fantasy`, { max: 180 })
  });
}

export function validateScarDefinition(input) {
  const label = 'scar';
  const identity = baseIdentity(input, label, ['id', 'version', 'name', 'riskRule', 'futureTransformation']);
  return deepFreeze({
    ...identity,
    name: requireString(input.name, `${label}.name`, { max: 80 }),
    riskRule: requireString(input.riskRule, `${label}.riskRule`, { max: 180 }),
    futureTransformation: requireString(input.futureTransformation, `${label}.futureTransformation`, { max: 180 })
  });
}

function validateOriginModifier(input) {
  const label = 'origin.modifier';
  assertNoExtraKeys(input, ['attribute', 'value', 'condition'], label);
  return {
    attribute: requireEnum(input.attribute, `${label}.attribute`, ATTRIBUTES),
    value: requireInteger(input.value, `${label}.value`, { min: 1, max: 2 }),
    condition: requireString(input.condition, `${label}.condition`, { max: 180 })
  };
}

export function validateOriginDefinition(input) {
  const label = 'origin';
  const identity = baseIdentity(input, label, ['id', 'version', 'name', 'description', 'modifier']);
  return deepFreeze({
    ...identity,
    name: requireString(input.name, `${label}.name`, { max: 80 }),
    description: requireString(input.description, `${label}.description`, { max: 220 }),
    modifier: validateOriginModifier(requirePlainObject(input.modifier, `${label}.modifier`))
  });
}

const BASE_EFFECT_LIMITS = Object.freeze({
  damage: [0, 20],
  shield: [0, 20],
  heal: [0, 20],
  guardDelta: [-10, 10],
  resonance: [0, 100],
  analysis: [0, 20],
  intentReduction: [0, 20],
  mobility: [0, 20],
  tensionDelta: [-6, 6],
  entropyDelta: [-25, 25]
});

function validateBaseEffect(input) {
  const label = 'technique.baseEffect';
  requirePlainObject(input, label);
  assertNoExtraKeys(input, Object.keys(BASE_EFFECT_LIMITS), label);
  const keys = Object.keys(input);
  if (!keys.length) throw new NexoContractValidationError(`${label} precisa declarar ao menos um efeito`);
  const normalized = {};
  for (const key of keys) {
    const [min, max] = BASE_EFFECT_LIMITS[key];
    normalized[key] = requireInteger(input[key], `${label}.${key}`, { min, max });
  }
  if (!Object.values(normalized).some(value => value !== 0)) {
    throw new NexoContractValidationError(`${label} não pode ser composto apenas por zeros`);
  }
  return normalized;
}

function validateUnlock(input) {
  const label = 'technique.unlock';
  assertNoExtraKeys(input, ['path', 'rank'], label);
  return {
    path: validateContentId(input.path, `${label}.path`),
    rank: requireInteger(input.rank, `${label}.rank`, { min: 1, max: 20 })
  };
}

export function validateTechniqueDefinition(input) {
  const label = 'technique';
  const identity = baseIdentity(input, label, [
    'id',
    'version',
    'name',
    'tone',
    'category',
    'attribute',
    'focusCost',
    'baseEffect',
    'range',
    'allowedStances',
    'tags',
    'cooldownRounds',
    'unlock',
    'description'
  ]);
  const allowedStances = requireUniqueStrings(input.allowedStances, `${label}.allowedStances`, {
    min: 1,
    max: STANCES.length,
    itemMax: 20
  }).map((stance, index) => requireEnum(stance, `${label}.allowedStances[${index}]`, STANCES));
  const tags = requireUniqueStrings(input.tags, `${label}.tags`, {
    min: 1,
    max: 12,
    pattern: TAG_PATTERN,
    itemMax: 40
  });

  return deepFreeze({
    ...identity,
    name: requireString(input.name, `${label}.name`, { max: 80 }),
    tone: requireEnum(input.tone, `${label}.tone`, TONES),
    category: requireEnum(input.category, `${label}.category`, TECHNIQUE_CATEGORIES),
    attribute: requireEnum(input.attribute, `${label}.attribute`, ATTRIBUTES),
    focusCost: requireInteger(input.focusCost, `${label}.focusCost`, { min: 0, max: 8 }),
    baseEffect: validateBaseEffect(requirePlainObject(input.baseEffect, `${label}.baseEffect`)),
    range: requireEnum(input.range, `${label}.range`, TECHNIQUE_RANGES),
    allowedStances,
    tags,
    cooldownRounds: requireInteger(input.cooldownRounds, `${label}.cooldownRounds`, { min: 0, max: 8 }),
    unlock: validateUnlock(requirePlainObject(input.unlock, `${label}.unlock`)),
    description: requireString(input.description, `${label}.description`, { max: 300 })
  });
}

function validateTutorialStage(input, index) {
  const label = `tutorial.stages[${index}]`;
  assertNoExtraKeys(input, ['id', 'kind', 'title', 'prompt', 'requiresDistinctPlayers', 'recommendedTechniqueIds'], label);
  return {
    id: validateContentId(input.id, `${label}.id`),
    kind: requireEnum(input.kind, `${label}.kind`, TUTORIAL_STAGE_KINDS),
    title: requireString(input.title, `${label}.title`, { max: 80 }),
    prompt: requireString(input.prompt, `${label}.prompt`, { max: 320 }),
    requiresDistinctPlayers: requireBoolean(input.requiresDistinctPlayers, `${label}.requiresDistinctPlayers`),
    recommendedTechniqueIds: requireUniqueStrings(input.recommendedTechniqueIds, `${label}.recommendedTechniqueIds`, {
      min: 0,
      max: 8,
      itemMax: 64
    }).map((id, techniqueIndex) => validateContentId(id, `${label}.recommendedTechniqueIds[${techniqueIndex}]`))
  };
}

export function validateTutorialDefinition(input) {
  const label = 'tutorial';
  const identity = baseIdentity(input, label, [
    'id',
    'version',
    'name',
    'durationHours',
    'startTrigger',
    'stages',
    'canDestroyCircle',
    'collectiveRewardOnce',
    'lateJoinReplay',
    'outcomeVariation',
    'rewardVariants',
    'rumorVariants'
  ]);
  const stages = requireArray(input.stages, `${label}.stages`, { min: 4, max: 4 }).map(validateTutorialStage);
  const expectedKinds = TUTORIAL_STAGE_KINDS.join('|');
  if (stages.map(stage => stage.kind).join('|') !== expectedKinds) {
    throw new NexoContractValidationError('tutorial.stages precisa seguir CHOICE -> ANALYSIS -> ACTION -> RESONANCE');
  }
  if (!stages.at(-1).requiresDistinctPlayers) {
    throw new NexoContractValidationError('tutorial.stages RESONANCE precisa exigir jogadores distintos');
  }
  return deepFreeze({
    ...identity,
    name: requireString(input.name, `${label}.name`, { max: 100 }),
    durationHours: requireInteger(input.durationHours, `${label}.durationHours`, { min: 1, max: 24 }),
    startTrigger: requireEnum(input.startTrigger, `${label}.startTrigger`, ['FIRST_PLAYER_JOINED']),
    stages,
    canDestroyCircle: requireBoolean(input.canDestroyCircle, `${label}.canDestroyCircle`),
    collectiveRewardOnce: requireBoolean(input.collectiveRewardOnce, `${label}.collectiveRewardOnce`),
    lateJoinReplay: requireEnum(input.lateJoinReplay, `${label}.lateJoinReplay`, ['INDIVIDUAL_NO_DUPLICATE_COLLECTIVE_REWARD']),
    outcomeVariation: requireEnum(input.outcomeVariation, `${label}.outcomeVariation`, ['REWARD_AND_RUMOR_ONLY']),
    rewardVariants: requireUniqueStrings(input.rewardVariants, `${label}.rewardVariants`, { min: 2, max: 4, itemMax: 120 }),
    rumorVariants: requireUniqueStrings(input.rumorVariants, `${label}.rumorVariants`, { min: 2, max: 4, itemMax: 180 })
  });
}

function assertUniqueDefinitionIds(items, label) {
  const ids = items.map(item => item.id);
  if (new Set(ids).size !== ids.length) throw new NexoContractValidationError(`${label} contém ids duplicados`);
}

function assertTutorialReferences(tutorial, techniques) {
  const techniqueIds = new Set(techniques.map(technique => technique.id));
  for (const stage of tutorial.stages) {
    for (const techniqueId of stage.recommendedTechniqueIds) {
      if (!techniqueIds.has(techniqueId)) {
        throw new NexoContractValidationError(`tutorial referencia técnica inexistente: ${techniqueId}`);
      }
    }
  }
}

function assertTechniqueToneDistribution(techniques) {
  for (const tone of TONES) {
    const count = techniques.filter(technique => technique.tone === tone).length;
    if (count !== 4) throw new NexoContractValidationError(`conteúdo MVP precisa ter 4 técnicas do tom ${tone}; recebeu ${count}`);
  }
}

export function validateContentPack(input) {
  const label = 'contentPack';
  assertNoExtraKeys(input, ['schemaVersion', 'contentVersion', 'impulses', 'scars', 'origins', 'techniques', 'tutorial'], label);
  if (input.schemaVersion !== CONTENT_SCHEMA_VERSION) {
    throw new NexoContractValidationError(`contentPack.schemaVersion precisa ser ${CONTENT_SCHEMA_VERSION}`);
  }
  const impulses = requireArray(input.impulses, `${label}.impulses`, { min: 4, max: 4 }).map(validateImpulseDefinition);
  const scars = requireArray(input.scars, `${label}.scars`, { min: 4, max: 4 }).map(validateScarDefinition);
  const origins = requireArray(input.origins, `${label}.origins`, { min: 8, max: 8 }).map(validateOriginDefinition);
  const techniques = requireArray(input.techniques, `${label}.techniques`, { min: 16, max: 16 }).map(validateTechniqueDefinition);
  const tutorial = validateTutorialDefinition(requirePlainObject(input.tutorial, `${label}.tutorial`));

  assertUniqueDefinitionIds(impulses, 'impulses');
  assertUniqueDefinitionIds(scars, 'scars');
  assertUniqueDefinitionIds(origins, 'origins');
  assertUniqueDefinitionIds(techniques, 'techniques');
  assertTechniqueToneDistribution(techniques);
  assertTutorialReferences(tutorial, techniques);

  return deepFreeze({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    contentVersion: validateContentVersion(input.contentVersion, `${label}.contentVersion`),
    impulses,
    scars,
    origins,
    techniques,
    tutorial
  });
}
