/**
 * Registry estrutural do vNext. Tokens entram já normalizados pela futura
 * camada de adapter/domain; R0 não redefine a normalização do legado.
 */
export class CommandRegistry {
    #byToken = new Map();
    constructor(handlers = []) {
        for (const handler of handlers)
            this.register(handler);
    }
    register(handler) {
        for (const token of [handler.name, ...handler.aliases]) {
            if (this.#byToken.has(token)) {
                throw new Error(`Duplicate vNext command token: ${token}`);
            }
            this.#byToken.set(token, handler);
        }
    }
    resolve(token) {
        return this.#byToken.get(token);
    }
    list() {
        return [...new Set(this.#byToken.values())];
    }
}
//# sourceMappingURL=registry.js.map