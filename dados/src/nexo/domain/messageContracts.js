import { NexoValidationError } from '../errors.js';

// Contratos internos do NEXO (seção 17.4 da especificação). Vivem em
// domain/, não em dados/src/nexo/contracts/**, que é área reservada ao GPT
// para os contratos de CONTEÚDO declarativo (tons, impulsos, cicatrizes,
// versões de conteúdo) -- estes aqui são só o transporte/mensageria
// internos, necessários antes de qualquer regra de jogo existir.

const MESSAGE_VIEW_MODEL_KINDS = Object.freeze(['CARD', 'LIST', 'CONFIRMATION', 'ERROR', 'DIGEST']);
const MESSAGE_PRIVACY_LEVELS = Object.freeze(['GROUP', 'PRIVATE_IF_CONSENTED', 'PRIVATE_ONLY']);
const MESSAGE_PRIORITIES = Object.freeze(['CRITICAL', 'STATE', 'NORMAL', 'COSMETIC']);

function requireString(value, label, { optional = false, maxLength = 191 } = {}) {
  if (value === undefined || value === null) {
    if (optional) return undefined;
    throw new NexoValidationError(`${label} é obrigatório`);
  }
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new NexoValidationError(`${label} inválido`);
  }
  return value;
}

function requireEnum(value, label, allowed) {
  if (!allowed.includes(value)) {
    throw new NexoValidationError(`${label} precisa ser um de: ${allowed.join(', ')}`);
  }
  return value;
}

function normalizeStringArray(value, label, { maxItems = 64 } = {}) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new NexoValidationError(`${label} precisa ser uma lista com no máximo ${maxItems} itens`);
  }
  return value.map(item => requireString(item, `${label}[]`));
}

/**
 * Normaliza as capacidades que o transporte anuncia suportar. Nunca deve
 * ser inferido "otimisticamente" -- vem do adapter real.
 */
function createTransportCapabilities(input = {}) {
  return Object.freeze({
    text: Boolean(input.text ?? true),
    reaction: Boolean(input.reaction),
    poll: Boolean(input.poll),
    edit: Boolean(input.edit),
    list: Boolean(input.list),
    button: Boolean(input.button)
  });
}

/**
 * IncomingMessage: forma normalizada de qualquer evento de entrada, já sem
 * nenhum objeto bruto do Baileys. `sender.canonicalId` é o ID interno
 * (UUID) resolvido por IdentityService -- nunca o JID/telefone.
 */
function createIncomingMessage(input = {}) {
  const messageId = requireString(input.messageId, 'messageId');
  const chatId = requireString(input.chatId, 'chatId');
  const groupId = requireString(input.groupId, 'groupId', { optional: true });

  if (!input.sender || typeof input.sender !== 'object') {
    throw new NexoValidationError('sender é obrigatório');
  }
  const sender = {
    canonicalId: requireString(input.sender.canonicalId, 'sender.canonicalId'),
    displayName: requireString(input.sender.displayName, 'sender.displayName', { optional: true, maxLength: 80 }),
    addressingId: requireString(input.sender.addressingId, 'sender.addressingId')
  };

  const text = requireString(input.text, 'text', { optional: true, maxLength: 4096 });
  const mentions = normalizeStringArray(input.mentions, 'mentions');

  let quoted;
  if (input.quoted) {
    quoted = {
      messageId: requireString(input.quoted.messageId, 'quoted.messageId'),
      senderId: requireString(input.quoted.senderId, 'quoted.senderId', { optional: true }),
      text: requireString(input.quoted.text, 'quoted.text', { optional: true, maxLength: 4096 })
    };
  }

  let reaction;
  if (input.reaction) {
    reaction = {
      emoji: requireString(input.reaction.emoji, 'reaction.emoji', { maxLength: 8 }),
      targetMessageId: requireString(input.reaction.targetMessageId, 'reaction.targetMessageId')
    };
  }

  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new NexoValidationError('timestamp inválido');
  }

  return Object.freeze({
    messageId,
    chatId,
    groupId,
    sender: Object.freeze(sender),
    text,
    mentions: Object.freeze(mentions),
    quoted: quoted ? Object.freeze(quoted) : undefined,
    reaction: reaction ? Object.freeze(reaction) : undefined,
    timestamp,
    capabilities: createTransportCapabilities(input.capabilities)
  });
}

/**
 * CommandContext: o que os handlers de comando efetivamente recebem. É
 * sempre derivado de um IncomingMessage já validado.
 */
function createCommandContext({
  correlationId,
  incoming,
  actor,
  groupGame,
  locale = 'pt-BR',
  now = new Date(),
  idempotencyKey
}) {
  requireString(correlationId, 'correlationId');
  if (!incoming || typeof incoming !== 'object' || !incoming.messageId) {
    throw new NexoValidationError('incoming precisa ser um IncomingMessage já normalizado');
  }
  if (!actor || typeof actor !== 'object' || !actor.canonicalUserId) {
    throw new NexoValidationError('actor.canonicalUserId é obrigatório');
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new NexoValidationError('now precisa ser uma Date válida');
  }
  requireString(idempotencyKey, 'idempotencyKey');

  return Object.freeze({
    correlationId,
    incoming,
    actor: Object.freeze({ ...actor }),
    groupGame: groupGame ? Object.freeze({ ...groupGame }) : undefined,
    locale,
    now,
    idempotencyKey
  });
}

/**
 * MessageViewModel: única forma pela qual um handler de domínio devolve
 * saída -- nunca uma string montada ad hoc (seção 17.3 do PDF).
 */
function createMessageViewModel({
  kind,
  title,
  sections,
  actions,
  footer,
  privacy,
  priority,
  aggregateKey
}) {
  requireEnum(kind, 'kind', MESSAGE_VIEW_MODEL_KINDS);
  requireEnum(privacy, 'privacy', MESSAGE_PRIVACY_LEVELS);
  requireEnum(priority, 'priority', MESSAGE_PRIORITIES);

  const normalizedSections = Array.isArray(sections)
    ? sections.map(section => ({
      heading: requireString(section.heading, 'sections[].heading', { optional: true, maxLength: 120 }),
      lines: normalizeStringArray(section.lines, 'sections[].lines', { maxItems: 64 })
    }))
    : [];

  const normalizedActions = Array.isArray(actions)
    ? actions.map(action => ({
      id: requireString(action.id, 'actions[].id', { maxLength: 40 }),
      label: requireString(action.label, 'actions[].label', { maxLength: 60 }),
      command: requireString(action.command, 'actions[].command', { maxLength: 120 })
    }))
    : [];

  return Object.freeze({
    kind,
    title: requireString(title, 'title', { optional: true, maxLength: 120 }),
    sections: Object.freeze(normalizedSections),
    actions: Object.freeze(normalizedActions),
    footer: requireString(footer, 'footer', { optional: true, maxLength: 200 }),
    privacy,
    priority,
    aggregateKey: requireString(aggregateKey, 'aggregateKey', { optional: true })
  });
}

export {
  MESSAGE_PRIORITIES,
  MESSAGE_PRIVACY_LEVELS,
  MESSAGE_VIEW_MODEL_KINDS,
  createCommandContext,
  createIncomingMessage,
  createMessageViewModel,
  createTransportCapabilities
};
