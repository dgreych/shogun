import { resolveCommandInput, } from './input-resolver.js';
import { CommandRouter } from './router.js';
/**
 * Harness de integração do vNext. Une normalização/resolução e router sem
 * participar do bootstrap ou do dispatch operacional legado.
 */
export class CommandDispatchHarness {
    #router;
    constructor(registry) {
        this.#router = new CommandRouter(registry);
    }
    async dispatch(input) {
        const resolved = resolveCommandInput(input.rawCommand, input.rawAliases ?? []);
        const message = resolved.command
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
//# sourceMappingURL=dispatch-harness.js.map