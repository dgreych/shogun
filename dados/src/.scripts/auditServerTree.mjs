#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRootDir = path.resolve(scriptDir, '../../..');
const localRootArg = process.argv.find(argument => argument.startsWith('--local-root='));
const rootDir = localRootArg
  ? path.resolve(localRootArg.slice('--local-root='.length))
  : defaultRootDir;
const credentialsFile = path.join(defaultRootDir, 'CREDENCIAIS-DEV.md');
const serverArg = process.argv.find(argument => argument.startsWith('--server='));
const serverId = serverArg?.slice('--server='.length).trim();
const showAll = process.argv.includes('--all');

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

const ignoredDirectories = new Set([
  '.git',
  '.npm',
  'node_modules',
  'database',
  'logs',
  'sessions',
  'session',
  'auth',
  'auth_info_baileys',
  'tmp',
  'temp',
  'backups'
]);

const ignoredFiles = new Set([
  '.env',
  'config.json',
  'CREDENCIAIS-DEV.md'
]);

function isIgnored(relativePath, isFile) {
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.some(part => ignoredDirectories.has(part))) return true;
  if (isFile && ignoredFiles.has(parts.at(-1))) return true;
  if (isFile && /\.(?:zip|tar|tar\.gz|tgz|7z|sqlite|sqlite3|db|log)$/i.test(relativePath)) return true;
  return false;
}

const markdown = fs.readFileSync(credentialsFile, 'utf8');
const panelUrl = extractField(markdown, 'URL').replace(/\/+$/, '');
const apiKey = extractField(markdown, 'Client API key');
if (!panelUrl || !apiKey) throw new Error('Dados do painel incompletos.');

const serverBase = `${panelUrl}/api/client/servers/${encodeURIComponent(serverId)}`;
const headers = { Accept: 'application/json', Authorization: `Bearer ${apiKey}` };

async function request(endpoint) {
  const response = await fetch(`${serverBase}${endpoint}`, { headers });
  if (!response.ok) throw new Error(`Painel respondeu HTTP ${response.status}.`);
  return response;
}

async function listDirectory(relativeDir = '') {
  const directory = relativeDir ? `/${relativeDir}` : '/';
  const response = await request(`/files/list?directory=${encodeURIComponent(directory)}`);
  const payload = await response.json();
  return (payload.data || []).map(item => item.attributes || {});
}

async function readRemote(relativePath) {
  const response = await request(`/files/contents?file=${encodeURIComponent(`/${relativePath}`)}`);
  return Buffer.from(await response.arrayBuffer());
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

async function collectRemote(relativeDir = '') {
  const output = [];
  const entries = await listDirectory(relativeDir);
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (isIgnored(relativePath, entry.is_file)) continue;
    if (entry.is_file) output.push([relativePath, { hash: entry.sha256_hash || null, size: Number(entry.size) }]);
    else output.push(...await collectRemote(relativePath));
  }
  return output;
}

function collectLocal(relativeDir = '') {
  const output = [];
  const absoluteDir = path.join(rootDir, relativeDir);
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (isIgnored(relativePath, entry.isFile())) continue;
    if (entry.isFile()) output.push(relativePath);
    else if (entry.isDirectory()) output.push(...collectLocal(relativePath));
  }
  return output;
}

const remoteEntries = await collectRemote();
const remoteMetadata = new Map(remoteEntries);
const remotePaths = [...remoteMetadata.keys()].sort();
const localPaths = collectLocal().sort();
const remoteSet = new Set(remotePaths);
const localSet = new Set(localPaths);
const onlyRemote = remotePaths.filter(relativePath => !localSet.has(relativePath));
const onlyLocal = localPaths.filter(relativePath => !remoteSet.has(relativePath));
const common = remotePaths.filter(relativePath => localSet.has(relativePath));
const changed = [];

let checked = 0;
await mapLimit(common, 5, async relativePath => {
  const absolutePath = path.join(rootDir, relativePath);
  const localSize = fs.statSync(absolutePath).size;
  const metadata = remoteMetadata.get(relativePath);
  if (metadata.size !== localSize) {
    changed.push(relativePath);
  } else if (metadata.hash) {
    if (metadata.hash !== sha256(fs.readFileSync(absolutePath))) changed.push(relativePath);
  } else {
    const remote = await readRemote(relativePath);
    if (sha256(remote) !== sha256(fs.readFileSync(absolutePath))) changed.push(relativePath);
  }
  checked += 1;
  if (checked % 50 === 0) process.stderr.write(`Verificados ${checked}/${common.length}\n`);
});
changed.sort();

console.log(JSON.stringify({
  serverId,
  remoteFiles: remotePaths.length,
  localFiles: localPaths.length,
  equalFiles: common.length - changed.length,
  changedFiles: changed.length,
  onlyRemoteFiles: onlyRemote.length,
  onlyLocalFiles: onlyLocal.length,
  ...(showAll ? { changed, onlyRemote, onlyLocal } : {})
}, null, 2));
