import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPreparedRuntimeCommandSource } from './analyze-runtime-command-surface.mjs';
import { planMacrotrancheBridge } from '../dados/src/.scripts/vnextMacrotrancheBridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SEEDS_FILE = path.join(ROOT, 'dados', 'src', '.scripts', 'vnextMacrotrancheSeeds.json');
const CUTOVER_FILE = path.join(ROOT, 'dados', 'src', '.scripts', 'vnextDomainCutoverPlan.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function resolveFamilyIndex(families, seed, domainName) {
  const matches = families
    .map((family, index) => ({ family, index }))
    .filter(({ family }) => family.tokens.includes(seed));

  if (matches.length !== 1) {
    throw new Error(
      `Seed ${seed} do domínio ${domainName} precisa resolver exatamente uma família; encontrado ${matches.length}.`,
    );
  }
  return matches[0].index;
}

function tokensForIndexes(families, indexes) {
  return new Set([...indexes].flatMap((index) => families[index]?.tokens || []));
}

function closeDuplicateFamilies(families, baseIndexes) {
  const selected = new Set(baseIndexes);
  let changed = true;

  while (changed) {
    changed = false;
    const selectedTokens = tokensForIndexes(families, selected);
    families.forEach((family, index) => {
      if (selected.has(index)) return;
      if (family.tokens.some((token) => selectedTokens.has(token))) {
        selected.add(index);
        changed = true;
      }
    });
  }

  return selected;
}

export function planDomainCutovers() {
  const seedConfig = readJson(SEEDS_FILE);
  const cutoverConfig = readJson(CUTOVER_FILE);
  if (cutoverConfig?.schemaVersion !== 2 || cutoverConfig?.strategy !== 'atomic-domain-cutover') {
    throw new Error('Contrato de cutover por domínio inválido.');
  }

  const source = buildPreparedRuntimeCommandSource();
  const ownership = planMacrotrancheBridge(source);
  const nativeIndexes = new Set(ownership.nativeIndexes);
  const compatibilityIndexes = new Set(ownership.compatibilityIndexes);
  const summaries = {};

  for (const [domainName, domain] of Object.entries(cutoverConfig.domains || {})) {
    const bucketSeeds = seedConfig?.buckets?.[domain.bucket];
    if (!Array.isArray(bucketSeeds) || bucketSeeds.length === 0) {
      throw new Error(`Bucket ${domain.bucket} do domínio ${domainName} não existe ou está vazio.`);
    }
    if (domain.activationMode !== 'all-or-nothing') {
      throw new Error(`Domínio ${domainName} precisa usar activationMode=all-or-nothing.`);
    }
    if (domain.duplicateClosure !== 'required') {
      throw new Error(`Domínio ${domainName} precisa exigir fechamento de famílias duplicadas.`);
    }
    if (!['staged', 'active'].includes(domain.state)) {
      throw new Error(`Estado inválido para ${domainName}: ${domain.state}.`);
    }

    const baseFamilyIndexes = new Set(
      bucketSeeds.map((seed) => resolveFamilyIndex(ownership.families, seed, domainName)),
    );
    const baseTokens = tokensForIndexes(ownership.families, baseFamilyIndexes);
    const cutoverFamilyIndexes = closeDuplicateFamilies(ownership.families, baseFamilyIndexes);
    const cutoverTokens = tokensForIndexes(ownership.families, cutoverFamilyIndexes);
    const closureIndexes = [...cutoverFamilyIndexes].filter((index) => !baseFamilyIndexes.has(index));

    if (
      baseFamilyIndexes.size !== domain.expectedBaseFamilies
      || baseTokens.size !== domain.expectedBaseTokens
    ) {
      throw new Error(
        `Drift na base do domínio ${domainName}: esperado=${domain.expectedBaseFamilies}/${domain.expectedBaseTokens} `
        + `real=${baseFamilyIndexes.size}/${baseTokens.size}.`,
      );
    }
    if (
      cutoverFamilyIndexes.size !== domain.expectedCutoverFamilies
      || cutoverTokens.size !== domain.expectedCutoverTokens
    ) {
      throw new Error(
        `Drift no fechamento do domínio ${domainName}: esperado=${domain.expectedCutoverFamilies}/${domain.expectedCutoverTokens} `
        + `real=${cutoverFamilyIndexes.size}/${cutoverTokens.size}.`,
      );
    }

    const nativeFamilies = [...cutoverFamilyIndexes].filter((index) => nativeIndexes.has(index));
    const compatibilityFamilies = [...cutoverFamilyIndexes].filter((index) => compatibilityIndexes.has(index));
    const unresolvedOwnership = [...cutoverFamilyIndexes].filter(
      (index) => !nativeIndexes.has(index) && !compatibilityIndexes.has(index),
    );

    if (unresolvedOwnership.length > 0) {
      throw new Error(`Domínio ${domainName} contém famílias sem ownership: ${unresolvedOwnership.join(',')}.`);
    }

    const mixed = nativeFamilies.length > 0 && compatibilityFamilies.length > 0;
    if (mixed) {
      throw new Error(
        `Cutover parcial proibido em ${domainName}: ${nativeFamilies.length} família(s) nativa(s) e `
        + `${compatibilityFamilies.length} ainda no bridge.`,
      );
    }
    if (domain.state === 'staged' && nativeFamilies.length > 0) {
      throw new Error(`Domínio ${domainName} está staged, mas já possui famílias nativas.`);
    }
    if (domain.state === 'active' && compatibilityFamilies.length > 0) {
      throw new Error(`Domínio ${domainName} está active, mas ainda possui famílias no bridge.`);
    }

    summaries[domainName] = {
      state: domain.state,
      activationMode: domain.activationMode,
      duplicateClosure: domain.duplicateClosure,
      baseFamilies: baseFamilyIndexes.size,
      baseTokens: baseTokens.size,
      families: cutoverFamilyIndexes.size,
      tokens: cutoverTokens.size,
      closureFamilies: closureIndexes.length,
      closureAddedTokens: cutoverTokens.size - baseTokens.size,
      nativeFamilies: nativeFamilies.length,
      compatibilityFamilies: compatibilityFamilies.length,
      sampleTokens: [...cutoverTokens].sort().slice(0, 12),
    };
  }

  return {
    strategy: cutoverConfig.strategy,
    ownership: {
      nativeFamilies: ownership.nativeFamilyCount,
      nativeTokens: ownership.nativeTokenCount,
      compatibilityFamilies: ownership.familyCount,
      compatibilityTokens: ownership.tokenCount,
    },
    domains: summaries,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const plan = planDomainCutovers();
  console.log(JSON.stringify(plan, null, 2));
}
