export type ConversationKind = 'private' | 'group';

/**
 * Envelope neutro para a futura camada de domínio. R0 não adapta mensagens
 * do Baileys e não participa do dispatch legado.
 */
export interface ConversationEnvelope {
  readonly chatId: string;
  readonly senderId: string;
  readonly kind: ConversationKind;
  readonly text: string;
  readonly command?: string;
  readonly quotedMessageId?: string;
}
