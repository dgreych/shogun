import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildMacrotrancheLegacyBridge,
  MACROTRANCHE_BRIDGE_MARKER,
  planMacrotrancheBridge,
} from '../../dados/src/.scripts/vnextMacrotrancheBridge.js';
import { patchVNextOwnershipHook } from '../../dados/src/.scripts/finalizeGyomeiRuntime.js';
import { buildPreparedRuntimeCommandSource } from '../../scripts/analyze-runtime-command-surface.mjs';
import { planVNextMacrotranche } from '../../scripts/plan-vnext-macrotranche.mjs';
import { MacrotrancheCompatibilityDomainDispatchTarget } from '../../dist-vnext/macrotranche/domain.js';

const cutover = JSON.parse(fs.readFileSync('dados/src/.scripts/vnextDomainCutoverPlan.json', 'utf8'));
const membersActive = cutover?.domains?.members?.state === 'active';

function count(source, needle) {
  return source.split(needle).length - 1;
}

function compatibilityExecutorBody(bridged) {
  const start = bridged.indexOf('const __gyomeiExecuteMacrotrancheLegacy = async');
  const end = bridged.indexOf('\n    switch (command) {', start);
  assert.ok(start >= 0 && end > start, 'executor de compatibilidade precisa existir durante a migração');
  return bridged.slice(start, end);
}

function hasCase(source, token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\bcase\\s+['\"]${escaped}['\"]\\s*:`).test(source);
}

test('planner e bridge compartilham ownership derivado e fecham a superfície inteira', () => {
  const source = buildPreparedRuntimeCommandSource();
  const planner = planVNextMacrotranche();
  const bridge = planMacrotrancheBridge(source);

  assert.equal(planner.contractDrift, false);
  assert.deepEqual(planner.unresolved, []);
  assert.deepEqual(planner.crossBoundaryDuplicates, []);
  assert.equal(planner.rawLegacyFamilies, 529);
  assert.equal(planner.rawLegacyTokens, 1627);
  assert.equal(planner.runtimeInjectedFamilies, 16);
  assert.equal(planner.runtimeInjectedTokens, 34);
  assert.equal(planner.legacyFamilies, 545);
  assert.equal(planner.legacyTokens, 1661);
  assert.equal(planner.nativeFamilies + planner.selectedFamilies, 545);
  assert.equal(planner.nativeTokens + planner.selectedTokens, 1661);
  assert.equal(planner.fallbackFamiliesAfterMacrotranche, 0);
  assert.equal(planner.fallbackTokensAfterMacrotranche, 0);

  assert.equal(bridge.nativeFamilyCount, planner.nativeFamilies);
  assert.equal(bridge.nativeTokenCount, planner.nativeTokens);
  assert.equal(bridge.familyCount, planner.selectedFamilies);
  assert.equal(bridge.tokenCount, planner.selectedTokens);
  assert.deepEqual(bridge.tokens, [...planner.tokens].sort());

  if (membersActive) {
    assert.equal(planner.nativeFamilies, 132);
    assert.equal(planner.nativeTokens, 714);
    assert.equal(planner.selectedFamilies, 413);
    assert.equal(planner.selectedTokens, 947);
  }
});

test('bridge remove fisicamente todas as famílias nativas do executor compatível', () => {
  const source = buildPreparedRuntimeCommandSource();
  const bridged = buildMacrotrancheLegacyBridge(source);
  const compatibility = compatibilityExecutorBody(bridged);

  const alwaysNative = [
    'ban', 'antilinkhard', 'limitmessage', 'adv', 'hora', 'groupstats',
    'nota', 'notas', 'calc', 'lembrete', 'meuslembretes', 'apagalembrete', 'aniversario',
    'printsite', 'ssweb', 'signos', 'clima', 'tempo', 'weather', 'previsao', 'horoscopo', 'signo',
    'verificar', 'checklink', 'scanlink', 'urlscan',
    'nick', 'gerarnick', 'nickgenerator', 'qrcode', 'lerqr', 'readqr', 'scanqr',
    'encurtalink', 'tinyurl', 'dicionario', 'dictionary', 'tradutor', 'translator',
    'upload', 'imgpralink', 'videopralink', 'gerarlink',
  ];
  const membersSamples = ['perfil', 'ping', 'roles', 'perfilrpg', 'slotmachine', 'sell', 'inventory'];

  for (const token of [...alwaysNative, ...(membersActive ? membersSamples : [])]) {
    assert.equal(
      hasCase(compatibility, token),
      false,
      `${token} não pode sobreviver dentro de __gyomeiExecuteMacrotrancheLegacy`,
    );
  }

  if (!membersActive) {
    assert.equal(hasCase(compatibility, 'perfil'), true, 'perfil staged precisa permanecer na compatibilidade');
  }
  assert.equal(hasCase(compatibility, 'aprovar'), true, 'Admin ainda não migrado precisa permanecer na compatibilidade');
});

test('bridge é fail-closed e o switch original fica apenas atrás do seam', () => {
  const source = buildPreparedRuntimeCommandSource();
  const bridged = buildMacrotrancheLegacyBridge(source);

  assert.equal(count(bridged, MACROTRANCHE_BRIDGE_MARKER), 1);
  assert.equal(count(bridged, '    switch (command) {'), 1);
  assert.equal(count(bridged, 'switch (__gyomeiCommand) {'), 1);
  assert.match(bridged, /const __gyomeiMacrotrancheOwnedCommands = new Set\(/);
  assert.match(bridged, /const __gyomeiExecuteMacrotrancheLegacy = async/);
  assert.equal(buildMacrotrancheLegacyBridge(bridged), bridged);
});

test('domínio de compatibilidade executa comando owned exatamente uma vez', async () => {
  const domain = new MacrotrancheCompatibilityDomainDispatchTarget();
  const calls = [];
  const context = {
    isMacrotrancheOwnedCommand: (command) => command === 'aprovar',
    executeLegacyOwnedCommand: async (command) => calls.push(command),
  };

  assert.equal(await domain.dispatch('desconhecido', context), false);
  assert.deepEqual(calls, []);
  assert.equal(await domain.dispatch(' APROVAR ', context), true);
  assert.deepEqual(calls, ['aprovar']);
});

test('falha de comando owned propaga e nunca sinaliza fallback', async () => {
  const domain = new MacrotrancheCompatibilityDomainDispatchTarget();
  const expected = new Error('falha-controlada');
  const context = {
    isMacrotrancheOwnedCommand: () => true,
    executeLegacyOwnedCommand: async () => { throw expected; },
  };

  await assert.rejects(() => domain.dispatch('aprovar', context), expected);
});

test('runtime preparado com bridge e seam continua sintaticamente válido', () => {
  const source = buildPreparedRuntimeCommandSource();
  const bridged = buildMacrotrancheLegacyBridge(source);
  const patched = patchVNextOwnershipHook(bridged);

  const markerIndex = patched.indexOf(MACROTRANCHE_BRIDGE_MARKER);
  const seamIndex = patched.indexOf('// ===== VNEXT OWNERSHIP SEAM: PRE-SWITCH =====');
  const fallbackIndex = patched.indexOf('    switch (command) {');
  assert.ok(markerIndex > 0 && markerIndex < seamIndex && seamIndex < fallbackIndex);
  assert.match(patched.slice(seamIndex, fallbackIndex), /executeLegacyOwnedCommand:\s*__gyomeiExecuteMacrotrancheLegacy/);
  assert.match(patched.slice(seamIndex, fallbackIndex), /isMacrotrancheOwnedCommand:/);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gyomei-macrotranche-'));
  const tempFile = path.join(tempDir, 'runtime-index.mjs');
  try {
    fs.writeFileSync(tempFile, patched);
    execFileSync(process.execPath, ['--check', tempFile], { stdio: 'pipe' });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
