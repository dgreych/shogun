export type DeploymentPathDisposition = 'preserve-state' | 'generated-runtime' | 'deployable-code';

export const PRODUCTION_STATE_BOUNDARIES = Object.freeze({
  config: 'dados/src/config.json',
  databaseRoot: 'dados/database',
  whatsappSessionRoot: 'dados/database/qr-code',
  groupSettingsRoot: 'dados/database/grupos',
  ownerStateRoot: 'dados/database/dono',
} as const);

export const GENERATED_RUNTIME_BOUNDARIES = Object.freeze([
  'dados/src/.runtime-start.js',
  'dados/src/.runtime-index.js',
  'dados/src/funcs/private/.runtime-ia.js',
] as const);

export function normalizeRepositoryPath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/$/, '');
}

function isPathInside(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`);
}

export function classifyDeploymentPath(value: string): DeploymentPathDisposition {
  const candidate = normalizeRepositoryPath(value);

  if (
    candidate === PRODUCTION_STATE_BOUNDARIES.config ||
    isPathInside(candidate, PRODUCTION_STATE_BOUNDARIES.databaseRoot)
  ) {
    return 'preserve-state';
  }

  if (GENERATED_RUNTIME_BOUNDARIES.includes(
    candidate as (typeof GENERATED_RUNTIME_BOUNDARIES)[number],
  )) {
    return 'generated-runtime';
  }

  return 'deployable-code';
}

export function isProductionStatePath(value: string): boolean {
  return classifyDeploymentPath(value) === 'preserve-state';
}

export function assertDeployableCodePath(value: string): string {
  const normalized = normalizeRepositoryPath(value);
  const disposition = classifyDeploymentPath(normalized);
  if (disposition !== 'deployable-code') {
    throw new Error(`Caminho não pode ser promovido como código: ${normalized} (${disposition}).`);
  }
  return normalized;
}
