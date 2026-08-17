import { NexoConflictError, NexoValidationError } from '../errors.js';
import { createMessageViewModel } from './messageContracts.js';
import { ESTACAO_ZERO_ENEMIES_BY_ID, TECHNIQUES_BY_ID } from '../content/index.js';
import { deriveAttributeValue, findImpulseDefinition } from './attributes.js';
import { computeDamage } from './combatFormulas.js';
import {
  lockEncounterRound,
  openEncounterRound,
  resolveEncounterRound,
  submitAction
} from './encounterEngine.js';

// Primeiro combate real contra conteúdo publicado (Estação Zero,
// GPT-NEXO-006) usando o motor síncrono de encounterEngine.js (seção 8
// do PDF). Escopo deliberadamente cortado pra caber num teste real hoje:
// SOLO apenas -- um personagem por combate, sem esperar outros
// jogadores nem janela de tempo (isso depende de um worker de jobs
// agendados que ainda não existe, CL-NEXO-001 só fundou a persistência
// dele). `!combate` abre, submete, trava e resolve a rodada na MESMA
// chamada; combate cooperativo real fica pra quando o motor de rodada
// aberta por múltiplos jogadores for exposto por comando (a lógica de
// vários submissores já existe em encounterEngine.js, só não está
// ligada a um fluxo de espera ainda).

const BASE_DIFFICULTY = 8; // seção 8.3: "dificuldade padrão é 8 + tier do encontro + resistência situacional" -- Fase 1 usa tier fixo 1, sem resistência situacional extra ainda
const RETALIATION_DIVISOR = 10; // simplificação documentada: Intenção real (seção 8.6, telegrafada e escolhível) ainda não existe -- retaliação é dano fixo pequeno proporcional ao hpBase do inimigo

function getEnemyDefinition(enemyId) {
  const enemy = ESTACAO_ZERO_ENEMIES_BY_ID[enemyId];
  if (!enemy) throw new NexoValidationError('Inimigo não encontrado no conteúdo publicado.', { code: 'CONTENT_UNAVAILABLE', enemyId });
  return enemy;
}

// seção 6.2: Vitalidade = 12 + (3 x Sustento) + Patamar
function deriveMaxVitality(character, impulse) {
  const sustain = deriveAttributeValue(impulse, 'SUSTAIN');
  return 12 + 3 * sustain + character.tier;
}

async function requireCharacterAndSeason({ repository, context }) {
  const group = await repository.getGroupByTransportChatId(context.incoming.groupId || context.incoming.chatId);
  if (!group || group.status !== 'ACTIVE') {
    throw new NexoValidationError('O NEXO não está ativo neste grupo.', { code: 'RPG_NOT_ACTIVE' });
  }
  const player = await repository.getPlayerByUserAndGroup(context.actor.canonicalUserId, group.id);
  const character = player ? await repository.getCharacterByPlayerId(player.id) : null;
  if (!player || !character) {
    throw new NexoValidationError('Você ainda não tem personagem aqui. Use !entrar.', { code: 'PLAYER_NOT_JOINED' });
  }
  const season = await repository.getActiveSeasonForGroup(group.id);
  if (!season) throw new NexoValidationError('Sem temporada ativa.', { code: 'RPG_NOT_ACTIVE' });
  return { group, player, character, season };
}

function combatEncounterType(enemyId, userId) {
  return `MISSION_COMBAT:${enemyId}:${userId}`;
}

async function getOrCreateCombatEncounter({ repository, season, group, enemyId, userId, enemyDef, maxVitality }) {
  const type = combatEncounterType(enemyId, userId);
  const existing = await repository.getEncounterBySeasonAndType(season.id, type);
  if (existing) return existing;

  const created = await repository.createEncounter({
    seasonId: season.id,
    groupId: group.id,
    type,
    seed: `${season.seed}:${type}`
  });
  return repository.transitionEncounter(created.id, created.version, {
    stateDataPatch: {
      enemyId,
      enemyName: enemyDef.name,
      enemyHp: enemyDef.hpBase,
      enemyMaxHp: enemyDef.hpBase,
      enemyGuard: enemyDef.guarda,
      playerVitality: maxVitality,
      playerMaxVitality: maxVitality,
      log: []
    }
  });
}

function intentForRound(enemyDef, round) {
  if (!enemyDef.intentLabels.length) return null;
  return enemyDef.intentLabels[(round - 1) % enemyDef.intentLabels.length];
}

/**
 * `!combate <inimigoId> <técnicaId> [postura]` -- ataca (ou inicia
 * contra) um inimigo real da Estação Zero. Cada chamada resolve uma
 * rodada inteira (abre, submete, trava, resolve) e devolve o resultado;
 * o jogador chama de novo pra continuar o mesmo combate até Vitória ou
 * Derrota.
 */
async function attackEnemy({ repository, context, enemyId, techniqueId, stance = 'PULSE' }) {
  const { group, character, season } = await requireCharacterAndSeason({ repository, context });
  const userId = context.actor.canonicalUserId;

  const enemyDef = getEnemyDefinition(enemyId);
  const technique = TECHNIQUES_BY_ID[techniqueId];
  if (!technique) {
    throw new NexoValidationError('Técnica desconhecida. Use !ficha ou consulte as técnicas do seu tom.', { code: 'INVALID_INPUT' });
  }

  const impulse = findImpulseDefinition(character.impulse);
  const maxVitality = deriveMaxVitality(character, impulse);

  let encounter = await getOrCreateCombatEncounter({
    repository, season, group, enemyId, userId, enemyDef, maxVitality
  });

  if (['VICTORY', 'DEFEAT'].includes(encounter.state)) {
    throw new NexoConflictError(
      encounter.state === 'VICTORY'
        ? 'Você já venceu este inimigo. Escolha outro alvo.'
        : 'Você caiu neste combate. Procure apoio antes de tentar de novo.',
      { state: encounter.state }
    );
  }

  encounter = await openEncounterRound({ repository, encounterId: encounter.id });
  await submitAction({
    repository,
    encounterId: encounter.id,
    playerId: userId,
    payload: { techniqueId, tone: technique.tone, stance }
  });
  encounter = await lockEncounterRound({ repository, encounterId: encounter.id });

  const { encounter: afterRoll, results } = await resolveEncounterRound({
    repository,
    encounterId: encounter.id,
    seasonSeed: season.seed,
    attributeFor: () => deriveAttributeValue(impulse, technique.attribute),
    difficultyFor: () => BASE_DIFFICULTY
  });

  const playerRoll = results[0].roll;
  const damageToEnemy = playerRoll.outcome === 'SETBACK' ? 0 : computeDamage({
    baseTechnique: technique.baseEffect?.damage || 0,
    impact: deriveAttributeValue(impulse, 'IMPACT'),
    margin: playerRoll.margin,
    guard: afterRoll.stateData.enemyGuard,
    effectMultiplier: playerRoll.effectMultiplier
  });

  const enemyHpAfter = Math.max(0, afterRoll.stateData.enemyHp - damageToEnemy);
  const lines = [`${technique.name} (${playerRoll.stance}): ${playerRoll.outcome}, ${damageToEnemy} de dano.`];

  let finalState = null;
  let stateDataPatch = { enemyHp: enemyHpAfter };

  if (enemyHpAfter <= 0) {
    finalState = 'VICTORY';
    lines.push(`${enemyDef.name} caiu. Vitória.`);
  } else {
    const retaliation = Math.max(1, Math.floor(enemyDef.hpBase / RETALIATION_DIVISOR));
    const vitalityAfter = Math.max(0, afterRoll.stateData.playerVitality - retaliation);
    stateDataPatch.playerVitality = vitalityAfter;
    lines.push(`${enemyDef.name} revida: ${retaliation} de dano.`);
    const intent = intentForRound(enemyDef, afterRoll.round + 1);
    if (intent) lines.push(`Intenção seguinte: "${intent}".`);
    if (vitalityAfter <= 0) {
      finalState = 'DEFEAT';
      lines.push('Você caiu neste combate.');
    }
  }

  const finalized = await repository.transitionEncounter(afterRoll.id, afterRoll.version, {
    ...(finalState ? { state: finalState } : {}),
    stateDataPatch
  });

  return createMessageViewModel({
    kind: 'CARD',
    title: `NEXO // Combate -- ${enemyDef.name}`,
    sections: [{
      lines: [
        ...lines,
        finalState
          ? ''
          : `${enemyDef.name}: ${finalized.stateData.enemyHp}/${enemyDef.hpBase} | Sua Vitalidade: ${finalized.stateData.playerVitality}/${maxVitality}`
      ].filter(Boolean)
    }],
    privacy: 'GROUP',
    priority: finalState ? 'CRITICAL' : 'STATE'
  });
}

export { attackEnemy, deriveMaxVitality, getEnemyDefinition };
