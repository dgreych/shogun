#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import { ROOT_DIR } from './envLoader.js';

const packageFile = path.join(ROOT_DIR, 'package.json');
const packageData = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
const version = String(packageData.version || '1.0.0');
const publicMode = process.argv.includes('--public');
const distDir = path.join(ROOT_DIR, 'dist');
const bundleName = `nazuna-gyomei-server-v${version}`;
const bundleDir = path.join(distDir, bundleName);
const rootTarPath = path.join(distDir, `${bundleName}-root.tar.gz`);
const rootZipPath = path.join(distDir, `${bundleName}-root.zip`);
const groupsDir = path.join(bundleDir, 'dados', 'database', 'grupos');
const manifestFile = path.join(bundleDir, 'DEPLOY-MANIFEST.json');

const SERVER_UNWANTED_PATHS = [
  '.github',
  '.gitignore',
  'AUTOMACOES_V9.md',
  'ROADMAP_NODZ.md',
  'nazuna-main.zip',
  'dados/logs',
  'logs',
  'backups',
  'dist'
];

if (!fs.existsSync(bundleDir)) {
  console.error(`❌ Build não encontrada: ${bundleDir}`);
  process.exit(1);
}

let sanitizedFiles = 0;
let removedEntries = 0;
let removedBuildEntries = 0;

function removeServerDebris() {
  for (const relativePath of SERVER_UNWANTED_PATHS) {
    const target = path.join(bundleDir, relativePath);
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    removedBuildEntries += 1;
  }

  for (const entry of fs.readdirSync(bundleDir)) {
    if (!/\.(zip|tar|tgz|tar\.gz)$/i.test(entry)) continue;
    fs.rmSync(path.join(bundleDir, entry), { recursive: true, force: true });
    removedBuildEntries += 1;
  }
}

removeServerDebris();

if (!publicMode && fs.existsSync(groupsDir)) {
  for (const entry of fs.readdirSync(groupsDir)) {
    if (!entry.toLowerCase().endsWith('.json')) continue;

    const file = path.join(groupsDir, entry);
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Object.prototype.hasOwnProperty.call(data, 'contador')) continue;

      if (Array.isArray(data.contador)) removedEntries += data.contador.length;
      delete data.contador;
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      sanitizedFiles += 1;
    } catch (error) {
      console.error(`❌ Falha ao higienizar ${entry}: ${error.message}`);
      process.exit(1);
    }
  }
}

if (publicMode) {
  fs.rmSync(groupsDir, { recursive: true, force: true });
  fs.rmSync(path.join(bundleDir, 'dados', 'database', 'qr-code'), { recursive: true, force: true });
  fs.rmSync(path.join(bundleDir, '.env.local'), { force: true });
}

if (fs.existsSync(manifestFile)) {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  manifest.name = 'NAZUNA BOT - versão modificada GYOMEI';
  manifest.release = `Versão modificada ${version} sobre a base Nazuna 9.0`;
  manifest.rootLayout = true;
  manifest.startupFileAtArchiveRoot = true;
  manifest.publicArtifact = publicMode;
  manifest.groupActivityCountersRemoved = true;
  manifest.groupFilesSanitized = sanitizedFiles;
  manifest.groupCounterEntriesRemoved = removedEntries;
  manifest.serverDebrisRemoved = removedBuildEntries;
  manifest.notes = Array.isArray(manifest.notes) ? manifest.notes : [];
  manifest.notes.push(
    'Os arquivos são compactados a partir da raiz interna da build, sem pasta externa adicional.',
    'Workflows, logs e arquivos compactados internos foram excluídos; o banner oficial foi preservado no pacote.',
    publicMode
      ? 'Grupos, sessão, bancos pessoais e credenciais foram removidos do artefato público.'
      : 'Os campos contador dos grupos foram removidos; antis e estados de moderação foram preservados.'
  );
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
}

function compactRoot() {
  fs.rmSync(rootTarPath, { force: true });
  fs.rmSync(rootZipPath, { force: true });

  const tarResult = spawnSync('tar', ['-czf', rootTarPath, '.'], {
    cwd: bundleDir,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  if (tarResult.status !== 0) {
    console.error(`❌ Falha ao recompor o TAR root-ready: ${(tarResult.stderr || '').trim()}`);
    process.exit(tarResult.status || 1);
  }

  const zipResult = spawnSync('zip', ['-qr', rootZipPath, '.'], {
    cwd: bundleDir,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  if (zipResult.status !== 0) {
    console.warn('⚠️ ZIP não foi recomposto; use o TAR root-ready.');
    if (zipResult.stderr) console.warn(zipResult.stderr.trim());
  }

  try { fs.chmodSync(rootTarPath, 0o600); } catch {}
  if (fs.existsSync(rootZipPath)) {
    try { fs.chmodSync(rootZipPath, 0o600); } catch {}
  }
}

compactRoot();

console.log('🧹 Estado da build higienizado.');
console.log('🤖 Manifesto identificado como NAZUNA BOT — versão modificada GYOMEI.');
console.log('📂 Compactação root-ready confirmada: sem pasta externa envolvendo o projeto.');
console.log(`🗑️ Entradas desnecessárias removidas do servidor: ${removedBuildEntries}`);
console.log(`📄 Arquivos de grupo ajustados: ${sanitizedFiles}`);
console.log(`👥 Entradas de atividade removidas: ${removedEntries}`);
console.log(publicMode
  ? '🔐 Artefato público: placeholders, sem sessão, logs ou dados pessoais.'
  : '🛡️ Build privada: antis preservados, atividade e detritos removidos.');
