import { URL } from 'node:url';
async function defaultLegacyModuleLoader() {
    const moduleUrl = new URL('../../dados/src/index.js', import.meta.url);
    return import(moduleUrl.href);
}
function resolveLegacyExecutor(moduleValue) {
    if (!moduleValue || typeof moduleValue !== 'object') {
        throw new Error('Módulo legado de comandos inválido.');
    }
    const record = moduleValue;
    const candidate = record.default ?? record.NazuninhaBotExec;
    if (typeof candidate !== 'function') {
        throw new Error('dados/src/index.js não exporta executor de comandos compatível.');
    }
    return candidate;
}
/**
 * Único ponto autorizado do vNext para alcançar o dispatcher monolítico
 * durante a migração. O módulo é carregado uma vez e permanece isolado atrás
 * do contrato LegacyFallbackExecutor até a cobertura legada chegar a zero.
 */
export class LegacyCommandExecutorAdapter {
    loader;
    #executorPromise;
    constructor(loader = defaultLegacyModuleLoader) {
        this.loader = loader;
    }
    async #executor() {
        if (!this.#executorPromise) {
            this.#executorPromise = this.loader().then(resolveLegacyExecutor);
        }
        return this.#executorPromise;
    }
    async execute(input) {
        const executor = await this.#executor();
        await executor(input.socket, input.message, input.mediaPath ?? null, input.messagesCache, input.rentalExpirationManager);
    }
}
//# sourceMappingURL=legacy-command-executor.js.map