import fs from 'node:fs';
/**
 * Fronteira tipada para o JSON de configuração já persistido pelo bot.
 *
 * O formato em disco permanece idêntico ao legado durante a migração. O que
 * muda é quem o manipula: domínios TypeScript passam a concentrar leitura,
 * validação e escrita, em vez de espalhar fs.writeFileSync pelos comandos.
 */
export class JsonGroupStateStore {
    filePath;
    seed;
    constructor(filePath, seed) {
        this.filePath = filePath;
        this.seed = seed;
    }
    read() {
        try {
            if (this.filePath && fs.existsSync(this.filePath)) {
                const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
                if (isRecord(parsed))
                    return parsed;
            }
        }
        catch {
            // Mantém a tolerância histórica do runtime: usa o estado já carregado.
        }
        return { ...this.seed };
    }
    write(state) {
        if (!this.filePath)
            throw new Error('Arquivo de estado do grupo não informado.');
        fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2));
    }
    update(mutator) {
        const state = this.read();
        mutator(state);
        this.write(state);
        return state;
    }
}
export function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function readBoolean(state, key) {
    return state[key] === true;
}
export function toggleBoolean(state, key) {
    const next = state[key] !== true;
    state[key] = next;
    return next;
}
export function readString(state, key) {
    const value = state[key];
    return typeof value === 'string' ? value : undefined;
}
export function readNumber(state, key) {
    const value = state[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
//# sourceMappingURL=state.js.map