#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '../../..');
const credentialsFile = path.join(rootDir, 'CREDENCIAIS-DEV.md');
const apply = process.argv.includes('--apply');
const restart = process.argv.includes('--restart');
const onlyOption = process.argv.find(argument => argument.startsWith('--only='));

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function extractField(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^\\s*(?:[-*]\\s*)?${escaped}\\s*:\\s*(.+?)\\s*$`, 'im'));
  return match?.[1]?.trim().replace(/^`|`$/g, '').trim() || '';
}

function loadPanelAccess() {
  const markdown = fs.readFileSync(credentialsFile, 'utf8');
  const panelUrl = extractField(markdown, 'URL').replace(/\/+$/, '');
  const apiKey = extractField(markdown, 'Client API key');
  const serverId = extractField(markdown, 'Server ID (curto)');
  if (!panelUrl || !apiKey || !serverId) {
    throw new Error('Dados do painel incompletos em CREDENCIAIS-DEV.md.');
  }
  return { panelUrl, apiKey, serverId };
}

function walkFiles(relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir);
  const output = [];
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relative = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) output.push(...walkFiles(relative));
    else if (entry.isFile()) output.push(relative);
  }
  return output;
}

function buildManifest() {
  const fixed = [
    'package.json',
    'package-lock.json',
    'dados/src/index.js',
    'dados/src/.scripts/checkServerDatabaseConnection.mjs',
    'dados/src/utils/mediaFormat.js',
    'dados/src/funcs/utils/togif.js',
    'GYOMEI_TAVERN.md',
    'docs/AUDITORIA_AUTORIZACAO_GYOMEI.md',
    'docs/AUDITORIA_DEPENDENCIAS_GYOMEI.md',
    'docs/GYOMEI_TAVERN_HANDOFF.md',
    'docs/GYOMEI_TAVERN_TUTORIAL.md',
    'docs/INVENTARIO_DADOS_GYOMEI.md',
    'docs/MIGRACAO_MYSQL_GYOMEI.md',
    'docs/PLANO_CONTINUIDADE_GYOMEI.md',
    'docs/SEGURANCA_GYOMEI.md'
  ];
  const completeManifest = [...new Set([
    ...fixed,
    ...walkFiles('dados/src/security'),
    ...walkFiles('dados/src/tavern')
  ])].sort();
  if (!onlyOption) return completeManifest;
  const selected = onlyOption.slice('--only='.length)
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (!selected.length) throw new Error('--only precisa listar ao menos um arquivo.');
  for (const relativePath of selected) {
    if (path.isAbsolute(relativePath) || relativePath.split('/').includes('..')) {
      throw new Error(`Caminho inválido em --only: ${relativePath}`);
    }
    const absolutePath = path.join(rootDir, relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      throw new Error(`Arquivo de --only não encontrado: ${relativePath}`);
    }
  }
  return [...new Set(selected)].sort();
}

const { panelUrl, apiKey, serverId } = loadPanelAccess();
const serverBase = `${panelUrl}/api/client/servers/${encodeURIComponent(serverId)}`;
const authHeaders = {
  Accept: 'application/json',
  Authorization: `Bearer ${apiKey}`
};

async function request(endpoint, options = {}, { allowNotFound = false } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(`${serverBase}${endpoint}`, {
        ...options,
        headers: { ...authHeaders, ...(options.headers || {}) }
      });
      if (allowNotFound && response.status === 404) return null;
      if (response.ok) return response;
      const detail = (await response.text()).slice(0, 300).replace(/\s+/g, ' ');
      if ((response.status === 429 || response.status >= 500) && attempt < 8) {
        await new Promise(resolve => setTimeout(resolve, Math.min(attempt * 1000, 4000)));
        continue;
      }
      throw new Error(`HTTP ${response.status}: ${detail}`);
    } catch (error) {
      lastError = error;
      if (attempt === 8) break;
      await new Promise(resolve => setTimeout(resolve, Math.min(attempt * 1000, 4000)));
    }
  }
  throw lastError;
}

async function readRemote(relativePath) {
  const response = await request(
    `/files/contents?file=${encodeURIComponent(`/${relativePath}`)}`,
    {},
    { allowNotFound: true }
  );
  if (!response) return null;
  return Buffer.from(await response.arrayBuffer());
}

const directoryCache = new Map();

async function listRemoteDirectory(relativeDir) {
  const normalized = relativeDir && relativeDir !== '.' ? relativeDir : '';
  if (!directoryCache.has(normalized)) {
    directoryCache.set(normalized, (async () => {
      const response = await request(
        `/files/list?directory=${encodeURIComponent(normalized ? `/${normalized}` : '/')}`
      );
      const payload = await response.json();
      return new Map((payload?.data || []).map(item => [
        item?.attributes?.name,
        item?.attributes || {}
      ]));
    })());
  }
  return directoryCache.get(normalized);
}

async function remotePathExists(relativePath) {
  const parent = path.posix.dirname(relativePath);
  const parentPath = parent === '.' ? '' : parent;
  if (parentPath && !(await remotePathExists(parentPath))) return false;
  const entries = await listRemoteDirectory(parentPath);
  return entries.has(path.posix.basename(relativePath));
}

async function writeRemote(relativePath, contents) {
  await request(`/files/write?file=${encodeURIComponent(`/${relativePath}`)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: contents
  });
}

async function ensureDirectory(relativeDir) {
  if (!relativeDir || relativeDir === '.') return;
  const parent = path.posix.dirname(relativeDir);
  const name = path.posix.basename(relativeDir);
  try {
    await request('/files/create-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root: parent === '.' ? '/' : `/${parent}`, name })
    });
  } catch (error) {
    const list = await request(`/files/list?directory=${encodeURIComponent(parent === '.' ? '/' : `/${parent}`)}`);
    const payload = await list.json();
    const exists = payload?.data?.some(item =>
      item?.attributes?.is_file === false && item?.attributes?.name === name
    );
    if (!exists) throw error;
  }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function uploadPriority(relativePath) {
  if (relativePath === 'dados/src/index.js') return 40;
  if (relativePath === 'package.json' || relativePath === 'package-lock.json') return 30;
  if (relativePath.startsWith('dados/src/security/') || relativePath.startsWith('dados/src/tavern/')) {
    return relativePath.includes('/assets/') ? 10 : 20;
  }
  return 5;
}

const manifest = buildManifest();
const localFiles = new Map(manifest.map(relativePath => [
  relativePath,
  fs.readFileSync(path.join(rootDir, relativePath))
]));

console.log(`Manifesto preparado: ${manifest.length} arquivos.`);
const remoteFiles = new Map();
let inspected = 0;
await mapLimit(manifest, 2, async relativePath => {
  let contents;
  try {
    contents = await remotePathExists(relativePath) ? await readRemote(relativePath) : null;
  } catch (error) {
    throw new Error(`Não foi possível ler ${relativePath}: ${error.message}`);
  }
  remoteFiles.set(relativePath, contents);
  inspected += 1;
  if (inspected % 25 === 0 || inspected === manifest.length) {
    console.log(`Pré-verificação remota: ${inspected}/${manifest.length}.`);
  }
});

const changed = manifest.filter(relativePath => {
  const remote = remoteFiles.get(relativePath);
  return !remote || sha256(remote) !== sha256(localFiles.get(relativePath));
});
const missing = changed.filter(relativePath => !remoteFiles.get(relativePath));
console.log(`Diferenças: ${changed.length}; novos: ${missing.length}; iguais: ${manifest.length - changed.length}.`);

if (!apply) {
  console.log('Modo de pré-verificação concluído. Use --apply --restart para implantar.');
  process.exit(0);
}

const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gyomei-tavern-b-'));
for (const [relativePath, contents] of remoteFiles) {
  if (!contents || !changed.includes(relativePath)) continue;
  const backupFile = path.join(backupDir, relativePath);
  fs.mkdirSync(path.dirname(backupFile), { recursive: true });
  fs.writeFileSync(backupFile, contents);
}
console.log(`Cópia temporária dos arquivos substituídos: ${backupDir}`);

const directories = [...new Set(changed.map(relativePath => path.posix.dirname(relativePath)))]
  .flatMap(relativeDir => {
    const parts = relativeDir.split('/').filter(Boolean);
    return parts.map((_, index) => parts.slice(0, index + 1).join('/'));
  });
for (const relativeDir of [...new Set(directories)].sort((a, b) => a.split('/').length - b.split('/').length)) {
  await ensureDirectory(relativeDir);
}

const ordered = [...changed].sort((a, b) => uploadPriority(a) - uploadPriority(b) || a.localeCompare(b));
let uploaded = 0;
try {
  for (const priority of [5, 10, 20, 30, 40]) {
    const batch = ordered.filter(relativePath => uploadPriority(relativePath) === priority);
    await mapLimit(batch, priority === 10 ? 3 : 2, async relativePath => {
      const local = localFiles.get(relativePath);
      await writeRemote(relativePath, local);
      const verified = await readRemote(relativePath);
      if (!verified || sha256(verified) !== sha256(local)) {
        throw new Error(`Verificação SHA-256 falhou em ${relativePath}.`);
      }
      uploaded += 1;
      if (uploaded % 20 === 0 || uploaded === changed.length) {
        console.log(`Envio e verificação: ${uploaded}/${changed.length}.`);
      }
    });
  }
} catch (error) {
  console.error(`Falha no envio: ${error.message}`);
  console.error('Restaurando os arquivos remotos que já existiam...');
  const backups = [...remoteFiles.entries()].filter(([, contents]) => contents);
  await mapLimit(backups, 2, async ([relativePath, contents]) => {
    await writeRemote(relativePath, contents);
  });
  console.error('Restauração concluída; o servidor não será reiniciado.');
  process.exit(1);
}

if (!restart) {
  console.log('Arquivos implantados e verificados. Reinício não solicitado.');
  process.exit(0);
}

await request('/power', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ signal: 'restart' })
});
console.log('Reinício solicitado; acompanhando o processo...');

let healthy = false;
let latestState = 'desconhecido';
let latestUptime = 0;
for (let attempt = 1; attempt <= 12; attempt += 1) {
  await new Promise(resolve => setTimeout(resolve, 5000));
  const response = await request('/resources');
  const payload = await response.json();
  latestState = payload?.attributes?.current_state || 'desconhecido';
  latestUptime = Number(payload?.attributes?.resources?.uptime || 0);
  if ((latestState === 'running' || latestState === 'starting') && latestUptime > 5000) {
    healthy = true;
    break;
  }
}

const debugLog = await readRemote('dados/logs/debug-trigger.log');
const debugText = debugLog?.toString('utf8') || '';
const recentLines = debugText.split(/\r?\n/).slice(-250);
const ffmpegOk = recentLines.some(line => line.includes('FFMPEG_CHECK') && line.includes('"ok":true'));
const tavernFailure = recentLines.some(line => line.includes('[TAVERN] Falha'));
console.log(`Estado: ${latestState}; uptime: ${latestUptime} ms; FFMPEG_CHECK ok: ${ffmpegOk}; falha Tavern recente: ${tavernFailure}.`);

if (!healthy || tavernFailure) {
  console.error('A confirmação automática de saúde falhou. A cópia temporária foi preservada para reversão.');
  process.exit(2);
}

console.log('Implantação concluída e processo confirmado ativo.');
