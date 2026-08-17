export class NexoContractValidationError extends TypeError {
  constructor(message) {
    super(message);
    this.name = 'NexoContractValidationError';
    this.code = 'NEXO_CONTRACT_INVALID';
  }
}

export const CONTENT_ID_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
export const CONTENT_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const CONTENT_REF_PATTERN = /^[a-z][a-z0-9_]{1,63}@[1-9]\d*$/;
export const TAG_PATTERN = /^[A-Z][A-Z0-9_]{0,39}$/;

export function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new NexoContractValidationError(`${label} precisa ser um objeto simples`);
  }
  return value;
}

export function assertNoExtraKeys(value, allowedKeys, label) {
  requirePlainObject(value, label);
  const allowed = new Set(allowedKeys);
  const extras = Object.keys(value).filter(key => !allowed.has(key));
  if (extras.length) {
    throw new NexoContractValidationError(`${label} possui campos não permitidos: ${extras.join(', ')}`);
  }
}

export function requireString(value, label, { min = 1, max = 240, pattern } = {}) {
  if (typeof value !== 'string') {
    throw new NexoContractValidationError(`${label} precisa ser texto`);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new NexoContractValidationError(`${label} precisa ter entre ${min} e ${max} caracteres`);
  }
  if (pattern && !pattern.test(normalized)) {
    throw new NexoContractValidationError(`${label} possui formato inválido`);
  }
  return normalized;
}

export function requireBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new NexoContractValidationError(`${label} precisa ser booleano`);
  }
  return value;
}

export function requireInteger(value, label, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new NexoContractValidationError(`${label} precisa ser inteiro entre ${min} e ${max}`);
  }
  return value;
}

export function requireEnum(value, label, allowed) {
  if (!allowed.includes(value)) {
    throw new NexoContractValidationError(`${label} precisa ser um de: ${allowed.join(', ')}`);
  }
  return value;
}

export function requireArray(value, label, { min = 0, max = 64 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new NexoContractValidationError(`${label} precisa conter entre ${min} e ${max} itens`);
  }
  return value;
}

export function requireUniqueStrings(value, label, { min = 0, max = 64, pattern, itemMax = 80 } = {}) {
  const items = requireArray(value, label, { min, max }).map((item, index) =>
    requireString(item, `${label}[${index}]`, { max: itemMax, pattern })
  );
  if (new Set(items).size !== items.length) {
    throw new NexoContractValidationError(`${label} não pode conter valores duplicados`);
  }
  return items;
}

export function validateContentId(value, label = 'id') {
  return requireString(value, label, { min: 2, max: 64, pattern: CONTENT_ID_PATTERN });
}

export function validateDefinitionVersion(value, label = 'version') {
  return requireInteger(value, label, { min: 1, max: 9999 });
}

export function validateContentVersion(value, label = 'contentVersion') {
  return requireString(value, label, { min: 5, max: 32, pattern: CONTENT_VERSION_PATTERN });
}

export function makeContentRef(id, version) {
  return `${validateContentId(id)}@${validateDefinitionVersion(version)}`;
}

export function validateContentRef(value, label = 'contentRef') {
  return requireString(value, label, { min: 4, max: 72, pattern: CONTENT_REF_PATTERN });
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
