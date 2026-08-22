function tokensForIndexes(families, indexes) {
  return new Set([...indexes].flatMap((index) => families[index]?.tokens || []));
}

function resolveSeeds(families, seeds, label) {
  const indexes = new Set();
  const unresolved = [];
  for (const rawSeed of seeds) {
    const seed = String(rawSeed || '').trim().toLowerCase();
    if (!seed) continue;
    const matches = families
      .map((family, index) => ({ family, index }))
      .filter(({ family }) => family.tokens.includes(seed));
    if (matches.length === 0) {
      unresolved.push(seed);
      continue;
    }
    if (matches.length > 1) {
      throw new Error(`Seed ${seed} de ${label} é ambíguo: ${matches.map(({ index }) => index).join(',')}.`);
    }
    indexes.add(matches[0].index);
  }
  if (unresolved.length) {
    throw new Error(`Seeds de ${label} não resolvidos: ${unresolved.join(',')}.`);
  }
  return indexes;
}

function closeDuplicateFamilies(families, indexes) {
  const selected = new Set(indexes);
  let changed = true;
  while (changed) {
    changed = false;
    const tokens = tokensForIndexes(families, selected);
    families.forEach((family, index) => {
      if (selected.has(index)) return;
      if (family.tokens.some((token) => tokens.has(token))) {
        selected.add(index);
        changed = true;
      }
    });
  }
  return selected;
}

/**
 * Sobrepõe ownership nativo por domínio completo.
 *
 * O arquivo vnextMacrotrancheSeeds.json continua descrevendo o baseline nativo
 * consolidado. Um domínio em `active` acrescenta ao baseline todas as suas
 * famílias em uma única operação, incluindo famílias externas exigidas por
 * aliases duplicados. Em `staged`, nada muda no ownership.
 *
 * Isso elimina a necessidade de editar dezenas de seeds manualmente no dia do
 * cutover e torna impossível ativar metade de um domínio por acidente.
 */
export function applyAtomicDomainOwnership({
  families,
  baseNativeIndexes,
  seedConfig,
  cutoverConfig,
}) {
  if (cutoverConfig?.schemaVersion !== 2 || cutoverConfig?.strategy !== 'atomic-domain-cutover') {
    throw new Error('Contrato de cutover por domínio inválido para ownership.');
  }

  const nativeIndexes = new Set(baseNativeIndexes);
  const activeDomains = {};
  let addedFamilies = 0;
  let addedTokens = 0;

  for (const [domainName, domain] of Object.entries(cutoverConfig.domains || {})) {
    if (!['staged', 'active'].includes(domain.state)) {
      throw new Error(`Estado inválido no domínio ${domainName}: ${domain.state}.`);
    }
    if (domain.activationMode !== 'all-or-nothing' || domain.duplicateClosure !== 'required') {
      throw new Error(`Domínio ${domainName} não possui contrato atômico completo.`);
    }

    const bucket = seedConfig?.buckets?.[domain.bucket];
    if (!Array.isArray(bucket) || bucket.length === 0) {
      throw new Error(`Bucket ${domain.bucket} ausente para o domínio ${domainName}.`);
    }

    const baseIndexes = resolveSeeds(families, bucket, domainName);
    const baseTokens = tokensForIndexes(families, baseIndexes);
    if (
      baseIndexes.size !== domain.expectedBaseFamilies
      || baseTokens.size !== domain.expectedBaseTokens
    ) {
      throw new Error(
        `Drift na base de ${domainName}: esperado=${domain.expectedBaseFamilies}/${domain.expectedBaseTokens} `
        + `real=${baseIndexes.size}/${baseTokens.size}.`,
      );
    }

    const cutoverIndexes = closeDuplicateFamilies(families, baseIndexes);
    const cutoverTokens = tokensForIndexes(families, cutoverIndexes);
    if (
      cutoverIndexes.size !== domain.expectedCutoverFamilies
      || cutoverTokens.size !== domain.expectedCutoverTokens
    ) {
      throw new Error(
        `Drift no fechamento de ${domainName}: esperado=${domain.expectedCutoverFamilies}/${domain.expectedCutoverTokens} `
        + `real=${cutoverIndexes.size}/${cutoverTokens.size}.`,
      );
    }

    const alreadyNative = [...cutoverIndexes].filter((index) => nativeIndexes.has(index));
    if (domain.state === 'staged') {
      if (alreadyNative.length > 0) {
        throw new Error(
          `Domínio ${domainName} está staged, mas ${alreadyNative.length} família(s) já pertencem ao baseline nativo.`,
        );
      }
      activeDomains[domainName] = {
        state: 'staged',
        families: cutoverIndexes.size,
        tokens: cutoverTokens.size,
        addedFamilies: 0,
        addedTokens: 0,
      };
      continue;
    }

    if (alreadyNative.length > 0) {
      throw new Error(
        `Domínio ${domainName} ativo sobrepõe ownership nativo anterior: ${alreadyNative.join(',')}.`,
      );
    }

    for (const index of cutoverIndexes) nativeIndexes.add(index);
    addedFamilies += cutoverIndexes.size;
    addedTokens += cutoverTokens.size;
    activeDomains[domainName] = {
      state: 'active',
      families: cutoverIndexes.size,
      tokens: cutoverTokens.size,
      addedFamilies: cutoverIndexes.size,
      addedTokens: cutoverTokens.size,
    };
  }

  return {
    nativeIndexes,
    activeDomains,
    delta: {
      nativeFamilies: addedFamilies,
      nativeTokens: addedTokens,
      compatibilityFamilies: addedFamilies === 0 ? 0 : -addedFamilies,
      compatibilityTokens: addedTokens === 0 ? 0 : -addedTokens,
    },
  };
}
