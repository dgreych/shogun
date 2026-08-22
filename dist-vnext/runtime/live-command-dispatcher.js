import { CommandCompatibilityDispatch } from './compatibility-dispatch.js';
import { parseCommandText } from '../commands/text-parser.js';
export class LiveCommandDispatcher {
    #compatibility;
    #legacy;
    constructor(vnext, legacy) {
        this.#compatibility = new CommandCompatibilityDispatch(vnext, legacy);
        this.#legacy = legacy;
    }
    async dispatch(input) {
        const parsed = parseCommandText(input.body, input.prefix, input.rawAliases);
        if (!parsed.isCommand || !parsed.command) {
            await this.#legacy.execute(input);
            return Object.freeze({ owner: 'legacy', parsed });
        }
        const owner = await this.#compatibility.dispatch(parsed.command, input);
        return Object.freeze({ owner, parsed });
    }
}
//# sourceMappingURL=live-command-dispatcher.js.map