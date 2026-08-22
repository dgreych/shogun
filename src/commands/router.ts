import type { AppContext } from '../app/context.js';
import type { ConversationEnvelope } from '../domain/conversation.js';
import { CommandRegistry } from './registry.js';

export class CommandRouter {
  constructor(private readonly registry: CommandRegistry) {}

  async dispatch(message: ConversationEnvelope, context: AppContext): Promise<boolean> {
    if (!message.command) return false;
    const handler = this.registry.resolve(message.command);
    if (!handler || !handler.canHandle(message)) return false;
    await handler.handle(message, context);
    return true;
  }
}
