export const BUILTIN_COMMAND_ALIASES = Object.freeze({
    d: 'delete',
    del: 'delete',
    deletar: 'delete',
    delete: 'delete',
});
function normalizeLegacyText(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
export function normalizeCommandToken(value) {
    const legacyTruthyValue = value ? value : '';
    return normalizeLegacyText(String(legacyTruthyValue).trim()).replace(/\s+/g, '');
}
export function normalizeCommandAliases(rawData) {
    const rawRecord = rawData && typeof rawData === 'object'
        ? rawData
        : null;
    const source = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawRecord?.aliases)
            ? rawRecord.aliases
            : [];
    const seen = new Set();
    const aliases = [];
    for (const item of source) {
        if (!item || typeof item !== 'object')
            continue;
        const record = item;
        const alias = normalizeCommandToken(record.alias);
        const command = normalizeCommandToken(record.command);
        if (!alias || !command || seen.has(alias))
            continue;
        if (Object.prototype.hasOwnProperty.call(BUILTIN_COMMAND_ALIASES, alias))
            continue;
        seen.add(alias);
        aliases.push({
            ...record,
            alias,
            command,
            fixedParams: typeof record.fixedParams === 'string' ? record.fixedParams.trim() : '',
        });
    }
    return aliases;
}
export function resolveCommandInput(rawToken, rawAliases = []) {
    const token = normalizeCommandToken(rawToken);
    const builtinCommand = BUILTIN_COMMAND_ALIASES[token];
    if (builtinCommand) {
        return {
            command: builtinCommand,
            matchedAlias: null,
            source: 'builtin',
        };
    }
    const aliases = normalizeCommandAliases(rawAliases);
    const matchedAlias = aliases.find((item) => item.alias === token) ?? null;
    return {
        command: matchedAlias?.command ?? token,
        matchedAlias,
        source: matchedAlias ? 'custom' : 'direct',
    };
}
//# sourceMappingURL=input-resolver.js.map