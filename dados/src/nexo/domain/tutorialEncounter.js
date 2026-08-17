import { NexoConflictError, NexoValidationError } from '../errors.js';
import { createMessageViewModel } from './messageContracts.js';
import { NEXO_MVP_CONTENT, TECHNIQUES_BY_ID } from '../content/index.js';
import { createSeededRng } from './rng.js';
import { resolveRoll } from './combatFormulas.js';
import { detectResonance } from './resonance.js';
import { deriveAttributeValue, findImpulseDefinition } from './attributes.js';

// Orquestra "A Porta no Ruído" (seção 5.6 do PDF) sobre a fundação
// mecânica de CL-NEXO-004. Progresso é POR JOGADOR (stateData.players),
// não global do encontro -- é isso que permite duas coisas ao mesmo
// tempo: Ressonância real entre pessoas diferentes agindo em momentos
// distintos, e "jogadores posteriores repetem o tutorial em versão
// individual sem duplicar recompensa coletiva" (lateJoinReplay do
// conteúdo) surge naturalmente de cada um ter seu próprio progresso.
//
// Decisão de arquitetura: o tutorial NÃO usa encounterEngine.js (abrir/
// travar/resolver rodada). Esse motor é para encontros SÍNCRONOS de
// janela fechada (missões, raids). O tutorial é assíncrono por natureza
// -- cada jogador pode agir horas depois do outro -- então cada ação é
// resolvida e anexada à cadeia de Ressonância no momento em que chega,
// sem esperar travar uma "rodada" coletiva.

const POSTURE_LABELS = Object.freeze({ CAUTION: 'Cautela', PULSE: 'Pulso', RUPTURE: 'Ruptura' });
const READING_DIFFICULTY = 8;
const ACTION_DIFFICULTY = 8;

function getTutorialDefinition() {
  return NEXO_MVP_CONTENT.tutorial;
}

function getStage(stageId) {
  const stage = getTutorialDefinition().stages.find(entry => entry.id === stageId);
  if (!stage) throw new NexoValidationError('Etapa do tutorial não encontrada', { stageId });
  return stage;
}

function getPlayerProgress(encounter, userId) {
  return encounter.stateData.players?.[userId] || { stage: 'first_choice' };
}

async function requireCharacterAndEncounter({ repository, context }) {
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
  // "iniciado quando o primeiro jogador entra" (seção 5.6) -- garantir
  // aqui em vez de exigir um gatilho externo separado; idempotente por
  // temporada, então quem chega depois só encontra o mesmo encontro.
  const encounter = await ensureTutorialEncounter({ repository, seasonId: season.id, groupId: group.id });
  return { group, player, character, season, encounter };
}

/**
 * Cria o encontro do tutorial na primeira entrada de jogador na temporada
 * (seção 5.6: "iniciado quando o primeiro jogador entra"). Idempotente
 * por temporada -- uma Crônica só tem um encontro TUTORIAL.
 */
async function ensureTutorialEncounter({ repository, seasonId, groupId }) {
  const existing = await repository.getEncounterBySeasonAndType(seasonId, 'TUTORIAL');
  if (existing) return existing;

  const created = await repository.createEncounter({
    seasonId,
    groupId,
    type: 'TUTORIAL',
    seed: `${seasonId}:tutorial`
  });
  return repository.transitionEncounter(created.id, created.version, {
    stateDataPatch: { players: {}, resonanceChain: [], collectiveRewardGranted: false }
  });
}

function renderStageViewModel(stage) {
  if (stage.id === 'first_choice') {
    return createMessageViewModel({
      kind: 'LIST',
      title: `NEXO // ${stage.title}`,
      sections: [{
        lines: [
          stage.prompt,
          '1. Cautela -- avança com cuidado, efeito reduzido, quase nunca falha feio.',
          '2. Pulso -- resposta equilibrada.',
          '3. Ruptura -- resposta arriscada, efeito ampliado se der certo.'
        ]
      }],
      footer: 'Responda 1, 2 ou 3.',
      privacy: 'GROUP',
      priority: 'STATE'
    });
  }
  if (stage.id === 'read_the_noise') {
    return createMessageViewModel({
      kind: 'CONFIRMATION',
      title: `NEXO // ${stage.title}`,
      sections: [{ lines: [stage.prompt, 'Use !tutorial analisar para tentar ler o que não foi dito.'] }],
      privacy: 'GROUP',
      priority: 'STATE'
    });
  }
  if (stage.id === 'answer_the_door') {
    const options = stage.recommendedTechniqueIds
      .map(id => TECHNIQUES_BY_ID[id])
      .filter(Boolean);
    return createMessageViewModel({
      kind: 'LIST',
      title: `NEXO // ${stage.title}`,
      sections: [{
        lines: [
          stage.prompt,
          ...options.map((technique, index) => `${index + 1}. ${technique.name} (${technique.tone})`)
        ]
      }],
      footer: 'Use !tutorial agir <número>.',
      privacy: 'GROUP',
      priority: 'STATE'
    });
  }
  return createMessageViewModel({
    kind: 'CARD',
    title: `NEXO // ${stage.title}`,
    sections: [{ lines: [stage.prompt] }],
    privacy: 'GROUP',
    priority: 'NORMAL'
  });
}

async function previewTutorialStage({ repository, context }) {
  const { encounter } = await requireCharacterAndEncounter({ repository, context });
  const progress = getPlayerProgress(encounter, context.actor.canonicalUserId);
  if (progress.stage === 'complete') {
    return createMessageViewModel({
      kind: 'CARD',
      title: 'NEXO // A Porta no Ruído',
      sections: [{ lines: ['Você já concluiu o tutorial neste Círculo.'] }],
      privacy: 'GROUP',
      priority: 'NORMAL'
    });
  }
  return renderStageViewModel(getStage(progress.stage));
}

/**
 * Estágio 1 (CHOICE): escolha de postura -- decisão real já modelada
 * pelas fórmulas de combate, sem inventar texto narrativo novo.
 */
async function submitTutorialChoice({ repository, context, optionIndex }) {
  const { encounter } = await requireCharacterAndEncounter({ repository, context });
  const userId = context.actor.canonicalUserId;
  const progress = getPlayerProgress(encounter, userId);
  if (progress.stage !== 'first_choice') {
    throw new NexoConflictError('Essa escolha não está disponível agora.', { stage: progress.stage });
  }
  const postures = ['CAUTION', 'PULSE', 'RUPTURE'];
  const index = Number(optionIndex) - 1;
  const stance = postures[index];
  if (!stance) throw new NexoValidationError('Escolha inválida. Use 1, 2 ou 3.', { code: 'INVALID_INPUT' });

  await repository.transitionEncounter(encounter.id, encounter.version, {
    stateDataPatch: {
      players: { ...encounter.stateData.players, [userId]: { stage: 'read_the_noise', stance } }
    }
  });

  return createMessageViewModel({
    kind: 'CONFIRMATION',
    title: 'NEXO // Postura escolhida',
    sections: [{ lines: [`Você decide responder com ${POSTURE_LABELS[stance]}.`] }],
    privacy: 'GROUP',
    priority: 'STATE'
  });
}

/**
 * Estágio 2 (ANALYSIS): teste de Leitura determinístico (a seed inclui o
 * canonicalUserId -- reprocessar a mesma mensagem nunca rola de novo,
 * mas cada jogador tem sua própria rolagem).
 */
async function submitTutorialAnalysis({ repository, context }) {
  const { character, encounter, season } = await requireCharacterAndEncounter({ repository, context });
  const userId = context.actor.canonicalUserId;
  const progress = getPlayerProgress(encounter, userId);
  if (progress.stage !== 'read_the_noise') {
    throw new NexoConflictError('Não há nada para analisar agora.', { stage: progress.stage });
  }

  const impulse = findImpulseDefinition(character.impulse);
  const attributeValue = deriveAttributeValue(impulse, 'READING');
  const rng = createSeededRng({
    seasonSeed: season.seed,
    encounterId: encounter.id,
    round: 'analysis',
    actionId: userId
  });
  const roll = resolveRoll({ rng, attributeValue, difficulty: READING_DIFFICULTY, stance: 'PULSE' });
  const succeeded = roll.outcome !== 'SETBACK';

  await repository.recordGameEvent({
    aggregateType: 'TUTORIAL',
    aggregateId: encounter.id,
    eventType: 'TutorialAnalysisRolled',
    payload: { playerId: userId, dieRoll: roll.dieRoll, roll: roll.roll, margin: roll.margin, outcome: roll.outcome },
    messageId: context.incoming.messageId
  });

  await repository.transitionEncounter(encounter.id, encounter.version, {
    stateDataPatch: {
      players: {
        ...encounter.stateData.players,
        [userId]: { ...progress, stage: 'answer_the_door', analysis: { outcome: roll.outcome, succeeded } }
      }
    }
  });

  return createMessageViewModel({
    kind: 'CARD',
    title: 'NEXO // Leia o que não foi dito',
    sections: [{
      lines: succeeded
        ? ['Você identifica uma Fratura: a Ruptura hesita diante de respostas diretas.']
        : ['Você não consegue separar sinal de ruído a tempo -- mas a porta continua se abrindo.']
    }],
    privacy: 'GROUP',
    priority: 'NORMAL'
  });
}

/**
 * Estágio 3+4 (ACTION -> RESONANCE): resolve a ação individualmente e
 * anexa à cadeia compartilhada do encontro. Se a ação combina com a de
 * outra pessoa (nunca a mesma -- seção 7.4), a Ressonância acontece na
 * hora. A primeira pessoa a concluir fecha a recompensa coletiva; quem
 * chega depois faz a mesma jornada em versão individual, sem duplicar
 * essa recompensa (lateJoinReplay do conteúdo) -- ainda sem sistema de
 * recompensa real pra conceder, mas a distinção já fica registrada.
 */
async function submitTutorialAction({ repository, context, optionIndex }) {
  const { character, encounter, season, player } = await requireCharacterAndEncounter({ repository, context });
  const userId = context.actor.canonicalUserId;
  const progress = getPlayerProgress(encounter, userId);
  if (progress.stage !== 'answer_the_door') {
    throw new NexoConflictError('Não há ação para responder agora.', { stage: progress.stage });
  }

  const stage = getStage('answer_the_door');
  const options = stage.recommendedTechniqueIds.map(id => TECHNIQUES_BY_ID[id]).filter(Boolean);
  const index = Number(optionIndex) - 1;
  const technique = options[index];
  if (!technique) throw new NexoValidationError('Escolha inválida.', { code: 'INVALID_INPUT' });

  const stance = progress.stance || 'PULSE';
  const impulse = findImpulseDefinition(character.impulse);
  const attributeValue = deriveAttributeValue(impulse, technique.attribute);
  const rng = createSeededRng({
    seasonSeed: season.seed,
    encounterId: encounter.id,
    round: 'action',
    actionId: userId
  });
  const roll = resolveRoll({ rng, attributeValue, difficulty: ACTION_DIFFICULTY, stance });

  await repository.recordGameEvent({
    aggregateType: 'TUTORIAL',
    aggregateId: encounter.id,
    eventType: 'TutorialActionRolled',
    payload: {
      playerId: userId,
      techniqueId: technique.id,
      stance,
      dieRoll: roll.dieRoll,
      roll: roll.roll,
      margin: roll.margin,
      outcome: roll.outcome
    },
    messageId: context.incoming.messageId
  });

  const chainSoFar = Array.isArray(encounter.stateData.resonanceChain) ? encounter.stateData.resonanceChain : [];
  const chainEntry = {
    tone: technique.tone,
    playerId: userId,
    techniqueId: technique.id,
    hasRealEffect: roll.outcome !== 'SETBACK'
  };
  const updatedChain = [...chainSoFar, chainEntry].slice(-20);
  const combo = detectResonance(updatedChain);

  const isFirstToComplete = !encounter.stateData.collectiveRewardGranted;

  await repository.transitionEncounter(encounter.id, encounter.version, {
    stateDataPatch: {
      players: {
        ...encounter.stateData.players,
        [userId]: { ...progress, stage: 'complete', lastOutcome: roll.outcome }
      },
      resonanceChain: updatedChain,
      collectiveRewardGranted: true
    }
  });

  const lines = [`${technique.name} (${POSTURE_LABELS[stance]}): ${roll.outcome}.`];
  if (combo) {
    lines.push(`Ressonância: ${combo.name}! Sua ação se combina com a de outra pessoa do Círculo.`);
  }
  lines.push(isFirstToComplete
    ? 'Tutorial concluído -- o Círculo registra a primeira passagem coletiva.'
    : 'Tutorial concluído em versão individual -- a recompensa coletiva já foi registrada por outra pessoa.');

  return createMessageViewModel({
    kind: 'CARD',
    title: combo ? 'NEXO // Ressonância!' : 'NEXO // Responda à Ruptura',
    sections: [{ lines }],
    privacy: 'GROUP',
    priority: 'CRITICAL',
    aggregateKey: `tutorial-action:${encounter.id}:${userId}`
  });
}

export {
  ensureTutorialEncounter,
  previewTutorialStage,
  submitTutorialAction,
  submitTutorialAnalysis,
  submitTutorialChoice
};
