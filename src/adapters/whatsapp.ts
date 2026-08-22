import type { ConversationEnvelope } from '../domain/conversation.js';

/**
 * Baileys permanece fora do domínio. A implementação concreta só será criada
 * quando houver casos de paridade para mensagens reais do legado.
 */
export interface WhatsAppMessageAdapter {
  toConversation(input: unknown): ConversationEnvelope | null;
}
