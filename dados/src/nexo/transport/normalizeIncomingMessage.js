import { NexoValidationError } from '../errors.js';
import { createIncomingMessage } from '../domain/messageContracts.js';

// A integração real com dados/src/index.js (extrair estes campos do objeto
// de contexto que o bot já monta antes do switch principal, o mesmo padrão
// usado por handleTavernCommand) é tarefa de CL-NEXO-002, quando o primeiro
// comando visível (`!nexo ativar`) for implementado. Esta função já define
// o contrato de entrada esperado, para não recomeçar do zero então.
//
// `raw` esperado:
// {
//   messageId, chatId, groupId?, senderLid?, senderJid, pushName?,
//   text?, mentionedJids?, quotedMessageId?, quotedSenderJid?, quotedText?,
//   reactionEmoji?, reactionTargetMessageId?, timestamp, capabilities?
// }

/**
 * Converte o contexto já normalizado pelo bot (não o objeto bruto do
 * Baileys) em um IncomingMessage validado, resolvendo a identidade
 * canônica do remetente via IdentityService -- nunca usando o JID/telefone
 * como sender.canonicalId.
 */
async function normalizeIncomingMessage({ raw, identityService }) {
  if (!raw || typeof raw !== 'object') {
    throw new NexoValidationError('Contexto bruto de mensagem ausente');
  }
  if (!identityService) {
    throw new NexoValidationError('IdentityService é obrigatório para normalizar a mensagem');
  }

  const addresses = [raw.senderLid, raw.senderJid].filter(Boolean);
  const user = await identityService.resolveCanonicalUser({
    addresses,
    displayName: raw.pushName || undefined
  });

  return createIncomingMessage({
    messageId: raw.messageId,
    chatId: raw.chatId,
    groupId: raw.groupId,
    sender: {
      canonicalId: user.id,
      displayName: raw.pushName,
      addressingId: raw.senderLid || raw.senderJid
    },
    text: raw.text,
    mentions: raw.mentionedJids,
    quoted: raw.quotedMessageId
      ? {
        messageId: raw.quotedMessageId,
        senderId: raw.quotedSenderJid,
        text: raw.quotedText
      }
      : undefined,
    reaction: raw.reactionEmoji
      ? {
        emoji: raw.reactionEmoji,
        targetMessageId: raw.reactionTargetMessageId
      }
      : undefined,
    timestamp: raw.timestamp,
    capabilities: raw.capabilities
  });
}

export { normalizeIncomingMessage };
