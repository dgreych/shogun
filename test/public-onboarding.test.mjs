import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const pkg = JSON.parse(read('package.json'));
const panel = read('dados/src/.scripts/config-panel.js');
const termuxGuide = read('docs/instalacao/termux.md');
const linuxGuide = read('docs/instalacao/linux.md');

test('npm run setup usa onboarding básico e npm run config mantém painel avançado', () => {
  assert.equal(pkg.scripts.setup, 'node dados/src/.scripts/config-panel.js --basic');
  assert.equal(pkg.scripts.config, 'node dados/src/.scripts/config-panel.js');
});

test('onboarding básico fixa persona shogun e não exige integrações avançadas', () => {
  assert.match(panel, /async function runBasicSetup\(/);
  assert.match(panel, /DEFAULT_PERSONA\s*=\s*'shogun'/);
  assert.match(panel, /BOT_NAME\s*=\s*config\.nomebot/);
  assert.match(panel, /process\.argv\.includes\(['"]--basic['"]\)/);
  assert.match(panel, /npm run config/);
  assert.match(panel, /configuraç[aã]o avançada/i);
});

test('diagnóstico pós-configuração usa caminho absoluto para o preflight', () => {
  assert.match(panel, /path\.join\(ROOT_DIR,\s*['"]scripts['"],\s*['"]preflight-platform\.mjs['"]\)/);
  assert.match(panel, /spawnSync\(process\.execPath,\s*\[preflightPath\]/);
});

test('guias públicos descrevem somente as quatro perguntas do primeiro uso', () => {
  for (const guide of [termuxGuide, linuxGuide]) {
    assert.match(guide, /quatro perguntas/i);
    assert.match(guide, /nome do bot/i);
    assert.match(guide, /prefixo/i);
  }
});
