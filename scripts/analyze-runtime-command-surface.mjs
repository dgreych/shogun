#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyzeLegacyCommandSurface,
  compareLegacyDuplicateBaseline,
} from './analyze-legacy-command-surface.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_PATH = path.join(ROOT, 'dados/src/index.js');
const PREPARE_PATH = path.join(ROOT, 'dados/src/.scripts/prepareRuntimeSources.js');
const COMMAND_CASES_ANCHOR = '  const commandCases = `';
const INSERTION_ANCHOR = "case 'criador':";

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

function extractCommandCasesTemplate(prepareSource) {
  if (countOccurrences(prepareSource, COMMAND_CASES_ANCHOR) !== 1) {
    throw new Error('Anchor commandCases precisa aparecer exatamente uma vez em prepareRuntimeSources.js.');
  }

  const anchorIndex = prepareSource.indexOf(COMMAND_CASES_ANCHOR);
  const start = anchorIndex + COMMAND_CASES_ANCHOR.length - 1;
  let end = -1;

  for (let i = start + 1; i < prepareSource.length; i += 1) {
    if (prepareSource[i] === '\\') {
      i += 1;
      continue;
    }
    if (prepareSource[i] === '`') {
      end = i;
      break;
    }
  }

  if (end === -1) throw new Error('Template commandCases não terminou corretamente.');
  const rawBody = prepareSource.slice(start + 1, end);

  for (let i = 0; i < rawBody.length - 1; i += 1) {
    if (rawBody[i] !== '$' || rawBody[i + 1] !== '{') continue;
    let slashCount = 0;
    for (let cursor = i - 1; cursor >= 0 && rawBody[cursor] === '\\'; cursor -= 1) slashCount += 1;
    if (slashCount % 2 === 0) {
      throw new Error('commandCases contém interpolação não escapada; avaliação estática recusada.');
    }
  }

  const literal = prepareSource.slice(start, end + 1);
  const commandCases = Function(`"use strict"; return ${literal};`)();
  if (typeof commandCases !== 'string' || !commandCases.includes("case 't':")) {
    throw new Error('commandCases extraído não possui a assinatura esperada.');
  }
  return commandCases;
}

export function buildPreparedRuntimeCommandSource({
  indexSource = fs.readFileSync(INDEX_PATH, 'utf8'),
  prepareSource = fs.readFileSync(PREPARE_PATH, 'utf8'),
} = {}) {
  if (countOccurrences(indexSource, INSERTION_ANCHOR) !== 1) {
    throw new Error("Anchor case 'criador' precisa ser único no index.js para reproduzir o boot.");
  }
  const commandCases = extractCommandCasesTemplate(prepareSource);
  return indexSource.replace(INSERTION_ANCHOR, `${commandCases}${INSERTION_ANCHOR}`);
}

export function analyzeRuntimeCommandSurface(options = {}) {
  const indexSource = options.indexSource ?? fs.readFileSync(INDEX_PATH, 'utf8');
  const prepareSource = options.prepareSource ?? fs.readFileSync(PREPARE_PATH, 'utf8');
  const raw = analyzeLegacyCommandSurface(indexSource);
  const preparedSource = buildPreparedRuntimeCommandSource({ indexSource, prepareSource });
  const prepared = analyzeLegacyCommandSurface(preparedSource);

  const rawTokens = new Set(raw.tokens);
  const injectedTokens = prepared.tokens.filter((token) => !rawTokens.has(token));
  const injectedTokenSet = new Set(injectedTokens);
  const injectedFamilies = prepared.families.filter((family) =>
    family.tokens.some((token) => injectedTokenSet.has(token)),
  );
  const overlap = injectedFamilies.flatMap((family) =>
    family.tokens.filter((token) => rawTokens.has(token)),
  );

  if (overlap.length > 0) {
    throw new Error(`Injeção do boot passou a compartilhar tokens com o source cru: ${[...new Set(overlap)].join(',')}.`);
  }

  return Object.freeze({
    raw,
    prepared,
    preparedSource,
    injectedFamilies: Object.freeze(injectedFamilies),
    injectedTokens: Object.freeze(injectedTokens),
    injectedFamilyCount: prepared.familyCount - raw.familyCount,
    injectedTokenCount: prepared.uniqueTokenCount - raw.uniqueTokenCount,
  });
}

export function printRuntimeCommandSurface(result = analyzeRuntimeCommandSurface()) {
  const baseline = compareLegacyDuplicateBaseline(result.prepared.duplicateTokens);
  console.log(`RAW_COMMAND_FAMILIES=${result.raw.familyCount}`);
  console.log(`RAW_COMMAND_TOKENS=${result.raw.uniqueTokenCount}`);
  console.log(`RUNTIME_COMMAND_FAMILIES=${result.prepared.familyCount}`);
  console.log(`RUNTIME_COMMAND_TOKENS=${result.prepared.uniqueTokenCount}`);
  console.log(`RUNTIME_INJECTED_FAMILIES=${result.injectedFamilyCount}`);
  console.log(`RUNTIME_INJECTED_TOKENS=${result.injectedTokenCount}`);
  console.log(`RUNTIME_INJECTED_COMMANDS=${result.injectedTokens.join(',') || 'NONE'}`);
  console.log(`RUNTIME_DUPLICATE_BASELINE=${baseline.ok ? 'OK' : 'DRIFT'}`);
  if (!baseline.ok) {
    console.log(`RUNTIME_DUPLICATE_UNEXPECTED=${baseline.unexpected.join(',') || 'NONE'}`);
    console.log(`RUNTIME_DUPLICATE_MISSING=${baseline.missing.join(',') || 'NONE'}`);
  }
  return baseline;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = analyzeRuntimeCommandSurface();
  const baseline = printRuntimeCommandSurface(result);
  if (
    result.injectedFamilyCount !== 16
    || result.injectedTokenCount !== 34
    || result.prepared.familyCount !== 525
    || result.prepared.uniqueTokenCount !== 1606
    || !baseline.ok
  ) process.exitCode = 2;
}
