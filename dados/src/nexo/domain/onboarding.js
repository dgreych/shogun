import { NexoValidationError } from '../errors.js';
import { createMessageViewModel } from './messageContracts.js';
import { assertOnboardingContentProvider } from './onboardingContentProvider.js';
import { assignOriginId } from './originAssignment.js';

// Máquina de estado de `!entrar` (seção 19.1 do PDF):
// NONE -> AWAITING_IMPULSE -> AWAITING_SCAR -> GENERATING -> COMPLETE
// Qualquer estado aguardando input expira em 10 min; !cancelar encerra a
// qualquer momento; !entrar de novo depois de EXPIRED/CANCELLED abre uma
// sessão nova. `contentProvider` é injetado -- este módulo nunca importa
// conteúdo real de dados/src/nexo/content/** diretamente.

const ONBOARDING_PENDING_TYPE = 'ONBOARDING';
const ONBOARDING_TTL_MS = 10 * 60 * 1000;
const ONBOARDING_MODES = Object.freeze(['rapido', 'guiado']);

function pickOption(options, rawIndex) {
  const index = Number(rawIndex) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= options.length) return null;
  return options[index];
}

function renderStepPrompt(step, contentProvider) {
  if (step === 'AWAITING_IMPULSE') {
    const impulses = contentProvider.listImpulses();
    return createMessageViewModel({
      kind: 'LIST',
      title: 'NEXO // Sua primeira marca',
      sections: [{ lines: impulses.map((impulse, index) => `${index + 1}. ${impulse.label}`) }],
      footer: `Responda 1 a ${impulses.length}, ou !cancelar.`,
      privacy: 'GROUP',
      priority: 'STATE'
    });
  }
  if (step === 'AWAITING_SCAR') {
    const scars = contentProvider.listScars();
    return createMessageViewModel({
      kind: 'LIST',
      title: 'NEXO // Sua Cicatriz',
      sections: [{ lines: scars.map((scar, index) => `${index + 1}. ${scar.label}`) }],
      footer: `Responda 1 a ${scars.length}, ou !cancelar.`,
      privacy: 'GROUP',
      priority: 'STATE'
    });
  }
  return null;
}

async function requireActiveGroup(repository, context) {
  const group = await repository.getGroupByTransportChatId(
    context.incoming.groupId || context.incoming.chatId
  );
  if (!group || group.status !== 'ACTIVE') {
    throw new NexoValidationError(
      'O NEXO não está ativo neste grupo. Um admin pode usar !nexo ativar.',
      { code: 'RPG_NOT_ACTIVE' }
    );
  }
  return group;
}

/**
 * `!entrar [rápido|guiado]` -- meta do PDF: personagem funcional em até
 * três mensagens do jogador. Este é o passo 1 (mensagem 1: escolha de
 * Impulso).
 */
async function startOnboarding({ repository, context, mode = 'rapido', contentProvider }) {
  assertOnboardingContentProvider(contentProvider);
  const normalizedMode = String(mode || 'rapido').toLowerCase();
  if (!ONBOARDING_MODES.includes(normalizedMode)) {
    throw new NexoValidationError(
      `Modo inválido. Use: ${ONBOARDING_MODES.join('|')}`,
      { code: 'INVALID_INPUT' }
    );
  }

  const group = await requireActiveGroup(repository, context);

  const player = await repository.getOrCreatePlayer({
    userId: context.actor.canonicalUserId,
    groupId: group.id
  });
  const existingCharacter = await repository.getCharacterByPlayerId(player.id);
  if (existingCharacter) {
    throw new NexoValidationError('Você já possui personagem aqui.', { code: 'PLAYER_ALREADY_JOINED' });
  }

  const impulses = contentProvider.listImpulses();
  if (!impulses.length) {
    throw new NexoValidationError('Nenhum impulso disponível ainda.', { code: 'CONTENT_UNAVAILABLE' });
  }

  await repository.createPendingInteraction({
    userId: context.actor.canonicalUserId,
    chatId: context.incoming.chatId,
    type: ONBOARDING_PENDING_TYPE,
    state: { step: 'AWAITING_IMPULSE', mode: normalizedMode, groupId: group.id, playerId: player.id },
    ttlMs: ONBOARDING_TTL_MS
  });

  return renderStepPrompt('AWAITING_IMPULSE', contentProvider);
}

/**
 * Avança um passo da máquina (mensagem 2: Cicatriz; mensagem 3: fecha a
 * ficha). Idempotente por messageId no fechamento -- reprocessar a mesma
 * resposta final nunca cria um segundo personagem.
 */
async function answerOnboardingStep({ repository, context, contentProvider, optionIndex }) {
  assertOnboardingContentProvider(contentProvider);
  const pending = await repository.findActivePendingInteraction(
    context.actor.canonicalUserId,
    context.incoming.chatId
  );
  if (!pending || pending.type !== ONBOARDING_PENDING_TYPE) {
    throw new NexoValidationError('Essa escolha expirou. Comece de novo com !entrar.', { code: 'PENDING_EXPIRED' });
  }

  if (pending.state.step === 'AWAITING_IMPULSE') {
    const impulses = contentProvider.listImpulses();
    const chosen = pickOption(impulses, optionIndex);
    if (!chosen) throw new NexoValidationError('Escolha inválida.', { code: 'INVALID_INPUT' });

    const scars = contentProvider.listScars();
    if (!scars.length) {
      throw new NexoValidationError('Nenhuma cicatriz disponível ainda.', { code: 'CONTENT_UNAVAILABLE' });
    }

    await repository.updatePendingInteractionState(pending.id, {
      step: 'AWAITING_SCAR',
      impulseId: chosen.id
    });

    return renderStepPrompt('AWAITING_SCAR', contentProvider);
  }

  if (pending.state.step === 'AWAITING_SCAR') {
    const scars = contentProvider.listScars();
    const chosen = pickOption(scars, optionIndex);
    if (!chosen) throw new NexoValidationError('Escolha inválida.', { code: 'INVALID_INPUT' });

    // Origem NUNCA é escolha manual (seção 5.2/5.4 do PDF -- "o sistema
    // gera... Origem"), então é derivada aqui, não perguntada. Nome
    // padrão é o nome exibido no WhatsApp quando disponível (seção 5.5),
    // já validado/limitado pelo próprio contrato de IncomingMessage --
    // sem pushName, o personagem fica sem nome, como já era antes.
    const origins = contentProvider.listOrigins();
    const originId = assignOriginId({ impulseId: pending.state.impulseId, scarId: chosen.id, origins });
    const defaultName = context.incoming.sender?.displayName?.trim() || null;

    // Idempotência + criação do personagem + remoção da interação
    // pendente na MESMA transação (achado de revisão GPT-NEXO-004:
    // transações separadas podiam deixar o evento marcado como
    // processado sem o personagem ter sido criado de fato).
    await repository.completeOnboardingAtomic({
      messageId: context.incoming.messageId,
      playerId: pending.state.playerId,
      name: defaultName,
      impulse: pending.state.impulseId,
      scar: chosen.id,
      origin: originId,
      pendingInteractionId: pending.id,
      aggregateId: pending.state.playerId,
      payload: { impulseId: pending.state.impulseId, scarId: chosen.id, originId }
    });

    return createMessageViewModel({
      kind: 'CARD',
      title: 'NEXO // Personagem desperto',
      sections: [{ lines: ['Ficha criada. Use !ficha para ver os detalhes.'] }],
      privacy: 'GROUP',
      priority: 'CRITICAL',
      aggregateKey: `player-joined:${pending.state.playerId}`
    });
  }

  throw new NexoValidationError('Nenhuma escolha pendente reconhecida.', { code: 'PENDING_EXPIRED' });
}

async function cancelOnboarding({ repository, context }) {
  const pending = await repository.findActivePendingInteraction(
    context.actor.canonicalUserId,
    context.incoming.chatId
  );
  if (!pending || pending.type !== ONBOARDING_PENDING_TYPE) {
    throw new NexoValidationError('Não há onboarding pendente para cancelar.', { code: 'PENDING_EXPIRED' });
  }
  await repository.deletePendingInteraction(pending.id);
  return createMessageViewModel({
    kind: 'CONFIRMATION',
    title: 'NEXO // Cancelado',
    sections: [{ lines: ['Onboarding cancelado. Use !entrar quando quiser começar de novo.'] }],
    privacy: 'GROUP',
    priority: 'NORMAL'
  });
}

/**
 * `!continuar` -- retoma a interação pendente válida sem avançar o estado
 * (seção 15.1 do PDF: "Retoma interação pendente válida. Menu atual ou
 * aviso de expiração.").
 */
async function getCurrentOnboardingPrompt({ repository, context, contentProvider }) {
  assertOnboardingContentProvider(contentProvider);
  const pending = await repository.findActivePendingInteraction(
    context.actor.canonicalUserId,
    context.incoming.chatId
  );
  if (!pending || pending.type !== ONBOARDING_PENDING_TYPE) {
    return createMessageViewModel({
      kind: 'CARD',
      title: 'NEXO // Nada pendente',
      sections: [{ lines: ['Não há nenhuma escolha pendente. Use !entrar para começar.'] }],
      privacy: 'GROUP',
      priority: 'NORMAL'
    });
  }
  const prompt = renderStepPrompt(pending.state.step, contentProvider);
  if (!prompt) {
    throw new NexoValidationError('Nenhuma escolha pendente reconhecida.', { code: 'PENDING_EXPIRED' });
  }
  return prompt;
}

export {
  ONBOARDING_MODES,
  ONBOARDING_PENDING_TYPE,
  ONBOARDING_TTL_MS,
  answerOnboardingStep,
  cancelOnboarding,
  getCurrentOnboardingPrompt,
  startOnboarding
};
