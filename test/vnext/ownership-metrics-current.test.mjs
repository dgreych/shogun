import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { deriveVNextOwnershipMetrics } from '../../scripts/vnext-ownership-metrics.mjs';
test('métricas sem manifesto histórico representam o runtime atual', () => {
  const metrics = deriveVNextOwnershipMetrics();
  assert.equal(metrics.legacyFamilies, 526);
  assert.equal(metrics.legacyTokens, 1603);
  assert.equal(metrics.nativeFamilies, 131);
  assert.equal(metrics.nativeTokens, 709);
  assert.equal(metrics.compatibilityFamilies, 395);
  assert.equal(metrics.compatibilityTokens, 894);
  assert.equal(metrics.fallbackFamilies, 0);
  assert.equal(metrics.fallbackTokens, 0);
});
test('manifesto explícito divergente continua recusado antes de promoção', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shogun-ownership-'));
  try {
    const fixture = path.join(directory, 'manifest.json');
    fs.writeFileSync(fixture, JSON.stringify({ ownership: { strategy: 'accepted-base-plus-full-known-surface', acceptedBaseFamilies: 19, acceptedBaseTokens: 381, macroFamilies: 526, macroTokens: 1280, nativeFamilies: -1 } }));
    assert.throws(() => deriveVNextOwnershipMetrics(fixture), /Ownership real do manifesto divergiu/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('scanner executável qualifica a superfície atual com comandos promocionais', () => {
  const output = execFileSync(process.execPath, ['scripts/analyze-runtime-command-surface.mjs'], {encoding:'utf8'});
  assert.match(output, /RUNTIME_COMMAND_FAMILIES=526/);
  assert.match(output, /RUNTIME_COMMAND_TOKENS=1603/);
  assert.match(output, /RUNTIME_DUPLICATE_BASELINE=OK/);
});
