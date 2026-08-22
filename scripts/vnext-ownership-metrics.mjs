#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { planVNextMacrotranche } from './plan-vnext-macrotranche.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MANIFEST = path.join(ROOT, '.github/deploy/refactor-active-manifest.json');
const DEPLOY_SHIM = Object.freeze({
  strategy: 'accepted-base-plus-full-known-surface',
  acceptedBaseFamilies: 19,
  acceptedBaseTokens: 381,
  macroFamilies: 526,
  macroTokens: 1280,
});

function assertManifestOwnership(ownership, macro) {
  for (const [key, value] of Object.entries(DEPLOY_SHIM)) {
    if (ownership[key] !== value) {
      throw new Error(`Shim de deploy divergiu em ${key}: esperado=${value} declarado=${ownership[key]}.`);
    }
  }

  const expected = {
    nativeFamilies: macro.nativeFamilies,
    nativeTokens: macro.nativeTokens,
    compatibilityFamilies: macro.selectedFamilies,
    compatibilityTokens: macro.selectedTokens,
    totalFamilies: macro.legacyFamilies,
    totalTokens: macro.legacyTokens,
  };

  for (const [key, value] of Object.entries(expected)) {
    if (ownership[key] !== value) {
      throw new Error(`Ownership real do manifesto divergiu em ${key}: esperado=${value} declarado=${ownership[key]}.`);
    }
  }

  if ('legacyFallbackFamilies' in ownership || 'legacyFallbackTokens' in ownership) {
    throw new Error('Fallback não deve ser hardcoded no manifesto; ele é derivado da superfície real.');
  }
}

export function deriveVNextOwnershipMetrics(manifestPath = DEFAULT_MANIFEST) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const ownership = manifest?.ownership || {};
  const macro = planVNextMacrotranche();

  if (macro.contractDrift || macro.unresolved.length > 0 || macro.crossBoundaryDuplicates.length > 0) {
    throw new Error('Ownership vNext não está qualificado para derivar o contrato ativo.');
  }

  assertManifestOwnership(ownership, macro);

  const nativeFamilies = macro.nativeFamilies;
  const nativeTokens = macro.nativeTokens;
  const compatibilityFamilies = macro.selectedFamilies;
  const compatibilityTokens = macro.selectedTokens;
  const legacyFamilies = macro.legacyFamilies;
  const legacyTokens = macro.legacyTokens;
  const ownedFamilies = nativeFamilies + compatibilityFamilies;
  const ownedTokens = nativeTokens + compatibilityTokens;
  const fallbackFamilies = legacyFamilies - ownedFamilies;
  const fallbackTokens = legacyTokens - ownedTokens;

  if (ownedFamilies !== legacyFamilies || ownedTokens !== legacyTokens) {
    throw new Error(
      `Ownership não cobre toda a superfície preparada: owned=${ownedFamilies}/${ownedTokens} `
      + `runtime=${legacyFamilies}/${legacyTokens}.`,
    );
  }
  if (fallbackFamilies !== 0 || fallbackTokens !== 0) {
    throw new Error(`Fallback conhecido precisa ser zero; real=${fallbackFamilies}/${fallbackTokens}.`);
  }

  return Object.freeze({
    ownedFamilies,
    ownedTokens,
    legacyFamilies,
    legacyTokens,
    rawLegacyFamilies: macro.rawLegacyFamilies,
    rawLegacyTokens: macro.rawLegacyTokens,
    runtimeInjectedFamilies: macro.runtimeInjectedFamilies,
    runtimeInjectedTokens: macro.runtimeInjectedTokens,
    fallbackFamilies,
    fallbackTokens,
    nativeFamilies,
    nativeTokens,
    compatibilityFamilies,
    compatibilityTokens,
    macroSeedFamilies: macro.seedSelectedFamilies,
    macroSeedTokens: macro.seedSelectedTokens,
    macroClosedFamilies: macro.selectedFamilies,
    macroClosedTokens: macro.selectedTokens,
    duplicateClosureAddedFamilies: macro.duplicateClosureAddedFamilies,
    duplicateClosureAddedTokens: macro.duplicateClosureAddedTokens,
  });
}

export function printVNextOwnershipMetrics(metrics = deriveVNextOwnershipMetrics()) {
  console.log(`RAW_LEGACY_COMMAND_TOKENS=${metrics.rawLegacyTokens}`);
  console.log(`RAW_LEGACY_COMMAND_FAMILIES=${metrics.rawLegacyFamilies}`);
  console.log(`RUNTIME_INJECTED_COMMAND_TOKENS=${metrics.runtimeInjectedTokens}`);
  console.log(`RUNTIME_INJECTED_COMMAND_FAMILIES=${metrics.runtimeInjectedFamilies}`);
  console.log(`LEGACY_COMMAND_TOKENS=${metrics.legacyTokens}`);
  console.log(`LEGACY_COMMAND_FAMILIES=${metrics.legacyFamilies}`);
  console.log(`VNEXT_OWNED_COMMAND_TOKENS=${metrics.ownedTokens}`);
  console.log(`VNEXT_OWNED_COMMAND_FAMILIES=${metrics.ownedFamilies}`);
  console.log(`VNEXT_NATIVE_COMMAND_TOKENS=${metrics.nativeTokens}`);
  console.log(`VNEXT_NATIVE_COMMAND_FAMILIES=${metrics.nativeFamilies}`);
  console.log(`VNEXT_COMPATIBILITY_COMMAND_TOKENS=${metrics.compatibilityTokens}`);
  console.log(`VNEXT_COMPATIBILITY_COMMAND_FAMILIES=${metrics.compatibilityFamilies}`);
  console.log(`LEGACY_FALLBACK_COMMAND_TOKENS=${metrics.fallbackTokens}`);
  console.log(`LEGACY_FALLBACK_COMMAND_FAMILIES=${metrics.fallbackFamilies}`);
  console.log(`VNEXT_COMPATIBILITY_SELECTED=${metrics.macroClosedFamilies}_familias/${metrics.macroClosedTokens}_tokens`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  printVNextOwnershipMetrics();
}
