import type { VNextCommandDispatchTarget } from '../runtime/compatibility-dispatch.js';
import type { ModerationExecutionContext } from '../moderation/domain.js';

export interface MacrotrancheExecutionContext extends ModerationExecutionContext {
  readonly isMacrotrancheOwnedCommand: (command: string) => boolean;
  readonly executeLegacyOwnedCommand: (command: string) => Promise<unknown> | unknown;
  readonly buildMembersScope?: () => Record<string, any> & { command: string };
}

/**
 * Etapa de strangler para a macrotranche ampla.
 *
 * O ownership passa pelo dispatcher vNext, porém a implementação funcional
 * continua sendo executada pelo corpo legado capturado no runtime gerado.
 * Isso permite migrar centenas de aliases/famílias de roteamento de uma vez
 * sem reescrever comportamento antes de existir paridade suficiente para cada
 * domínio interno. A delegação é propositalmente fail-closed: erro em comando
 * owned nunca cai novamente no switch legado e portanto não duplica efeitos.
 */
export class MacrotrancheCompatibilityDomainDispatchTarget
implements VNextCommandDispatchTarget<MacrotrancheExecutionContext> {
  async dispatch(command: string, context: MacrotrancheExecutionContext): Promise<boolean> {
    const normalized = String(command || '').trim().toLowerCase();
    if (!normalized || !context.isMacrotrancheOwnedCommand(normalized)) return false;

    await context.executeLegacyOwnedCommand(normalized);
    return true;
  }
}
