import type { ConversationEnvelope } from '../domain/conversation.js';

export type CompatibilityDispatchOwner = 'vnext' | 'legacy';

export interface VNextEnvelopeDispatcher {
  dispatch(message: ConversationEnvelope): Promise<boolean>;
}

export interface LegacyFallbackExecutor<TLegacyInput> {
  execute(input: TLegacyInput): Promise<void>;
}

/**
 * Seam original de envelope mantido para os gates R0–R5.
 */
export class CompatibilityDispatch<TLegacyInput> {
  constructor(
    private readonly vnext: VNextEnvelopeDispatcher,
    private readonly legacy: LegacyFallbackExecutor<TLegacyInput>,
  ) {}

  async dispatch(
    message: ConversationEnvelope,
    legacyInput: TLegacyInput,
  ): Promise<CompatibilityDispatchOwner> {
    const handledByVNext = await this.vnext.dispatch(message);
    if (handledByVNext) return 'vnext';

    await this.legacy.execute(legacyInput);
    return 'legacy';
  }
}

/**
 * Contrato R6 para ownership por comando já normalizado.
 * É separado do dispatcher de ConversationEnvelope para não falsificar tipos
 * nem quebrar o seam já qualificado nas fases anteriores.
 */
export interface VNextCommandDispatchTarget<TContext> {
  dispatch(command: string, context: TContext): Promise<boolean>;
}

export class CommandCompatibilityDispatch<TContext> {
  constructor(
    private readonly vnext: VNextCommandDispatchTarget<TContext>,
    private readonly legacy: LegacyFallbackExecutor<TContext>,
  ) {}

  async dispatch(
    command: string,
    context: TContext,
  ): Promise<CompatibilityDispatchOwner> {
    const handledByVNext = await this.vnext.dispatch(command, context);
    if (handledByVNext) return 'vnext';

    await this.legacy.execute(context);
    return 'legacy';
  }
}
