import type {
  LegacyFallbackExecutor,
  VNextCommandDispatchTarget,
} from './compatibility-dispatch.js';
import { CommandCompatibilityDispatch } from './compatibility-dispatch.js';
import { parseCommandText, type ParsedCommandText } from '../commands/text-parser.js';
import type { MenuExecutionContext } from '../menu/domain.js';

export interface LiveCommandDispatchInput extends MenuExecutionContext {
  readonly body: string;
  readonly rawAliases: unknown;
  readonly chatId: string;
  readonly sender: string;
  readonly isGroup: boolean;
}

export interface LiveCommandDispatchReceipt {
  readonly owner: 'vnext' | 'legacy';
  readonly parsed: ParsedCommandText;
}

export class LiveCommandDispatcher {
  readonly #compatibility: CommandCompatibilityDispatch<LiveCommandDispatchInput>;
  readonly #legacy: LegacyFallbackExecutor<LiveCommandDispatchInput>;

  constructor(
    vnext: VNextCommandDispatchTarget<LiveCommandDispatchInput>,
    legacy: LegacyFallbackExecutor<LiveCommandDispatchInput>,
  ) {
    this.#compatibility = new CommandCompatibilityDispatch(vnext, legacy);
    this.#legacy = legacy;
  }

  async dispatch(input: LiveCommandDispatchInput): Promise<LiveCommandDispatchReceipt> {
    const parsed = parseCommandText(input.body, input.prefix, input.rawAliases);

    if (!parsed.isCommand || !parsed.command) {
      await this.#legacy.execute(input);
      return Object.freeze({ owner: 'legacy', parsed });
    }

    const owner = await this.#compatibility.dispatch(parsed.command, input);
    return Object.freeze({ owner, parsed });
  }
}
