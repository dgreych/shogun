import { LegacyCommandExecutorAdapter } from '../adapters/legacy-command-executor.js';
import {
  MenuDomainDispatchTarget,
  type MenuPresentationPort,
} from '../menu/domain.js';
import type {
  LegacyFallbackExecutor,
  VNextCommandDispatchTarget,
} from './compatibility-dispatch.js';
import { CompositeVNextDispatchTarget } from './composite-dispatch.js';
import {
  LiveCommandDispatcher,
  type LiveCommandDispatchInput,
} from './live-command-dispatcher.js';

export interface VNextCommandRuntimeOptions {
  readonly menuPresentation: MenuPresentationPort;
  readonly legacy?: LegacyFallbackExecutor<LiveCommandDispatchInput>;
}

/** Composition root executável da migração de comandos. */
export function createVNextCommandRuntime(
  options: VNextCommandRuntimeOptions,
): LiveCommandDispatcher {
  const menuDomain = new MenuDomainDispatchTarget(options.menuPresentation);

  const menuTarget: VNextCommandDispatchTarget<LiveCommandDispatchInput> = {
    dispatch(command, context) {
      return menuDomain.dispatch(command, context);
    },
  };

  const vnext = new CompositeVNextDispatchTarget<LiveCommandDispatchInput>([
    menuTarget,
  ]);

  const legacyAdapter = options.legacy ?? (() => {
    const adapter = new LegacyCommandExecutorAdapter();
    return {
      execute(context: LiveCommandDispatchInput) {
        return adapter.execute(context);
      },
    } satisfies LegacyFallbackExecutor<LiveCommandDispatchInput>;
  })();

  return new LiveCommandDispatcher(vnext, legacyAdapter);
}
