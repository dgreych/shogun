#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import { loadLocalEnv } from '../dados/src/.scripts/envLoader.js';

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
  return ['true', '1', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function isPresent(value) {
  return Boolean(String(value || '').trim());
}

function maskedState(value) {
  return isPresent(value) ? 'configurado' : 'não configurado';
}

function readLocalConfig(configPath) {
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    failures.push(`dados/src/config.json não pôde ser lido: ${error.message}`);
    return null;
  }
}

function inspectInstanceConfig(config) {
  if (!config) return;

  const ownerName = String(config.nomedono || '').trim();
  const ownerNumber = String(config.numerodono || '').replace(/\D/g, '');
  const botName = String(config.nomebot || '').trim();
  const prefix = String(config.prefixo || '').trim();

  if (!ownerName) failures.push('O nome do dono principal da instância está vazio; execute npm run setup.');
  if (!/^\d{10,15}$/.test(ownerNumber)) {
    failures.push('O número do dono principal da instância deve ter 10 a 15 dígitos; execute npm run setup.');
  }
  if (!botName) failures.push('O nome local do bot está vazio; execute npm run setup.');
  if (!prefix) failures.push('O prefixo de comandos está vazio; execute npm run setup.');

  if (ownerName && /^\d{10,15}$/.test(ownerNumber) && botName && prefix) {
    console.log('✅ Dono principal da instância — configurado');
    console.log('✅ Nome do bot e prefixo — configurados');
  }
}

function inspectOptionalIntegrations() {
  console.log('\n🔌 Integrações opcionais\n');

  const modeKeys = [
    'BUNNYFY_AI_MODE',
    'BUNNYFY_YOUTUBE_MODE',
    'BUNNYFY_IMAGES_MODE',
    'BUNNYFY_STICKERS_MODE',
    'BUNNYFY_CANVAS_MODE',
    'BUNNYFY_LOGOS_MODE',
    'BUNNYFY_GAMES_MODE',
    'BUNNYFY_IMAGE_GEN_MODE',
    'BUNNYFY_TAVERN_RENDER_MODE',
    'BUNNYFY_NEXO_RENDER_MODE'
  ];
  const allowedModes = new Set(['off', 'primary', 'exclusive']);
  const modes = modeKeys.map(key => [key, String(process.env[key] || 'off').trim().toLowerCase()]);

  for (const [key, value] of modes) {
    if (!allowedModes.has(value)) failures.push(`${key} possui modo inválido: use off, primary ou exclusive.`);
  }

  const bunnyFyEnabled = isTrue(process.env.BUNNYFY_ENABLED);
  const activeModes = modes.filter(([, value]) => value !== 'off');
  const bunnyFyBaseUrl = String(process.env.BUNNYFY_BASE_URL || '').trim();
  const bunnyFyToken = String(process.env.BUNNYFY_API_TOKEN || '').trim();

  if (!bunnyFyEnabled) {
    console.log('ℹ️ BunnyFy — desativada; núcleo e fallbacks disponíveis continuam independentes');
  } else if (!activeModes.length) {
    warnings.push('BUNNYFY_ENABLED está ativo, mas nenhuma capacidade BunnyFy saiu de off.');
  } else {
    if (!bunnyFyBaseUrl) failures.push('BunnyFy está ativa em alguma capacidade, mas BUNNYFY_BASE_URL está vazio.');
    if (!bunnyFyToken) failures.push('BunnyFy está ativa em alguma capacidade, mas BUNNYFY_API_TOKEN está vazio.');
    if (bunnyFyBaseUrl && bunnyFyToken) {
      console.log(`✅ BunnyFy — configurada para ${activeModes.length} capacidade(s), sem exibir credencial`);
    }
  }

  const aiMode = bunnyFyEnabled
    ? String(process.env.BUNNYFY_AI_MODE || 'off').trim().toLowerCase()
    : 'off';
  const nvidiaConfigured = isPresent(process.env.NVIDIA_API_KEY);

  if (aiMode === 'exclusive') {
    console.log('ℹ️ IA — exclusiva pela BunnyFy; chave NVIDIA direta não é necessária no bot');
  } else if (nvidiaConfigured) {
    console.log(`✅ NVIDIA direta — ${maskedState(process.env.NVIDIA_API_KEY)}`);
  } else if (aiMode === 'primary') {
    warnings.push('IA está em primary, mas NVIDIA_API_KEY não foi configurada; o fallback direto ficará indisponível.');
  } else {
    console.log('ℹ️ NVIDIA direta — não configurada; recurso opcional');
  }

  const vexKey = isPresent(process.env.VEX_API_KEY);
  const vexSite = isPresent(process.env.VEX_SITE);
  if (vexKey && vexSite) console.log('✅ VEX legado — configurado');
  else if (vexKey || vexSite) warnings.push('VEX está parcialmente configurada; preencha VEX_API_KEY e VEX_SITE ou deixe ambos vazios.');
  else console.log('ℹ️ VEX legado — não configurado');

  const uploadToken = isPresent(process.env.UPLOAD_GITHUB_TOKEN);
  const uploadRepo = isPresent(process.env.UPLOAD_GITHUB_REPO);
  if (uploadToken && uploadRepo) console.log('✅ Upload GitHub legado — configurado');
  else if (uploadToken || uploadRepo) warnings.push('Upload GitHub legado está parcialmente configurado; token e repositório precisam existir juntos.');
  else console.log('ℹ️ Upload GitHub legado — não configurado');
}

console.log('\n⛩️  Verificação do ambiente\n');

const nodeVersion = versionTuple(process.versions.node);
if (atLeast(nodeVersion, MIN_NODE)) console.log(`✅ Node.js — v${process.versions.node}`);
else failures.push(`Node.js ${MIN_NODE.join('.')} ou superior é necessário; atual: v${process.versions.node}`);

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
  else warnings.push('termux-wake-lock não foi encontrado. Atualize termux-tools com: pkg install termux-tools. Não é necessário instalar Termux:API para esse comando.');
}

const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  try {
    loadLocalEnv();
    console.log('✅ .env.local — carregado sem exibir valores');
  } catch (error) {
    failures.push(`.env.local não pôde ser carregado: ${error.message}`);
  }
} else {
  warnings.push('`.env.local` ainda não existe. Copie `.env.example` para `.env.local` ou execute o instalador oficial da plataforma.');
}

const configPath = path.join(ROOT, 'dados', 'src', 'config.json');
const modulesPath = path.join(ROOT, 'node_modules');
const localConfig = readLocalConfig(configPath);
if (localConfig) {
  console.log('✅ Configuração local encontrada');
  inspectInstanceConfig(localConfig);
} else if (!fs.existsSync(configPath)) {
  warnings.push('Configuração local ainda não criada; execute npm run setup.');
}

if (fs.existsSync(modulesPath)) console.log('✅ Dependências locais encontradas');
else warnings.push('Dependências ainda não instaladas; execute npm ci.');

inspectOptionalIntegrations();

for (const warning of warnings) console.log(`⚠️ ${warning}`);
for (const failure of failures) console.log(`❌ ${failure}`);

if (failures.length) {
  console.log('\n🚫 O ambiente ainda não está pronto. Corrija os itens obrigatórios acima e repita npm run preflight.\n');
  process.exit(1);
}

console.log('\n🛡️ Ambiente base pronto. Integrações marcadas como opcionais podem ser configuradas depois.\n');
