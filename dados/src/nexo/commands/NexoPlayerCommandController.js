import { NexoError, NexoValidationError } from '../errors.js';
import { createMessageViewModel } from '../domain/messageContracts.js';
import {
  answerOnboardingStep,
  cancelOnboarding,
  getCurrentOnboardingPrompt,
  startOnboarding
} from '../domain/onboarding.js';
import { getGroupDashboard } from '../domain/dashboard.js';
import { getCharacterSheet } from '../domain/characterSheet.js';
import {
  previewTutorialStage,
  submitTutorialAction,
  submitTutorialAnalysis,
  submitTutorialChoice
} from '../domain/tutorialEncounter.js';
import { setPrivacyPreference } from '../domain/privacySettings.js';
import { attackEnemy } from '../domain/missionEncounter.js';

// Comandos de jogador de nível superior (fora do namespace `!nexo <ação>`,
// que é administrativo). Seção 15.1 do PDF.
const NEXO_PLAYER_COMMANDS = new Set(['entrar', 'continuar', 'painel', 'ficha', 'privado', 'tutorial', 'cancelar', 'combate']);

function isNexoPlayerCommand(command) {
  return NEXO_PLAYER_COMMANDS.has(String(command || '').toLowerCase());
}

function errorToViewModel(error) {
  const message = error instanceof NexoError
    ? error.message
    : 'Não consegui completar esse comando agora.';
  return createMessageViewModel({
    kind: 'ERROR',
    title: 'NEXO // Erro',
    sections: [{ lines: [message] }],
    privacy: 'GROUP',
    priority: 'NORMAL'
  });
}

function normalizePrivadoArg(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'on') return true;
  if (normalized === 'off') return false;
  throw new NexoValidationError('Use !privado on ou !privado off.', { code: 'INVALID_INPUT' });
}

/**
 * `!tutorial` (sem args) mostra a etapa atual; `!tutorial <número>`
 * responde a etapa de escolha; `!tutorial analisar` e `!tutorial agir
 * <número>` avançam as etapas seguintes. Cada etapa valida sozinha se é
 * a vez dela (domain/tutorialEncounter.js), então uma ordem errada aqui
 * só gera um erro claro, nunca corrompe estado.
 */
async function handleTutorialSubcommand({ repository, context, args }) {
  const [first, second] = args;
  if (!first) {
    return previewTutorialStage({ repository, context });
  }
  const keyword = String(first).toLowerCase();
  if (keyword === 'analisar') {
    return submitTutorialAnalysis({ repository, context });
  }
  if (keyword === 'agir') {
    return submitTutorialAction({ repository, context, optionIndex: second });
  }
  if (/^\d+$/.test(first)) {
    return submitTutorialChoice({ repository, context, optionIndex: first });
  }
  return createMessageViewModel({
    kind: 'ERROR',
    title: 'NEXO // Uso do tutorial',
    sections: [{
      lines: [
        'Use: !tutorial (ver etapa atual), !tutorial <número> (na escolha), ' +
          '!tutorial analisar ou !tutorial agir <número>.'
      ]
    }],
    privacy: 'GROUP',
    priority: 'NORMAL'
  });
}

/**
 * `!combate <inimigoId> <técnicaId> [postura]` -- ataca um inimigo real
 * publicado em dados/src/nexo/content/estacaoZero.js. Postura opcional,
 * default PULSE (seção 8.4).
 */
async function handleCombatSubcommand({ repository, context, args }) {
  const [enemyId, techniqueId, stance] = args;
  if (!enemyId || !techniqueId) {
    return createMessageViewModel({
      kind: 'ERROR',
      title: 'NEXO // Uso do combate',
      sections: [{ lines: ['Use: !combate <inimigoId> <técnicaId> [cautela|pulso|ruptura].'] }],
      privacy: 'GROUP',
      priority: 'NORMAL'
    });
  }
  const stanceMap = { cautela: 'CAUTION', pulso: 'PULSE', ruptura: 'RUPTURE' };
  const normalizedStance = stance ? stanceMap[String(stance).toLowerCase()] : undefined;
  if (stance && !normalizedStance) {
    return createMessageViewModel({
      kind: 'ERROR',
      title: 'NEXO // Postura inválida',
      sections: [{ lines: ['Use cautela, pulso ou ruptura.'] }],
      privacy: 'GROUP',
      priority: 'NORMAL'
    });
  }
  return attackEnemy({
    repository,
    context,
    enemyId,
    techniqueId,
    ...(normalizedStance ? { stance: normalizedStance } : {})
  });
}

/**
 * Roteia `!entrar`, `!continuar`, `!painel`, `!ficha`, `!privado on|off`,
 * `!tutorial`, `!combate` e `!cancelar`. Cada handler chama um caso de uso
 * testável e sempre devolve um MessageViewModel.
 */
async function handleNexoPlayerAction({ repository, context, contentProvider, command, args }) {
  const normalized = String(command || '').toLowerCase();
  try {
    switch (normalized) {
      case 'entrar':
        return await startOnboarding({ repository, context, mode: args[0], contentProvider });
      case 'continuar':
        return await getCurrentOnboardingPrompt({ repository, context, contentProvider });
      case 'cancelar':
        return await cancelOnboarding({ repository, context });
      case 'painel':
        return await getGroupDashboard({ repository, context });
      case 'ficha':
        return await getCharacterSheet({ repository, context, contentProvider });
      case 'privado':
        return await setPrivacyPreference({ repository, context, enabled: normalizePrivadoArg(args[0]) });
      case 'tutorial':
        return await handleTutorialSubcommand({ repository, context, args });
      case 'combate':
        return await handleCombatSubcommand({ repository, context, args });
      default:
        return createMessageViewModel({
          kind: 'ERROR',
          title: 'NEXO // Comando desconhecido',
          sections: [{ lines: [`Não reconheço "${command}". Use !nexo ajuda.`] }],
          privacy: 'GROUP',
          priority: 'NORMAL'
        });
    }
  } catch (error) {
    return errorToViewModel(error);
  }
}

/**
 * Resposta contextual por número puro (seção 13.1 do PDF) -- só chamado
 * quando o runtime já confirmou que existe pendingInteraction ativa.
 */
async function handleNexoNumericReply({ repository, context, contentProvider, optionIndex }) {
  try {
    return await answerOnboardingStep({ repository, context, contentProvider, optionIndex });
  } catch (error) {
    return errorToViewModel(error);
  }
}

export {
  NEXO_PLAYER_COMMANDS,
  handleNexoNumericReply,
  handleNexoPlayerAction,
  isNexoPlayerCommand
};
