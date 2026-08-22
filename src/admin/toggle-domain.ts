import type { VNextCommandDispatchTarget } from '../runtime/compatibility-dispatch.js';
import { ensureAdminAccess } from './access.js';
import type { AdminExecutionContext } from './contracts.js';
import { findBooleanAdminSetting } from './toggle-catalog.js';
import { JsonGroupStateStore, toggleBoolean } from './state.js';

/**
 * Implementação nativa para configurações booleanas administrativas.
 * Nenhum comando deste domínio chama o executor legado.
 */
export class AdminBooleanSettingsDispatchTarget
implements VNextCommandDispatchTarget<AdminExecutionContext> {
  public async dispatch(
    command: string,
    context: AdminExecutionContext,
  ): Promise<boolean> {
    const descriptor = findBooleanAdminSetting(command);
    if (!descriptor) return false;
    if (!(await ensureAdminAccess(context, descriptor.access))) return true;

    try {
      const store = new JsonGroupStateStore(context.groupFile, context.groupData);
      let enabled = false;
      const state = store.update((current) => {
        enabled = toggleBoolean(current, descriptor.key);
      });

      // O objeto já carregado no runtime continua coerente até que o bootstrap
      // completo passe a ler exclusivamente pelo repositório TypeScript.
      Object.assign(context.groupData, state);
      await context.reply(descriptor.success(enabled, context, state));
    } catch (error) {
      console.error(`[vnext:admin:${descriptor.id}] falha ao persistir configuração:`, error);
      await context.reply(descriptor.errorMessage ?? '❌ Ocorreu um erro interno. Tente novamente em alguns minutos.');
    }

    return true;
  }
}
