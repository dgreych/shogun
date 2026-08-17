import { randomBytes } from 'node:crypto';

import { NexoConflictError, NexoValidationError } from '../errors.js';
import { createMessageViewModel } from './messageContracts.js';

const ACTIVATION_MODES = Object.freeze(['casual', 'campanha', 'evento']);
const ACTIVATION_TTL_MS = 5 * 60 * 1000;
const ACTIVATION_PENDING_TYPE = 'GROUP_ACTIVATION_CONFIRM';

const MODE_LABELS = Object.freeze({
  casual: 'Casual (2 eventos/semana, resumo semanal)',
  campanha: 'Campanha (eventos diários leves, raid semanal)',
  evento: 'Evento (temporada de 1 a 3 semanas, final fechado)'
});

function generateToken() {
  return randomBytes(4).toString('hex').toUpperCase();
}

function requireGroupAdmin(context) {
  if (!context.actor?.isGroupAdmin) {
    throw new NexoValidationError(
      'Esse comando exige admin ou moderador do NEXO.',
      { code: 'NO_PERMISSION' }
    );
  }
}

/**
 * `!nexo ativar [casual|campanha|evento]` -- passo 1: cria a temporada em
 * DRAFT e um token de confirmação com TTL de 5 minutos. Não ativa nada
 * ainda (seção 16 do PDF: exige `!nexo confirmar <token>` em seguida).
 */
async function previewActivation({ repository, context, mode = 'casual' }) {
  requireGroupAdmin(context);
  const normalizedMode = String(mode || 'casual').toLowerCase();
  if (!ACTIVATION_MODES.includes(normalizedMode)) {
    throw new NexoValidationError(
      `Modo inválido. Use: ${ACTIVATION_MODES.join('|')}`,
      { code: 'INVALID_INPUT' }
    );
  }

  const group = await repository.upsertGroup({
    transportChatId: context.incoming.groupId || context.incoming.chatId
  });

  if (group.status === 'ACTIVE') {
    throw new NexoConflictError('O NEXO já está ativo neste grupo.', { code: 'ALREADY_ACTIVE' });
  }

  const seed = randomBytes(8).toString('hex');
  const season = await repository.createDraftSeason({
    groupId: group.id,
    templateId: 'estacao-zero',
    seed
  });

  const token = generateToken();
  await repository.createPendingInteraction({
    userId: context.actor.canonicalUserId,
    chatId: context.incoming.chatId,
    type: ACTIVATION_PENDING_TYPE,
    state: { token, mode: normalizedMode, groupId: group.id, seasonId: season.id },
    ttlMs: ACTIVATION_TTL_MS
  });

  return createMessageViewModel({
    kind: 'CONFIRMATION',
    title: 'NEXO // Ativar Círculo',
    sections: [
      { heading: 'Modo', lines: [MODE_LABELS[normalizedMode]] },
      { heading: 'Confirmação', lines: [`Responda !nexo confirmar ${token} em até 5 minutos.`] }
    ],
    footer: 'Este grupo ainda não vira um Círculo até a confirmação.',
    privacy: 'GROUP',
    priority: 'STATE'
  });
}

/**
 * `!nexo confirmar <token>` -- passo 2: transiciona a temporada DRAFT ->
 * ACTIVE e o grupo INACTIVE -> ACTIVE. Idempotente por messageId (seção
 * 18.2/28.3 do PDF): reprocessar a mesma confirmação nunca ativa duas vezes.
 */
async function confirmActivation({ repository, context, token }) {
  requireGroupAdmin(context);
  if (!token || typeof token !== 'string') {
    throw new NexoValidationError('Informe o token de confirmação.', { code: 'INVALID_INPUT' });
  }

  const pending = await repository.findActivePendingInteraction(
    context.actor.canonicalUserId,
    context.incoming.chatId
  );
  if (!pending || pending.type !== ACTIVATION_PENDING_TYPE) {
    throw new NexoValidationError(
      'Essa escolha expirou. Abra o menu novamente com !nexo ativar.',
      { code: 'PENDING_EXPIRED' }
    );
  }
  if (pending.state.token !== token.toUpperCase()) {
    throw new NexoValidationError('Token inválido.', { code: 'INVALID_INPUT' });
  }

  // Idempotência e ativação na MESMA transação (achado de revisão
  // GPT-NEXO-004: transações separadas podiam deixar o evento marcado
  // como processado sem a temporada ter sido de fato ativada).
  await repository.confirmGroupActivationAtomic({
    messageId: context.incoming.messageId,
    seasonId: pending.state.seasonId,
    aggregateId: pending.state.groupId,
    payload: { mode: pending.state.mode, seasonId: pending.state.seasonId }
  });

  return createMessageViewModel({
    kind: 'CARD',
    title: 'NEXO // CÍRCULO ATIVADO',
    sections: [
      { heading: 'Mundo', lines: ['Este grupo agora abriga uma Crônica.'] },
      { heading: 'Próximos passos', lines: ['Para jogar: !entrar', 'Para entender em 30 s: !ajuda nexo'] }
    ],
    privacy: 'GROUP',
    priority: 'CRITICAL',
    aggregateKey: `group-activated:${pending.state.groupId}`
  });
}

async function getStatus({ repository, context }) {
  const group = await repository.getGroupByTransportChatId(
    context.incoming.groupId || context.incoming.chatId
  );
  if (!group || group.status !== 'ACTIVE') {
    return createMessageViewModel({
      kind: 'CARD',
      title: 'NEXO // Status',
      sections: [{ lines: ['O NEXO não está ativo neste grupo. Um admin pode usar !nexo ativar.'] }],
      privacy: 'GROUP',
      priority: 'NORMAL'
    });
  }
  const season = await repository.getActiveSeasonForGroup(group.id);
  return createMessageViewModel({
    kind: 'CARD',
    title: 'NEXO // Status',
    sections: [{
      heading: 'Círculo',
      lines: [
        `Status: ${group.status}`,
        season ? `Temporada ativa desde ${season.startsAt}` : 'Sem temporada ativa'
      ]
    }],
    privacy: 'GROUP',
    priority: 'NORMAL'
  });
}

/**
 * `!nexo desativar` -- pausa sem apagar dados (seção 16 do PDF: o módulo
 * pausado não intercepta aliases comuns nem apaga estado).
 */
async function deactivateGroup({ repository, context }) {
  requireGroupAdmin(context);
  const group = await repository.getGroupByTransportChatId(
    context.incoming.groupId || context.incoming.chatId
  );
  if (!group || group.status !== 'ACTIVE') {
    throw new NexoValidationError('O NEXO não está ativo neste grupo.', { code: 'RPG_NOT_ACTIVE' });
  }

  // Idempotência e pausa na MESMA transação (mesma correção de
  // GPT-NEXO-004 aplicada a !nexo confirmar).
  await repository.deactivateGroupAtomic({
    messageId: context.incoming.messageId,
    groupId: group.id,
    aggregateId: group.id,
    payload: {}
  });

  return createMessageViewModel({
    kind: 'CONFIRMATION',
    title: 'NEXO // Círculo pausado',
    sections: [{ lines: ['O módulo foi pausado. Nenhum dado foi apagado.'] }],
    privacy: 'GROUP',
    priority: 'STATE'
  });
}

export {
  ACTIVATION_MODES,
  ACTIVATION_PENDING_TYPE,
  ACTIVATION_TTL_MS,
  confirmActivation,
  deactivateGroup,
  getStatus,
  previewActivation
};
