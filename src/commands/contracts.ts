import type { AppContext } from '../app/context.js';
import type { ConversationEnvelope } from '../domain/conversation.js';

export interface CommandHandler {
  readonly name: string;
  readonly aliases: readonly string[];
  canHandle(message: ConversationEnvelope): boolean;
  handle(message: ConversationEnvelope, context: AppContext): Promise<void>;
}
