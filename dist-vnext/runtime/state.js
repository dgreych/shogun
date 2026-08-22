export const PRODUCTION_STATE_BOUNDARIES = Object.freeze({
    config: 'dados/src/config.json',
    databaseRoot: 'dados/database',
    whatsappSessionRoot: 'dados/database/qr-code',
    groupSettingsRoot: 'dados/database/grupos',
    ownerStateRoot: 'dados/database/dono',
});
export const GENERATED_RUNTIME_BOUNDARIES = Object.freeze([
    'dados/src/.runtime-start.js',
    'dados/src/.runtime-index.js',
    'dados/src/funcs/private/.runtime-ia.js',
]);
export function normalizeRepositoryPath(value) {
    return value
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .replace(/\/{2,}/g, '/')
        .replace(/\/$/, '');
}
function isPathInside(candidate, root) {
    return candidate === root || candidate.startsWith(`${root}/`);
}
export function classifyDeploymentPath(value) {
    const candidate = normalizeRepositoryPath(value);
    if (candidate === PRODUCTION_STATE_BOUNDARIES.config ||
        isPathInside(candidate, PRODUCTION_STATE_BOUNDARIES.databaseRoot)) {
        return 'preserve-state';
    }
    if (GENERATED_RUNTIME_BOUNDARIES.includes(candidate)) {
        return 'generated-runtime';
    }
    return 'deployable-code';
}
export function isProductionStatePath(value) {
    return classifyDeploymentPath(value) === 'preserve-state';
}
export function assertDeployableCodePath(value) {
    const normalized = normalizeRepositoryPath(value);
    const disposition = classifyDeploymentPath(normalized);
    if (disposition !== 'deployable-code') {
        throw new Error(`Caminho não pode ser promovido como código: ${normalized} (${disposition}).`);
    }
    return normalized;
}
//# sourceMappingURL=state.js.map