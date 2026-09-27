import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { DEFAULT_PERSONA, PERSONALITY_KEYS } from '../dados/src/utils/shogunCore.js';

const EXPECTED_PERSONAS = ['shogun'];

function probeStoreDefault(persona) {
  const script = `import { DEFAULT_DATA } from './dados/src/utils/shogunStore.js'; process.stdout.write(String(DEFAULT_DATA.activePersona || ''));`;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      DEFAULT_PERSONA: persona
    }
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

test('SHOGUN é a persona canônica de fábrica', () => {
  assert.equal(DEFAULT_PERSONA, 'shogun');
});

test('catálogo canônico contém exatamente as personas expostas pelo produto', () => {
  assert.deepEqual(PERSONALITY_KEYS, EXPECTED_PERSONAS);
});

test('store mantém Shogun mesmo com configuração antiga', () => {
  assert.equal(probeStoreDefault('shogun'), 'shogun');
  assert.equal(probeStoreDefault('perfil_antigo'), 'shogun');
});

test('painel de configuração fixa a identidade Shogun', () => {
  const panel = readFileSync(new URL('../dados/src/.scripts/config-panel.js', import.meta.url), 'utf8');
  assert.ok(panel.includes("envDraft.DEFAULT_PERSONA = 'shogun'"));
  assert.ok(!panel.includes('personaChoices'));
});
