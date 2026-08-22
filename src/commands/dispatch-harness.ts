import type { AppContext } from '../app/context.js';
import type { ConversationEnvelope } from '../domain/conversation.js';
import {
  resolveCommandInput,
  type CommandResolutionSource,
  type NormalizedCommandAlias,
} from './input-resolver.js';
import { CommandRegistry } from './registry.js';
import { CommandRouter } from './router.js';

export interface CommandDispatchHarnessInput {
  readonly rawCommand: unknown;
  readonly rawAliases?: unknown;
  readonly message: Omit<ConversationEnvelope, 'command'>;
  readonly context: AppContext;
}

export interface CommandDispatchHarnessResult {
  readonly dispatched: boolean;
  readonly command: string;
  readonly source: CommandResolutionSource;
  readonly matchedAlias: NormalizedCommandAlias | null;
}

/**
 * Harness de integração do vNext. Une normalização/resolução e router sem
 * participar do bootstrap ou do dispatch operacional legado.
 */
export class CommandDispatchHarness {
  readonly #router: CommandRouter;

  constructor(registry: CommandRegistry) {
    this.#router = new CommandRouter(registry);
  }

  async dispatch(input: CommandDispatchHarnessInput): Promise<CommandDispatchHarnessResult> {
    const resolved = resolveCommandInput(input.rawCommand, input.rawAliases ?? []);
    const message: ConversationEnvelope = resolved.command
      ? { ...input.message, command: resolved.command }
      : { ...input.message };
    const dispatched = await this.#router.dispatch(message, input.context);

    return {
      dispatched,
      command: resolved.command,
      source: resolved.source,
      matchedAlias: resolved.matchedAlias,
    };
  }
}
