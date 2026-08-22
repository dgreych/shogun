#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyAtomicDomainOwnership } from '../dados/src/.scripts/vnextDomainOwnershipOverlay.js';
import { LEGACY_DUPLICATE_BASELINE } from './analyze-legacy-command-surface.mjs';
import { analyzeRuntimeCommandSurface } from './analyze-runtime-command-surface.mjs';
import { printVNextCompatibilityDebt } from './analyze-vnext-compatibility-debt.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'dados/src/.scripts/vnextMacrotrancheSeeds.json'), 'utf8'),
);
const CUTOVER = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'dados/src/.scripts/vnextDomainCutoverPlan.json'), 'utf8'),
);

if (
  CONFIG?.schemaVersion !== 4
  || CONFIG?.selectionMode !== 'all-non-native'
  || !CONFIG?.expected
  || !Array.isArray(CONFIG?.nativeSeeds)
  || !Array.isArray(CONFIG?.duplicateClosureTokens)
  || !CONFIG?.buckets
) {
  throw new Error('Contrato de cutover vNext inválido.');
}
if (CUTOVER?.schemaVersion !== 2 || CUTOVER?.strategy !== 'atomic-domain-cutover') {
  throw new Error('Contrato de cutover atômico por domínio inválido.');
}

const expectedDuplicates = [...LEGACY_DUPLICATE_BASELINE].sort();
const configuredDuplicates = [...new Set(CONFIG.duplicateClosureTokens)].sort();
if (JSON.stringify(expectedDuplicates) !== JSON.stringify(configuredDuplicates)) {
  throw new Error(
    `Baseline de duplicatas divergiu: scanner=${expectedDuplicates.join(',')} `
    + `contrato=${configuredDuplicates.join(',')}.`,
  );
}

export const VNEXT_MACROTRANCHE_SEEDS = Object.freeze(
  Object.fromEntries(
    Object.entries(CONFIG.buckets).map(([name, seeds]) => [name, Object.freeze([...seeds])]),
  ),
);

function resolveSeeds(families, seeds, label) {
  const indexes = new Set();
  const unresolved = [];
  for (const rawSeed of seeds) {
    const seed = String(rawSeed).trim().toLowerCase();
    const matches = families
      .map((family, index) => ({ family, index }))
      .filter(({ family }) => family.tokens.includes(seed));
    if (matches.length === 0) {
      unresolved.push(seed);
      continue;
    }
    if (matches.length > 1) {
      throw new Error(
        `Seed ${seed} de ${label} é ambíguo: `
        + matches.map(({ index, family }) => `${index}:${family.primary}`).join(', '),
      );
    }
    indexes.add(matches[0].index);
  }
  return { indexes, unresolved };
}

function tokensForIndexes(families, indexes) {
  return new Set([...indexes].flatMap((index) => families[index]?.tokens || []));
}

export function planVNextMacrotranche() {
  const runtime = analyzeRuntimeCommandSurface();
  const legacy = runtime.prepared;
  const baselineNative = resolveSeeds(legacy.families, CONFIG.nativeSeeds, 'native');
  if (baselineNative.unresolved.length > 0) {
    return Object.freeze({
      contractDrift: true,
      unresolved: Object.freeze([...baselineNative.unresolved]),
      crossBoundaryDuplicates: Object.freeze([]),
    });
  }

  const overlay = applyAtomicDomainOwnership({
    families: legacy.families,
    baseNativeIndexes: baselineNative.indexes,
    seedConfig: CONFIG,
    cutoverConfig: CUTOVER,
  });
  const nativeIndexes = overlay.nativeIndexes;
  const nativeTokens = tokensForIndexes(legacy.families, nativeIndexes);
  const compatibilityIndexes = new Set(
    legacy.families.map((_, index) => index).filter((index) => !nativeIndexes.has(index)),
  );
  const compatibilityTokens = tokensForIndexes(legacy.families, compatibilityIndexes);
  const crossBoundaryDuplicates = [...nativeTokens]
    .filter((token) => compatibilityTokens.has(token))
    .sort();

  const unresolved = [...baselineNative.unresolved];
  const bucketStats = {};
  for (const [bucket, seeds] of Object.entries(VNEXT_MACROTRANCHE_SEEDS)) {
    const resolved = resolveSeeds(legacy.families, seeds, `bucket-${bucket}`);
    unresolved.push(...resolved.unresolved);
    const indexes = new Set(
      [...resolved.indexes].filter((index) => compatibilityIndexes.has(index)),
    );
    bucketStats[bucket] = Object.freeze({
      seeds: seeds.length,
      families: indexes.size,
      tokens: tokensForIndexes(legacy.families, indexes).size,
      unresolved: Object.freeze(resolved.unresolved),
    });
  }

  const expected = {
    nativeFamilies: CONFIG.expected.nativeFamilies + overlay.delta.nativeFamilies,
    nativeTokens: CONFIG.expected.nativeTokens + overlay.delta.nativeTokens,
    compatibilityFamilies: CONFIG.expected.compatibilityFamilies + overlay.delta.compatibilityFamilies,
    compatibilityTokens: CONFIG.expected.compatibilityTokens + overlay.delta.compatibilityTokens,
  };
  const contractDrift =
    runtime.injectedFamilyCount !== 16
    || runtime.injectedTokenCount !== 34
    || nativeIndexes.size !== expected.nativeFamilies
    || nativeTokens.size !== expected.nativeTokens
    || compatibilityIndexes.size !== expected.compatibilityFamilies
    || compatibilityTokens.size !== expected.compatibilityTokens
    || crossBoundaryDuplicates.length > 0;

  const baselineNativeTokens = tokensForIndexes(legacy.families, baselineNative.indexes);
  return Object.freeze({
    legacyFamilies: legacy.familyCount,
    legacyTokens: legacy.uniqueTokenCount,
    rawLegacyFamilies: runtime.raw.familyCount,
    rawLegacyTokens: runtime.raw.uniqueTokenCount,
    runtimeInjectedFamilies: runtime.injectedFamilyCount,
    runtimeInjectedTokens: runtime.injectedTokenCount,
    runtimeInjectedCommandTokens: runtime.injectedTokens,
    acceptedBaseFamilies: baselineNative.indexes.size,
    acceptedBaseTokens: baselineNativeTokens.size,
    nativeFamilies: nativeIndexes.size,
    nativeTokens: nativeTokens.size,
    seedSelectedFamilies: compatibilityIndexes.size,
    seedSelectedTokens: compatibilityTokens.size,
    selectedFamilies: compatibilityIndexes.size,
    selectedTokens: compatibilityTokens.size,
    duplicateClosureAddedFamilies: overlay.delta.nativeFamilies,
    duplicateClosureAddedTokens: overlay.delta.nativeTokens,
    fallbackFamiliesAfterMacrotranche: legacy.familyCount - nativeIndexes.size - compatibilityIndexes.size,
    fallbackTokensAfterMacrotranche: legacy.uniqueTokenCount - nativeTokens.size - compatibilityTokens.size,
    expectedSeedFamilies: expected.compatibilityFamilies,
    expectedSeedTokens: expected.compatibilityTokens,
    contractDrift,
    crossBoundaryDuplicates: Object.freeze(crossBoundaryDuplicates),
    unresolved: Object.freeze([...new Set(unresolved)].sort()),
    bucketStats: Object.freeze(bucketStats),
    activeDomains: Object.freeze(overlay.activeDomains),
    families: Object.freeze([...compatibilityIndexes].map((index) => legacy.families[index])),
    tokens: Object.freeze([...compatibilityTokens].sort()),
  });
}

export function printVNextMacrotranchePlan(plan = planVNextMacrotranche()) {
  console.log(`MACRO_RAW_LEGACY_FAMILIES=${plan.rawLegacyFamilies}`);
  console.log(`MACRO_RAW_LEGACY_TOKENS=${plan.rawLegacyTokens}`);
  console.log(`MACRO_RUNTIME_INJECTED_FAMILIES=${plan.runtimeInjectedFamilies}`);
  console.log(`MACRO_RUNTIME_INJECTED_TOKENS=${plan.runtimeInjectedTokens}`);
  console.log(`MACRO_LEGACY_FAMILIES=${plan.legacyFamilies}`);
  console.log(`MACRO_LEGACY_TOKENS=${plan.legacyTokens}`);
  console.log(`MACRO_NATIVE_FAMILIES=${plan.nativeFamilies}`);
  console.log(`MACRO_NATIVE_TOKENS=${plan.nativeTokens}`);
  console.log(`MACRO_COMPAT_FAMILIES=${plan.selectedFamilies}`);
  console.log(`MACRO_COMPAT_TOKENS=${plan.selectedTokens}`);
  for (const [domain, state] of Object.entries(plan.activeDomains || {})) {
    console.log(
      `MACRO_DOMAIN_${domain.toUpperCase()}=${state.state}/`
      + `${state.families}familias/${state.tokens}tokens`,
    );
  }
  for (const [bucket, stats] of Object.entries(plan.bucketStats)) {
    console.log(
      `MACRO_BUCKET_${bucket.toUpperCase()}=`
      + `${stats.families}familias/${stats.tokens}tokens/${stats.unresolved.length}nao_resolvidos`,
    );
  }
  console.log(`MACRO_CROSS_BOUNDARY_DUPLICATES=${plan.crossBoundaryDuplicates.join(',') || 'NONE'}`);
  console.log(`MACRO_UNRESOLVED=${plan.unresolved.join(',') || 'NONE'}`);
  console.log(`MACRO_CONTRACT=${plan.contractDrift ? 'DRIFT' : 'OK'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plan = planVNextMacrotranche();
  printVNextMacrotranchePlan(plan);
  if (plan.unresolved.length > 0 || plan.contractDrift) {
    process.exitCode = 2;
  } else {
    console.log('COMPATIBILITY_DEBT_PLAN_BEGIN');
    printVNextCompatibilityDebt();
    console.log('COMPATIBILITY_DEBT_PLAN_END');
  }
}
