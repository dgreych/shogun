import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CUTOVER = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'dados/src/.scripts/vnextDomainCutoverPlan.json'), 'utf8'),
);
const HOOK_SOURCE = fs.readFileSync(path.join(ROOT, 'src/runtime/legacy-switch-hook.ts'), 'utf8');

test('estado do target Members é exatamente o estado que controla o ownership', () => {
  const configuredState = CUTOVER?.domains?.members?.state;
  const match = HOOK_SOURCE.match(
    /new MembersDomainDispatchTarget<MacrotrancheExecutionContext>\(\{\s*state:\s*['"](staged|active)['"]\s*\}\)/,
  );

  assert.ok(match, 'estado explícito de Members não encontrado no composition root');
  assert.equal(match[1], configuredState);
});

test('Members continua antes do bridge amplo no composition root', () => {
  const membersIndex = HOOK_SOURCE.indexOf('membersTarget,');
  const compatibilityIndex = HOOK_SOURCE.indexOf('macrotrancheCompatibility,');

  assert.ok(membersIndex > 0, 'membersTarget ausente');
  assert.ok(compatibilityIndex > membersIndex, 'Members precisa executar antes do bridge compatível');
});
