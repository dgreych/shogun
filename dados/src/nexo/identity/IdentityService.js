import { NexoValidationError } from '../errors.js';

const ADDRESS_TYPES = Object.freeze({ LID: 'LID', PN: 'PN', USERNAME: 'USERNAME' });

/**
 * Classifica um endereço bruto do WhatsApp (JID) sem nunca tratar o número
 * de telefone como identidade -- apenas como um dos tipos de alias
 * possíveis, exatamente como os demais.
 */
function classifyAddress(rawAddress) {
  if (typeof rawAddress !== 'string' || !rawAddress.trim()) {
    throw new NexoValidationError('Endereço bruto inválido para classificação de alias');
  }
  const trimmed = rawAddress.trim();
  if (trimmed.endsWith('@lid')) return ADDRESS_TYPES.LID;
  if (trimmed.endsWith('@s.whatsapp.net') || trimmed.endsWith('@c.us')) return ADDRESS_TYPES.PN;
  return ADDRESS_TYPES.USERNAME;
}

function normalizeAddressValue(rawAddress) {
  return String(rawAddress).trim().toLowerCase();
}

/**
 * Camada de identidade do NEXO: resolve um usuário canônico interno (UUID)
 * a partir de um ou mais endereços brutos (LID, PN, username), criando o
 * usuário só quando nenhum alias já é conhecido. O canonicalUserId nunca é
 * um telefone -- é sempre o `id` gerado por NexoRepository.
 */
class IdentityService {
  constructor(repository) {
    this.repository = repository;
  }

  async resolveCanonicalUser({ addresses, displayName = null, locale = 'pt-BR' }) {
    if (!Array.isArray(addresses) || !addresses.filter(Boolean).length) {
      throw new NexoValidationError('É preciso ao menos um endereço para resolver identidade');
    }
    const aliases = addresses
      .filter(Boolean)
      .map(raw => ({ type: classifyAddress(raw), value: normalizeAddressValue(raw) }));
    return this.repository.resolveOrCreateUserByAliases(aliases, { displayName, locale });
  }

  async resolveExistingUserId(rawAddress) {
    const type = classifyAddress(rawAddress);
    const value = normalizeAddressValue(rawAddress);
    return this.repository.resolveUserIdByAlias(type, value);
  }
}

export { ADDRESS_TYPES, IdentityService, classifyAddress, normalizeAddressValue };
