#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const gyomeiRoot = path.resolve(scriptDir, '../../..');
const localRootArg = process.argv.find(argument => argument.startsWith('--local-root='));
const credentialsArg = process.argv.find(argument => argument.startsWith('--credentials='));
const serverArg = process.argv.find(argument => argument.startsWith('--server='));
const apply = process.argv.includes('--apply');
const restart = process.argv.includes('--restart');
const localRoot = path.resolve(localRootArg?.slice('--local-root='.length) || gyomeiRoot);
const credentialsFile = path.resolve(credentialsArg?.slice('--credentials='.length) || path.join(gyomeiRoot, 'CREDENCIAIS-DEV.md'));
const serverId = serverArg?.slice('--server='.length).trim();

if (!serverId || !/^[a-z0-9-]+$/i.test(serverId)) {
  throw new Error('Informe --server=IDENTIFICADOR.');
}

function extractField(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^\\s*(?:[-*]\\s*)?${escaped}\\s*:\\s*(.+?)\\s*$`, 'im'));
  return match?.[1]?.trim().replace(/^`|`$/g, '').trim() || '';
}

function sha256(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

function listTrackedFiles() {
  const result = spawnSync('git', ['-C', localRoot, 'ls-files', '-z'], {
    encoding: 'utf8',
    shell: false
  });
  if (result.status !== 0) throw new Error('Não foi possível enumerar os arquivos versionados.');
  const packageData = JSON.parse(fs.readFileSync(path.join(localRoot, 'package.json'), 'utf8'));
  const isGyomei = packageData.name === 'nazuna-gyomei';
  return result.stdout
    .split('\0')
    .filter(Boolean)
    .filter(relativePath => !isGyomei || !relativePath.startsWith('dados/database/'))
    .sort();
}

const markdown = fs.readFileSync(credentialsFile, 'utf8');
const panelUrl = extractField(markdown, 'URL').replace(/\/+$/, '');
const apiKey = extractField(markdown, 'Client API key');
if (!panelUrl || !apiKey) throw new Error('Dados do painel incompletos.');

const serverBase = `${panelUrl}/api/client/servers/${encodeURIComponent(serverId)}`;
const authHeaders = { Accept: 'application/json', Authorization: `Bearer ${apiKey}` };

async function request(endpoint, options = {}, allowNotFound = false) {
  let lastError;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      const response = await fetch(`${serverBase}${endpoint}`, {
        ...options,
        headers: { ...authHeaders, ...(options.headers || {}) }
      });
      if (allowNotFound && response.status === 404) return null;
      if (response.ok) return response;
      if ((response.status === 429 || response.status >= 500) && attempt < 10) {
        await new Promise(resolve => setTimeout(resolve, Math.min(attempt * 1500, 10_000)));
        continue;
      }
      throw new Error(`Painel respondeu HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
      if (attempt === 10) break;
      await new Promise(resolve => setTimeout(resolve, Math.min(attempt * 1500, 10_000)));
    }
  }
  throw lastError;
}

async function readRemote(relativePath) {
  const response = await request(
    `/files/contents?file=${encodeURIComponent(`/${relativePath}`)}`,
    {},
    true
  );
  return response ? Buffer.from(await response.arrayBuffer()) : null;
}

async function writeRemote(relativePath, contents) {
  await request(`/files/write?file=${encodeURIComponent(`/${relativePath}`)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: contents
  });
}

const directoryCache = new Map();

async function listRemoteDirectory(relativeDir) {
  const normalized = relativeDir && relativeDir !== '.' ? relativeDir : '';
  if (!directoryCache.has(normalized)) {
    directoryCache.set(normalized, (async () => {
      const response = await request(`/files/list?directory=${encodeURIComponent(normalized ? `/${normalized}` : '/')}`);
      const payload = await response.json();
      return new Set((payload.data || []).map(item => item.attributes?.name));
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

async function ensureDirectory(relativeDir) {
  if (!relativeDir || relativeDir === '.') return;
  const parent = path.posix.dirname(relativeDir);
  await ensureDirectory(parent);
  const entries = await listRemoteDirectory(parent === '.' ? '' : parent);
  const name = path.posix.basename(relativeDir);
  if (entries.has(name)) return;
  await request('/files/create-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root: parent === '.' ? '/' : `/${parent}`, name })
  });
  entries.add(name);
}

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

const manifest = listTrackedFiles();
const localFiles = new Map(manifest.map(relativePath => [
  relativePath,
  fs.readFileSync(path.join(localRoot, relativePath))
]));
const changed = [];

await mapLimit(manifest, 2, async relativePath => {
  const remote = await remotePathExists(relativePath) ? await readRemote(relativePath) : null;
  if (!remote || sha256(remote) !== sha256(localFiles.get(relativePath))) changed.push(relativePath);
});
changed.sort();

console.log(JSON.stringify({ serverId, tracked: manifest.length, changed: changed.length, files: changed }, null, 2));
if (!apply || changed.length === 0) process.exit(0);

for (const relativePath of changed) await ensureDirectory(path.posix.dirname(relativePath));

let uploaded = 0;
await mapLimit(changed, 3, async relativePath => {
  const local = localFiles.get(relativePath);
  await writeRemote(relativePath, local);
  const remote = await readRemote(relativePath);
  if (!remote || sha256(remote) !== sha256(local)) {
    throw new Error(`Falha na verificação de ${relativePath}.`);
  }
  uploaded += 1;
  if (uploaded % 25 === 0 || uploaded === changed.length) {
    process.stderr.write(`Enviados e verificados ${uploaded}/${changed.length}\n`);
  }
});

if (restart) {
  await request('/power', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signal: 'restart' })
  });
  console.log('Reinício solicitado.');
}
