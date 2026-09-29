import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { deriveVNextOwnershipMetrics } from '../../scripts/vnext-ownership-metrics.mjs';
test('métricas sem manifesto histórico representam o runtime atual', () => {
  const metrics = deriveVNextOwnershipMetrics();
  assert.equal(metrics.legacyFamilies, 526);
  assert.equal(metrics.legacyTokens, 1602);
  assert.equal(metrics.nativeFamilies, 131);
  assert.equal(metrics.nativeTokens, 709);
  assert.equal(metrics.compatibilityFamilies, 395);
  assert.equal(metrics.compatibilityTokens, 893);
  assert.equal(metrics.fallbackFamilies, 0);
  assert.equal(metrics.fallbackTokens, 0);
});
test('manifesto explícito divergente continua recusado antes de promoção', () => {
  assert.throws(() => deriveVNextOwnershipMetrics('.github/deploy/refactor-active-manifest.json'), /Ownership real do manifesto divergiu/);
});
test('scanner executável qualifica a superfície atual com comandos promocionais', () => {
  const output = execFileSync(process.execPath, ['scripts/analyze-runtime-command-surface.mjs'], {encoding:'utf8'});
  assert.match(output, /RUNTIME_COMMAND_FAMILIES=526/);
  assert.match(output, /RUNTIME_COMMAND_TOKENS=1602/);
  assert.match(output, /RUNTIME_DUPLICATE_BASELINE=OK/);
});
