#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const failures = [];
const notes = [];

const SOURCE_ROOTS = [
  path.join(ROOT, 'dados', 'src'),
  path.join(ROOT, 'src'),
  path.join(ROOT, 'scripts')
];

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-vnext',
  'coverage',
  'dados/database'
]);

const USER_CONFIG_KEY = /^(?:BUNNYFY_|NVIDIA_|VEX_|UPLOAD_GITHUB_|SHOGUN_|BOT_NAME$|DEFAULT_PERSONA$)/;
const SECRET_LIKE = /(?:KEY|TOKEN|SECRET|PASSWORD|COOKIE)/;
const ALLOWED_MODES = new Set(['off', 'primary', 'exclusive']);

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function walk(dir, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relative = path.relative(ROOT, full).replaceAll(path.sep, '/');
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || SKIP_DIRS.has(relative)) continue;
      walk(full, output);
      continue;
    }
    if (/\.(?:[cm]?js|ts)$/.test(entry.name)) output.push(full);
  }
  return output;
}

function parseEnvExample() {
  const env = new Map();
  for (const rawLine of read('.env.example').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) {
      failures.push(`Linha inválida em .env.example: ${rawLine}`);
      continue;
    }
    if (env.has(match[1])) failures.push(`Chave duplicada em .env.example: ${match[1]}`);
    env.set(match[1], match[2]);
  }
  return env;
}

function collectRuntimeKeys() {
  const keys = new Map();
  const patterns = [
    /process\.env\.([A-Z][A-Z0-9_]*)/g,
    /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
    /\benv\.([A-Z][A-Z0-9_]*)/g
  ];
  const files = SOURCE_ROOTS.flatMap(sourceRoot => walk(sourceRoot, []));

  for (const file of files) {
    const relative = path.relative(ROOT, file).replaceAll(path.sep, '/');
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const key = match[1];
        if (!USER_CONFIG_KEY.test(key)) continue;
        if (!keys.has(key)) keys.set(key, new Set());
        keys.get(key).add(relative);
      }
    }
  }
  return keys;
}

function requireEnvKey(env, key) {
  if (!env.has(key)) failures.push(`.env.example não documenta ${key}.`);
}

function expectValue(env, key, expected) {
  requireEnvKey(env, key);
  if (env.has(key) && env.get(key) !== expected) {
    failures.push(`${key} deve iniciar como ${JSON.stringify(expected)} no exemplo público.`);
  }
}

function validateSecretsAreBlank(env) {
  for (const [key, value] of env.entries()) {
    if (!SECRET_LIKE.test(key)) continue;
    if (value.trim()) failures.push(`${key} parece segredo e deve ficar vazio em .env.example.`);
  }
}

function validateModes(env) {
  for (const [key, value] of env.entries()) {
    if (!key.startsWith('BUNNYFY_') || !key.endsWith('_MODE')) continue;
    if (!ALLOWED_MODES.has(value)) {
      failures.push(`${key} deve usar um modo seguro conhecido no exemplo: off, primary ou exclusive.`);
    }
    if (value !== 'off') failures.push(`${key} deve começar em off na distribuição pública.`);
  }
}

function validateInstaller(file) {
  const content = read(file);
  if (!content.includes('.env.example') || !content.includes('.env.local')) {
    failures.push(`${file} não garante/explica o bootstrap de .env.local.`);
  }
  if (!content.includes('npm run setup')) failures.push(`${file} não executa npm run setup.`);
}

function validateGuide(file) {
  const content = read(file);
  if (!content.includes('configuracao-da-instancia.md')) {
    failures.push(`${file} não aponta para o guia canônico de configuração.`);
  }
  if (!/dono principal/i.test(content)) failures.push(`${file} não explica o dono principal da instância.`);
  if (!/nenhuma chave|sem chave de API|não precisa de (?:uma )?chave/i.test(content)) {
    failures.push(`${file} não deixa claro que o núcleo inicia sem chave de API.`);
  }
}

const env = parseEnvExample();
const runtimeKeys = collectRuntimeKeys();

for (const [key, files] of runtimeKeys.entries()) {
  if (!env.has(key)) {
    failures.push(`Configuração usada pelo código não documentada: ${key} (${[...files].slice(0, 4).join(', ')}).`);
  }
}

for (const key of [
  'BOT_NAME',
  'DEFAULT_PERSONA',
  'SHOGUN_LOW_MEMORY',
  'BUNNYFY_ENABLED',
  'BUNNYFY_BASE_URL',
  'BUNNYFY_API_TOKEN',
  'BUNNYFY_AI_MODE',
  'BUNNYFY_YOUTUBE_MODE',
  'BUNNYFY_IMAGES_MODE',
  'BUNNYFY_STICKERS_MODE',
  'BUNNYFY_CANVAS_MODE',
  'BUNNYFY_LOGOS_MODE',
  'BUNNYFY_IMAGE_GEN_MODE',
  'BUNNYFY_TAVERN_RENDER_MODE',
  'BUNNYFY_NEXO_RENDER_MODE',
  'NVIDIA_API_KEY',
  'VEX_API_KEY',
  'VEX_SITE',
  'UPLOAD_GITHUB_TOKEN',
  'UPLOAD_GITHUB_REPO'
]) requireEnvKey(env, key);

expectValue(env, 'BUNNYFY_ENABLED', 'false');
validateSecretsAreBlank(env);
validateModes(env);

for (const file of [
  'scripts/install-linux.sh',
  'scripts/install-macos.sh',
  'scripts/install-termux.sh',
  'scripts/install-windows.ps1'
]) validateInstaller(file);

for (const file of [
  'README.md',
  'docs/primeiros-passos.md',
  'docs/instalacao/linux.md',
  'docs/instalacao/macos.md',
  'docs/instalacao/termux.md',
  'docs/instalacao/windows.md'
]) validateGuide(file);

const configExample = JSON.parse(read('dados/src/config.example.json'));
for (const key of ['nomedono', 'numerodono', 'nomebot', 'prefixo']) {
  if (!Object.hasOwn(configExample, key)) failures.push(`config.example.json não contém ${key}.`);
}
if (configExample.numerodono !== '55DDDNUMERO') {
  failures.push('config.example.json deve manter número neutro, nunca um número real de dono.');
}

const preflight = read('scripts/preflight-platform.mjs');
for (const key of ['BUNNYFY_ENABLED', 'BUNNYFY_BASE_URL', 'BUNNYFY_API_TOKEN', 'NVIDIA_API_KEY', 'VEX_API_KEY', 'VEX_SITE']) {
  if (!preflight.includes(key)) failures.push(`preflight não audita ${key}.`);
}
if (!preflight.includes('Dono principal da instância')) {
  failures.push('preflight não valida a identidade do dono principal da instância.');
}

notes.push(`${runtimeKeys.size} variáveis de configuração da instância encontradas no código.`);
notes.push(`${env.size} entradas documentadas em .env.example.`);

for (const note of notes) console.log(`ℹ️ ${note}`);
for (const failure of failures) console.error(`❌ ${failure}`);

if (failures.length) {
  console.error(`\nContrato de configuração reprovado: ${failures.length} problema(s).\n`);
  process.exit(1);
}

console.log('\n✅ Contrato de configuração da instância aprovado.\n');
