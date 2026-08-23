#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

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

if (isTermux && !probe('termux-wake-lock', 'termux-wake-lock', [], false)) {
  warnings.push('Use pkg install termux-api e o aplicativo Termux:API para manter o aparelho acordado.');
}

const configPath = path.join(ROOT, 'dados', 'src', 'config.json');
const modulesPath = path.join(ROOT, 'node_modules');
if (fs.existsSync(configPath)) console.log('✅ Configuração local encontrada');
else warnings.push('Configuração local ainda não criada; execute npm run setup.');
if (fs.existsSync(modulesPath)) console.log('✅ Dependências locais encontradas');
else warnings.push('Dependências ainda não instaladas; execute npm ci.');

for (const warning of warnings) console.log(`⚠️ ${warning}`);
for (const failure of failures) console.log(`❌ ${failure}`);

if (failures.length) {
  console.log('\n🚫 O ambiente ainda não está pronto. Corrija os itens acima e repita npm run preflight.\n');
  process.exit(1);
}

console.log('\n🛡️ Ambiente pronto. Siga para a configuração.\n');
