#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { loadLocalEnv } from '../dados/src/.scripts/envLoader.js';
import {
  BUNNYFY_MODE_KEYS,
  loadInstanceConfig,
  secretState,
  validateEnvUpdates,
  validateIdentity
} from '../dados/src/.scripts/instanceConfigStore.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const MIN_NODE = [20, 19, 0];
const failures = [];
const warnings = [];

function versionTuple(value) {
  const match = String(value).match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : [0, 0, 0];
}

function atLeast(actual, minimum) {
  return actual.some((part, index) => part > minimum[index] && actual.slice(0, index).every((value, i) => value === minimum[i]))
    || actual.every((part, index) => part === minimum[index]);
}

function probe(label, command, args, required = true) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', shell: false });
  if (result.status === 0) {
    const firstLine = `${result.stdout || result.stderr || ''}`.trim().split(/\r?\n/)[0];
    console.log(`✅ ${label}${firstLine ? ` — ${firstLine}` : ''}`);
    return true;
  }
  const message = `${label} não foi encontrado`;
  (required ? failures : warnings).push(message);
  console.log(`${required ? '❌' : '⚠️'} ${message}`);
  return false;
}

function isTrue(value) {
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

console.log('\n⛩️  Verificação do ambiente\n');

const nodeVersion = versionTuple(process.versions.node);
if (atLeast(nodeVersion, MIN_NODE)) console.log(`✅ Node.js — v${process.versions.node}`);
else failures.push(`Node.js ${MIN_NODE.join('.')} ou superior é necessário; atual: ${process.versions.node}`);

probe('npm', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version']);
probe('Git', 'git', ['--version']);
probe('FFmpeg', 'ffmpeg', ['-version']);

const isTermux = Boolean(process.env.TERMUX_VERSION) || fs.existsSync('/data/data/com.termux');
const platformName = isTermux ? 'Termux/Android' : `${process.platform}/${process.arch}`;
console.log(`✅ Plataforma detectada — ${platformName}`);

if (isTermux) {
  const prefix = process.env.PREFIX || '/data/data/com.termux/files/usr';
  const wakeLockPath = path.join(prefix, 'bin', 'termux-wake-lock');
  if (fs.existsSync(wakeLockPath)) console.log('✅ termux-wake-lock — disponível');
  else warnings.push('termux-wake-lock não foi encontrado. Instale/atualize termux-tools; Termux:API não é necessário apenas para o wake lock.');
}

const envState = loadLocalEnv();
if (envState.exists) console.log('✅ .env.local — carregado sem exibir valores');
else warnings.push('.env.local ainda não existe. Execute npm run setup; o painel cria o arquivo privado para você.');

const configPath = path.join(ROOT, 'dados', 'src', 'config.json');
if (fs.existsSync(configPath)) {
  console.log('✅ Configuração local encontrada');
  for (const problem of validateIdentity(loadInstanceConfig())) failures.push(problem);
} else {
  warnings.push('Configuração local ainda não criada; execute npm run setup.');
}

const modulesPath = path.join(ROOT, 'node_modules');
if (fs.existsSync(modulesPath)) console.log('✅ Dependências locais encontradas');
else warnings.push('Dependências ainda não instaladas; execute npm ci.');

console.log('\n🔌 Integrações da instância\n');
const envDraft = { ...process.env };
for (const problem of validateEnvUpdates(envDraft)) failures.push(problem);

const bunnyFyEnabled = isTrue(process.env.BUNNYFY_ENABLED);
const activeModes = BUNNYFY_MODE_KEYS.filter(key => String(process.env[key] || 'off').trim().toLowerCase() !== 'off');
if (!bunnyFyEnabled) {
  console.log('ℹ️ BunnyFy — desativada');
} else {
  console.log(`✅ BunnyFy — habilitada; ${activeModes.length} capacidade(s) ativa(s)`);
  console.log(`✅ Credencial BunnyFy — ${secretState(process.env.BUNNYFY_API_TOKEN)}`);
}

for (const key of activeModes) console.log(`  • ${key}=${String(process.env[key]).trim().toLowerCase()}`);
console.log(`ℹ️ NVIDIA direta — ${secretState(process.env.NVIDIA_API_KEY)}`);
console.log(`ℹ️ VEX legado — ${secretState(process.env.VEX_API_KEY)}`);
console.log(`ℹ️ Upload GitHub legado — ${secretState(process.env.UPLOAD_GITHUB_TOKEN)}`);

for (const warning of warnings) console.log(`⚠️ ${warning}`);
for (const failure of failures) console.log(`❌ ${failure}`);

if (failures.length) {
  console.log('\n🚫 O ambiente ainda não está pronto. Abra npm run setup, corrija os itens e repita npm run preflight.\n');
  process.exit(1);
}

console.log('\n🛡️ Ambiente base pronto. Recursos opcionais podem ser configurados pelo painel quando você quiser.\n');
