import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { patchVNextOwnershipHook } from '../../dados/src/.scripts/finalizeShogunRuntime.js';
import { buildMacrotrancheLegacyBridge } from '../../dados/src/.scripts/vnextMacrotrancheBridge.js';
import { buildPreparedRuntimeCommandSource } from '../../scripts/analyze-runtime-command-surface.mjs';

const IMPORT_ANCHOR = "import { MessageReplayGuard, createMessageReplayKey } from './security/MessageReplayGuard.js';";
const IMPORT_LINE = "import { dispatchLegacySwitchVNext } from '../../dist-vnext/runtime/legacy-switch-hook.js';";
const CIRCUIT_DECLARATION = 'let __gyomeiVNextContextCircuitOpen = false;';
const MARKER = '// ===== VNEXT OWNERSHIP SEAM: PRE-SWITCH =====';
const BRIDGE_MARKER = '// ===== VNEXT MACROTRANCHE LEGACY BRIDGE =====';
const SWITCH = '    switch (command) {';

function count(source, needle) {
  return source.split(needle).length - 1;
}

function buildRuntimeSource() {
  return buildMacrotrancheLegacyBridge(buildPreparedRuntimeCommandSource());
}

test('patch insere seam exatamente uma vez depois do bridge e antes do switch principal', () => {
  const source = buildRuntimeSource();
  const patched = patchVNextOwnershipHook(source);

  assert.equal(count(patched, IMPORT_LINE), 1);
  assert.equal(count(patched, CIRCUIT_DECLARATION), 1);
  assert.equal(count(patched, MARKER), 1);
  assert.equal(count(patched, BRIDGE_MARKER), 1);
  assert.equal(count(patched, SWITCH), 1);

  const bridgeIndex = patched.indexOf(BRIDGE_MARKER);
  const markerIndex = patched.indexOf(MARKER);
  const switchIndex = patched.indexOf(SWITCH);
  assert.ok(bridgeIndex > 0);
  assert.ok(bridgeIndex < markerIndex);
  assert.ok(markerIndex < switchIndex);

  const between = patched.slice(markerIndex, switchIndex);
  const membersScopeIndex = between.indexOf('buildMembersScope:');
  assert.ok(membersScopeIndex > 0, 'scope lazy Members precisa existir no seam');
  const rootContext = between.slice(0, membersScopeIndex);

  assert.match(between, /if \(isCmd && command && !__gyomeiVNextContextCircuitOpen\)/);
  assert.match(between, /let __vnextContext;/);
  assert.match(between, /try \{\s*__vnextContext = \{/);
  assert.match(between, /__vnextContextError instanceof ReferenceError/);
  assert.match(between, /__gyomeiVNextContextCircuitOpen = true/);
  assert.match(between, /if \(__vnextContext\) \{\s*const __vnextOwned = await dispatchLegacySwitchVNext\(command,/);
  assert.match(between, /if \(__vnextOwned\) return;/);
  assert.match(rootContext, /prefix:\s*groupPrefix,/);
  assert.doesNotMatch(rootContext, /\n\s*prefix,\s*\n/);
  assert.match(rootContext, /isOwner,/);
  assert.match(rootContext, /isLiteMode:\s*isModoLite,/);
  assert.match(rootContext, /reply,/);
  assert.match(rootContext, /rejectInLiteMode,/);
  assert.match(rootContext, /isGroup,/);
  assert.match(rootContext, /isModoBn,/);
  assert.match(rootContext, /sender,/);
  assert.match(rootContext, /mentionedUser:\s*menc_os2,/);
  assert.match(rootContext, /groupId:\s*from,/);
  assert.match(rootContext, /groupMembers:\s*AllgroupMembers,/);
  assert.match(rootContext, /getUserName,/);
  assert.match(rootContext, /buildGroupFilePath/);
  assert.match(rootContext, /notes,/);
  assert.match(rootContext, /calculator,/);
  assert.match(rootContext, /loadReminders,/);
  assert.match(rootContext, /saveReminders,/);
  assert.match(rootContext, /optimizer,/);
  assert.match(rootContext, /parseReminderInput,/);
  assert.match(rootContext, /tzFormat,/);
  assert.match(rootContext, /ai:\s*ia,/);
  assert.equal(/\n\s*ai,\s*\n/.test(rootContext), false);
  assert.match(between, /buildMembersScope:\s*\(\)\s*=>\s*\(\{/);
  assert.match(between, /\n\s*q,\s*\n/);
  assert.match(between, /\n\s*timeLeft,\s*\n/);
  assert.match(between, /get i6\(\) \{ return i6; \}/);
  assert.match(between, /set i6\(__value\) \{ i6 = __value; \}/);
  assert.match(between, /isMacrotrancheOwnedCommand:/);
  assert.match(between, /executeLegacyOwnedCommand:\s*__gyomeiExecuteMacrotrancheLegacy/);
});

test('dependências do contexto e do bridge existem antes do seam', () => {
  const source = buildRuntimeSource();
  const switchIndex = source.indexOf(SWITCH);
  assert.ok(switchIndex > 0, 'switch(command) principal ausente');
  const beforeSwitch = source.slice(0, switchIndex);

  const requiredBindings = [
    [/import\s+\*\s+as\s+ia\s+from\s+'\.\/funcs\/private\/(?:\.runtime-)?ia\.js';/, 'ia'],
    [/const\s+from\s*=/, 'from'],
    [/const\s+isGroup\s*=/, 'isGroup'],
    [/let\s+sender\s*;/, 'sender'],
    [/const\s+menc_os2\s*=/, 'menc_os2'],
    [/const\s+isModoBn\s*=/, 'isModoBn'],
    [/const\s+isModoLite\s*=/, 'isModoLite'],
    [/const\s+\[AllgroupMembers,/, 'AllgroupMembers'],
    [/async\s+function\s+reply\s*\(/, 'reply'],
    [/const\s+rejectInLiteMode\s*=\s*async/, 'rejectInLiteMode'],
    [/const\s+buildGroupFilePath\s*=/, 'buildGroupFilePath'],
    [/\bgetUserName\b/, 'getUserName'],
    [/\bnotes\b/, 'notes'],
    [/\bcalculator\b/, 'calculator'],
    [/\bloadReminders\b/, 'loadReminders'],
    [/\bsaveReminders\b/, 'saveReminders'],
    [/\boptimizer\b/, 'optimizer'],
    [/\bparseReminderInput\b/, 'parseReminderInput'],
    [/\btzFormat\b/, 'tzFormat'],
    [/const\s+__gyomeiMacrotrancheOwnedCommands\s*=\s*new Set/, '__gyomeiMacrotrancheOwnedCommands'],
    [/const\s+__gyomeiExecuteMacrotrancheLegacy\s*=\s*async/, '__gyomeiExecuteMacrotrancheLegacy'],
  ];

  for (const [pattern, binding] of requiredBindings) {
    assert.match(beforeSwitch, pattern, `binding ${binding} não está disponível antes do seam`);
  }
});

test('seam usa a variável lite real do legado sem reintroduzir identificador livre isLiteMode na raiz', () => {
  const patched = patchVNextOwnershipHook(buildRuntimeSource());
  const markerIndex = patched.indexOf(MARKER);
  const switchIndex = patched.indexOf(SWITCH);
  const between = patched.slice(markerIndex, switchIndex);
  const rootContext = between.slice(0, between.indexOf('buildMembersScope:'));

  assert.match(rootContext, /isLiteMode:\s*isModoLite/);
  assert.equal(/\bisLiteMode\s*(?:,|\n)/.test(rootContext.replace(/isLiteMode:\s*isModoLite/g, '')), false);
});

test('falha estrutural antes do dispatch abre circuit breaker e preserva o switch legado', async () => {
  const syntheticSource = `${IMPORT_ANCHOR}
async function NazuninhaBotExec(command) {
  const isCmd = true;
  const __gyomeiMacrotrancheOwnedCommands = new Set(['calc']);
  const __gyomeiExecuteMacrotrancheLegacy = async () => {};
    switch (command) {
      case 'calc': return 'legacy-ok';
      default: return 'legacy-default';
    }
}`;

  let patched = patchVNextOwnershipHook(syntheticSource);
  patched = patched
    .replace(IMPORT_ANCHOR, '')
    .replace(
      IMPORT_LINE,
      'let __vnextDispatchCalls = 0; const dispatchLegacySwitchVNext = async () => { __vnextDispatchCalls += 1; return true; };',
    );

  const buildSyntheticRuntime = new Function(
    `${patched}\nreturn { run: NazuninhaBotExec, calls: () => __vnextDispatchCalls, circuit: () => __gyomeiVNextContextCircuitOpen };`,
  );
  const runtime = buildSyntheticRuntime();
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    assert.equal(await runtime.run('calc'), 'legacy-ok');
    assert.equal(runtime.calls(), 0, 'dispatch vNext não pode iniciar com contexto estruturalmente inválido');
    assert.equal(runtime.circuit(), true, 'ReferenceError pré-dispatch precisa abrir o circuit breaker');

    assert.equal(await runtime.run('calc'), 'legacy-ok');
    assert.equal(runtime.calls(), 0, 'circuit breaker aberto deve manter execução no switch legado');
  } finally {
    console.error = originalConsoleError;
  }
});

test('erro depois que o dispatch iniciou continua fora do catch de montagem', () => {
  const patched = patchVNextOwnershipHook(buildRuntimeSource());
  const markerIndex = patched.indexOf(MARKER);
  const switchIndex = patched.indexOf(SWITCH);
  const between = patched.slice(markerIndex, switchIndex);
  const catchIndex = between.indexOf('} catch (__vnextContextError) {');
  const dispatchIndex = between.indexOf('await dispatchLegacySwitchVNext(command, __vnextContext)');
  const guardedDispatchIndex = between.indexOf('if (__vnextContext) {');

  assert.ok(catchIndex > 0);
  assert.ok(guardedDispatchIndex > catchIndex);
  assert.ok(dispatchIndex > guardedDispatchIndex, 'dispatch deve ocorrer somente depois do catch de montagem');
});

test('patch é idempotente somente quando import, circuit breaker e marker estão completos', () => {
  const source = buildRuntimeSource();
  const once = patchVNextOwnershipHook(source);
  assert.equal(patchVNextOwnershipHook(once), once);

  assert.throws(
    () => patchVNextOwnershipHook(source.replace(
      IMPORT_ANCHOR,
      `${IMPORT_ANCHOR}\n${IMPORT_LINE}`,
    )),
    /encontrado parcialmente/,
  );

  assert.throws(
    () => patchVNextOwnershipHook(source.replace(
      IMPORT_ANCHOR,
      `${IMPORT_ANCHOR}\n${CIRCUIT_DECLARATION}`,
    )),
    /encontrado parcialmente/,
  );
});

test('patch recusa ambiguidade do switch principal em vez de injetar no lugar errado', () => {
  const source = buildRuntimeSource();
  const ambiguous = source.replace(SWITCH, `${SWITCH}\n${SWITCH}`);
  assert.throws(() => patchVNextOwnershipHook(ambiguous), /não é único/);
});

test('source preparado resultante continua sintaticamente válido para Node ESM', () => {
  const patched = patchVNextOwnershipHook(buildRuntimeSource());
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gyomei-vnext-hook-'));
  const tempFile = path.join(tempDir, 'runtime-index.mjs');
  try {
    fs.writeFileSync(tempFile, patched);
    execFileSync(process.execPath, ['--check', tempFile], { stdio: 'pipe' });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
