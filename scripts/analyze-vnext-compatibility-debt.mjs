#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyAtomicDomainOwnership } from '../dados/src/.scripts/vnextDomainOwnershipOverlay.js';
import { analyzeRuntimeCommandSurface } from './analyze-runtime-command-surface.mjs';

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
  || !Array.isArray(CONFIG?.nativeSeeds)
  || !CONFIG?.expected
  || !CONFIG?.buckets
) {
  throw new Error('Contrato vNext de ownership nativo/compatível inválido.');
}
if (CUTOVER?.schemaVersion !== 2 || CUTOVER?.strategy !== 'atomic-domain-cutover') {
  throw new Error('Contrato de cutover atômico por domínio inválido.');
}

function resolveFamilyIndexes(families, seeds, label) {
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

function familyDescription(family, index) {
  return Object.freeze({
    index,
    primary: family.primary,
    aliases: Object.freeze([...family.tokens]),
    tokenCount: family.tokens.length,
  });
}

function assignLane({ laneName, candidateIndexes, compatibilityIndexes, assigned, families }) {
  const indexes = new Set(
    [...candidateIndexes].filter((index) => compatibilityIndexes.has(index) && !assigned.has(index)),
  );
  indexes.forEach((index) => assigned.add(index));
  return Object.freeze({
    name: laneName,
    indexes,
    families: Object.freeze([...indexes].map((index) => familyDescription(families[index], index))),
    tokens: tokensForIndexes(families, indexes).size,
  });
}

export function analyzeVNextCompatibilityDebt() {
  const runtime = analyzeRuntimeCommandSurface();
  const families = runtime.prepared.families;
  const baselineNative = resolveFamilyIndexes(families, CONFIG.nativeSeeds, 'native');
  if (baselineNative.unresolved.length > 0) {
    throw new Error(`Seeds nativos não resolvidos: ${baselineNative.unresolved.join(',')}.`);
  }

  const overlay = applyAtomicDomainOwnership({
    families,
    baseNativeIndexes: baselineNative.indexes,
    seedConfig: CONFIG,
    cutoverConfig: CUTOVER,
  });
  const nativeIndexes = overlay.nativeIndexes;
  const compatibilityIndexes = new Set(
    families.map((_, index) => index).filter((index) => !nativeIndexes.has(index)),
  );
  const nativeTokens = tokensForIndexes(families, nativeIndexes);
  const compatibilityTokens = tokensForIndexes(families, compatibilityIndexes);
  const overlap = [...nativeTokens].filter((token) => compatibilityTokens.has(token));
  if (overlap.length > 0) {
    throw new Error(`Ownership parcial nativo/compatível: ${overlap.join(',')}.`);
  }

  const expected = {
    nativeFamilies: CONFIG.expected.nativeFamilies + overlay.delta.nativeFamilies,
    nativeTokens: CONFIG.expected.nativeTokens + overlay.delta.nativeTokens,
    compatibilityFamilies: CONFIG.expected.compatibilityFamilies + overlay.delta.compatibilityFamilies,
    compatibilityTokens: CONFIG.expected.compatibilityTokens + overlay.delta.compatibilityTokens,
  };
  if (
    nativeIndexes.size !== expected.nativeFamilies
    || nativeTokens.size !== expected.nativeTokens
    || compatibilityIndexes.size !== expected.compatibilityFamilies
    || compatibilityTokens.size !== expected.compatibilityTokens
  ) {
    throw new Error(
      `Contrato da dívida divergiu: native esperado=${expected.nativeFamilies}/${expected.nativeTokens} `
      + `real=${nativeIndexes.size}/${nativeTokens.size}; compat esperado=`
      + `${expected.compatibilityFamilies}/${expected.compatibilityTokens} `
      + `real=${compatibilityIndexes.size}/${compatibilityTokens.size}.`,
    );
  }

  const bucketIndexes = {};
  const bucketUnresolved = {};
  for (const [bucket, seeds] of Object.entries(CONFIG.buckets)) {
    const resolved = resolveFamilyIndexes(families, seeds, `bucket-${bucket}`);
    bucketIndexes[bucket] = resolved.indexes;
    bucketUnresolved[bucket] = resolved.unresolved;
  }

  const injectedTokenSet = new Set(runtime.injectedTokens);
  const injectedIndexes = new Set(
    [...compatibilityIndexes].filter((index) =>
      families[index].tokens.some((token) => injectedTokenSet.has(token)),
    ),
  );
  const assigned = new Set();
  const lanes = [assignLane({
    laneName: 'boot-injected',
    candidateIndexes: injectedIndexes,
    compatibilityIndexes,
    assigned,
    families,
  })];
  for (const laneName of ['tools', 'members', 'admin']) {
    lanes.push(assignLane({
      laneName,
      candidateIndexes: bucketIndexes[laneName] ?? new Set(),
      compatibilityIndexes,
      assigned,
      families,
    }));
  }
  const remainder = new Set([...compatibilityIndexes].filter((index) => !assigned.has(index)));
  lanes.push(assignLane({
    laneName: 'unclassified',
    candidateIndexes: remainder,
    compatibilityIndexes,
    assigned,
    families,
  }));

  if (assigned.size !== compatibilityIndexes.size) {
    throw new Error(`Inventário incompleto: atribuídas=${assigned.size} compatíveis=${compatibilityIndexes.size}.`);
  }

  return Object.freeze({
    runtime,
    nativeFamilies: nativeIndexes.size,
    nativeTokens: nativeTokens.size,
    compatibilityFamilies: compatibilityIndexes.size,
    compatibilityTokens: compatibilityTokens.size,
    nativeIndexes,
    compatibilityIndexes,
    activeDomains: Object.freeze(overlay.activeDomains),
    lanes: Object.freeze(lanes),
    bucketUnresolved: Object.freeze(bucketUnresolved),
  });
}

export function printVNextCompatibilityDebt(result = analyzeVNextCompatibilityDebt()) {
  console.log(`COMPAT_RUNTIME_FAMILIES=${result.runtime.prepared.familyCount}`);
  console.log(`COMPAT_RUNTIME_TOKENS=${result.runtime.prepared.uniqueTokenCount}`);
  console.log(`COMPAT_NATIVE_FAMILIES=${result.nativeFamilies}`);
  console.log(`COMPAT_NATIVE_TOKENS=${result.nativeTokens}`);
  console.log(`COMPAT_DEBT_FAMILIES=${result.compatibilityFamilies}`);
  console.log(`COMPAT_DEBT_TOKENS=${result.compatibilityTokens}`);
  console.log('COMPAT_FALLBACK_KNOWN_FAMILIES=0');
  console.log('COMPAT_FALLBACK_KNOWN_TOKENS=0');
  for (const [domain, state] of Object.entries(result.activeDomains || {})) {
    console.log(
      `COMPAT_DOMAIN_${domain.toUpperCase()}=${state.state}/`
      + `${state.families}familias/${state.tokens}tokens`,
    );
  }
  for (const [bucket, unresolved] of Object.entries(result.bucketUnresolved)) {
    console.log(`COMPAT_BUCKET_${bucket.toUpperCase()}_UNRESOLVED=${unresolved.join(',') || 'NONE'}`);
  }
  for (const lane of result.lanes) {
    const label = lane.name.toUpperCase().replaceAll('-', '_');
    console.log(`COMPAT_LANE_${label}_FAMILIES=${lane.families.length}`);
    console.log(`COMPAT_LANE_${label}_TOKENS=${lane.tokens}`);
  }
  console.log('COMPAT_FAMILY_INVENTORY_BEGIN');
  for (const lane of result.lanes) {
    for (const family of lane.families) {
      console.log(
        `COMPAT_FAMILY|lane=${lane.name}|index=${family.index}|primary=${family.primary}`
        + `|tokens=${family.aliases.join(',')}|token_count=${family.tokenCount}`,
      );
    }
  }
  console.log('COMPAT_FAMILY_INVENTORY_END');
  console.log('COMPAT_INVENTORY=OK');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  printVNextCompatibilityDebt();
}
