import { NexoError } from '../errors.js';
import { createMessageViewModel } from '../domain/messageContracts.js';
import {
  confirmActivation,
  deactivateGroup,
  getStatus,
  previewActivation
} from '../domain/activation.js';

const NEXO_COMMANDS = new Set(['nexo']);
const NEXO_VERSION = '0.1.0-alfa';

function isNexoCommand(command) {
  return NEXO_COMMANDS.has(String(command || '').toLowerCase());
}

function normalizeAction(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
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

function versionViewModel() {
  return createMessageViewModel({
    kind: 'CARD',
    title: 'NEXO // Versão',
    sections: [{ lines: [`Versão: ${NEXO_VERSION}`, 'Schema: v1 (alfa)'] }],
    privacy: 'GROUP',
    priority: 'COSMETIC'
  });
}

const HELP_TOPICS = Object.freeze(['jogador', 'tutorial', 'combate', 'admin']);

function overviewHelpViewModel() {
  return createMessageViewModel({
    kind: 'LIST',
    title: 'NEXO // Ajuda',
    sections: [{
      heading: 'Categorias',
      lines: [
        '1. jogador -- entrar, ver o Círculo, sua ficha, privacidade',
        '2. tutorial -- "A Porta no Ruído", os primeiros passos',
        '3. combate -- enfrentar um inimigo real da Estação Zero',
        '4. admin -- ativar, confirmar, status e desativar o Círculo'
      ]
    }],
    footer: 'Use !nexo ajuda <categoria> (ex.: !nexo ajuda jogador) pra ver os comandos de cada uma.',
    privacy: 'GROUP',
    priority: 'NORMAL'
  });
}

function playerHelpViewModel() {
  return createMessageViewModel({
    kind: 'LIST',
    title: 'NEXO // Ajuda -- Jogador',
    sections: [{
      lines: [
        'entrar [rápido] -- cria seu personagem (duas escolhas, menos de um minuto)',
        'continuar -- retoma uma escolha pendente sem perder o lugar',
        'painel -- mostra o estado atual do Círculo',
        'ficha -- mostra sua ficha (Impulso, Cicatriz, Origem, Patamar)',
        'privado on|off -- decide se suas respostas chegam em DM ou no grupo',
        'cancelar -- cancela uma escolha pendente de onboarding'
      ]
    }],
    footer: '!nexo ajuda pra voltar às categorias.',
    privacy: 'GROUP',
    priority: 'NORMAL'
  });
}

function tutorialHelpViewModel() {
  return createMessageViewModel({
    kind: 'LIST',
    title: 'NEXO // Ajuda -- Tutorial',
    sections: [{
      heading: '"A Porta no Ruído"',
      lines: [
        'tutorial -- mostra a etapa atual',
        'tutorial <número> -- escolhe a postura (Cautela, Pulso ou Ruptura)',
        'tutorial analisar -- tenta ler o que não foi dito',
        'tutorial agir <número> -- responde com uma técnica'
      ]
    }],
    footer: 'Precisa ter personagem (!entrar) e o Círculo ativo. !nexo ajuda pra voltar às categorias.',
    privacy: 'GROUP',
    priority: 'NORMAL'
  });
}

function combatHelpViewModel() {
  return createMessageViewModel({
    kind: 'LIST',
    title: 'NEXO // Ajuda -- Combate',
    sections: [{
      heading: 'Estação Zero',
      lines: [
        'combate <inimigoId> <técnicaId> [postura] -- ataca um inimigo real',
        'postura: cautela (mais seguro), pulso (padrão) ou ruptura (mais arriscado)',
        'chame de novo com o mesmo inimigoId pra continuar o mesmo combate'
      ]
    }],
    footer: 'Veja !ficha pra suas técnicas disponíveis. !nexo ajuda pra voltar às categorias.',
    privacy: 'GROUP',
    priority: 'NORMAL'
  });
}

function adminHelpViewModel() {
  return createMessageViewModel({
    kind: 'LIST',
    title: 'NEXO // Ajuda -- Administração',
    sections: [{
      lines: [
        'nexo ativar [casual|campanha|evento] -- ativa o Círculo neste grupo',
        'nexo confirmar <token> -- confirma a ativação em até 5 min',
        'nexo status -- mostra o estado atual do Círculo',
        'nexo desativar -- pausa sem apagar dados',
        'nexo versão -- mostra a versão instalada'
      ]
    }],
    footer: 'Restrito a admin/moderador do grupo. !nexo ajuda pra voltar às categorias.',
    privacy: 'GROUP',
    priority: 'NORMAL'
  });
}

function helpViewModel(topic) {
  const normalized = normalizeAction(topic);
  if (!normalized) return overviewHelpViewModel();
  if (normalized === 'jogador' || normalized === '1') return playerHelpViewModel();
  if (normalized === 'tutorial' || normalized === '2') return tutorialHelpViewModel();
  if (normalized === 'combate' || normalized === '3') return combatHelpViewModel();
  if (normalized === 'admin' || normalized === 'administracao' || normalized === '4') return adminHelpViewModel();
  return createMessageViewModel({
    kind: 'ERROR',
    title: 'NEXO // Ajuda',
    sections: [{ lines: [`Categoria "${topic}" não existe. Use: ${HELP_TOPICS.join(', ')}.`] }],
    privacy: 'GROUP',
    priority: 'NORMAL'
  });
}

/**
 * Único ponto de roteamento de `!nexo <ação>`. Cada handler chama um caso
 * de uso testável em domain/ e sempre devolve um MessageViewModel -- nunca
 * deixa uma exceção crua vazar para o transporte (seção 17.3 do PDF).
 */
async function handleNexoAction({ repository, context, action, args }) {
  const normalized = normalizeAction(action);
  try {
    switch (normalized) {
      case '':
      case 'ajuda':
      case 'help':
        return helpViewModel(args[0]);
      case 'ativar':
        return await previewActivation({ repository, context, mode: args[0] });
      case 'confirmar':
        return await confirmActivation({ repository, context, token: args[0] });
      case 'status':
        return await getStatus({ repository, context });
      case 'desativar':
        return await deactivateGroup({ repository, context });
      case 'versao':
      case 'version':
        return versionViewModel();
      default:
        return createMessageViewModel({
          kind: 'ERROR',
          title: 'NEXO // Ação desconhecida',
          sections: [{ lines: [`Não reconheço "${action}". Use !nexo ajuda para ver as opções.`] }],
          privacy: 'GROUP',
          priority: 'NORMAL'
        });
    }
  } catch (error) {
    return errorToViewModel(error);
  }
}

export {
  NEXO_COMMANDS,
  NEXO_VERSION,
  handleNexoAction,
  helpViewModel,
  isNexoCommand,
  versionViewModel
};
