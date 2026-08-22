import { LegacyCommandExecutorAdapter } from '../adapters/legacy-command-executor.js';
import { MenuDomainDispatchTarget, } from '../menu/domain.js';
import { CompositeVNextDispatchTarget } from './composite-dispatch.js';
import { LiveCommandDispatcher, } from './live-command-dispatcher.js';
/** Composition root executável da migração de comandos. */
export function createVNextCommandRuntime(options) {
    const menuDomain = new MenuDomainDispatchTarget(options.menuPresentation);
    const menuTarget = {
        dispatch(command, context) {
            return menuDomain.dispatch(command, context);
        },
    };
    const vnext = new CompositeVNextDispatchTarget([
        menuTarget,
    ]);
    const legacyAdapter = options.legacy ?? (() => {
        const adapter = new LegacyCommandExecutorAdapter();
        return {
            execute(context) {
                return adapter.execute(context);
            },
        };
    })();
    return new LiveCommandDispatcher(vnext, legacyAdapter);
}
//# sourceMappingURL=vnext-command-runtime.js.map