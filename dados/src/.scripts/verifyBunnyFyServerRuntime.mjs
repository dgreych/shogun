#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '../../..');
const serverArg = process.argv.find(argument => argument.startsWith('--server='));
const credentialsArg = process.argv.find(argument => argument.startsWith('--credentials='));
const serverId = serverArg?.slice('--server='.length).trim();
const credentialsFile = path.resolve(
  credentialsArg?.slice('--credentials='.length) || path.join(projectRoot, 'CREDENCIAIS-DEV.md')
);

if (!serverId || !/^[a-z0-9-]+$/i.test(serverId)) {
  throw new Error('Informe --server=IDENTIFICADOR.');
}

const REQUIRED_RUNTIME_FILES = [
  'dados/src/connect.js',
  'dados/src/index.js',
  'dados/src/funcs/downloads/canvas.js',
  'dados/src/utils/safeCommandLog.js',
  'dados/src/services/bunnyfy/BunnyFyClient.js',
  'dados/src/services/bunnyfy/BunnyFyError.js',
  'dados/src/services/bunnyfy/aiGateway.js',
  'dados/src/services/bunnyfy/capabilityGateway.js',
  'dados/src/services/bunnyfy/contracts.js',
  'dados/src/services/bunnyfy/index.js',
  'dados/src/services/bunnyfy/youtubeGateway.js'
];

// O downloader legado é observado, mas não bloqueia a integridade do gateway
// BunnyFy em modo exclusivo. A divergência precisa ser tratada num lote próprio
// porque pode representar hotfix anterior do fallback.
const OBSERVED_LEGACY_FILES = ['dados/src/funcs/downloads/youtube.js'];

function extractField(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^\\s*(?:[-*]\\s*)?${escaped}\\s*:\\s*(.+?)\\s*$`, 'im'));
  return match?.[1]?.trim().replace(/^`|`$/g, '').trim() || '';
}

function sha256(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

const credentials = fs.readFileSync(credentialsFile, 'utf8');
const panelUrl = extractField(credentials, 'URL').replace(/\/+$/, '');
const apiKey = extractField(credentials, 'Client API key');
const expectedUuid = extractField(credentials, 'Server UUID (completo)');
if (!panelUrl || !apiKey) throw new Error('Dados do painel incompletos.');

const serverBase = `${panelUrl}/api/client/servers/${encodeURIComponent(serverId)}`;
const headers = { Accept: 'application/json', Authorization: `Bearer ${apiKey}` };

async function request(endpoint, allowNotFound = false) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${serverBase}${endpoint}`, {
        headers,
        signal: AbortSignal.timeout(20_000)
      });
      if (allowNotFound && response.status === 404) return null;
      if (response.ok) return response;
      if ((response.status === 429 || response.status >= 500) && attempt < 5) {
        await new Promise(resolve => setTimeout(resolve, attempt * 750));
        continue;
      }
      throw new Error(`Painel respondeu HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
      if (attempt < 5) await new Promise(resolve => setTimeout(resolve, attempt * 750));
    }
  }
  throw lastError;
}

const identityPayload = await (await request('')).json();
const identity = identityPayload.attributes || identityPayload.data?.attributes || {};
if (identity.identifier && identity.identifier !== serverId) {
  throw new Error('Identidade remota divergente do servidor solicitado.');
}
if (expectedUuid && identity.uuid && identity.uuid !== expectedUuid) {
  throw new Error('UUID remoto divergente da credencial local esperada.');
}

const filesToInspect = [...REQUIRED_RUNTIME_FILES, ...OBSERVED_LEGACY_FILES];
const results = [];
let cursor = 0;
async function verifyNext() {
  while (cursor < filesToInspect.length) {
    const index = cursor;
    cursor += 1;
    const relativePath = filesToInspect[index];
    const local = fs.readFileSync(path.join(projectRoot, relativePath));
    const remoteResponse = await request(
      `/files/contents?file=${encodeURIComponent(`/${relativePath}`)}`,
      true
    );
    if (!remoteResponse) {
      results.push({ path: relativePath, status: 'missing' });
      continue;
    }
    const remote = Buffer.from(await remoteResponse.arrayBuffer());
    results.push({
      path: relativePath,
      status: sha256(local) === sha256(remote) ? 'equal' : 'different'
    });
  }
}

await Promise.all(Array.from({ length: 3 }, verifyNext));
results.sort((left, right) => left.path.localeCompare(right.path));
const missing = results.filter(result => result.status === 'missing').map(result => result.path);
const different = results.filter(result => result.status === 'different').map(result => result.path);
const requiredMissing = missing.filter(file => REQUIRED_RUNTIME_FILES.includes(file));
const requiredDifferent = different.filter(file => REQUIRED_RUNTIME_FILES.includes(file));
const observedLegacyDrift = results
  .filter(result => OBSERVED_LEGACY_FILES.includes(result.path) && result.status !== 'equal')
  .map(result => ({ path: result.path, status: result.status }));

console.log(JSON.stringify({
  serverId,
  serverName: identity.name || null,
  requiredFiles: REQUIRED_RUNTIME_FILES.length,
  equalRequiredFiles: REQUIRED_RUNTIME_FILES.length - requiredMissing.length - requiredDifferent.length,
  missing: requiredMissing,
  different: requiredDifferent,
  observedLegacyDrift,
  healthy: requiredMissing.length === 0 && requiredDifferent.length === 0
}, null, 2));

process.exit(requiredMissing.length || requiredDifferent.length ? 1 : 0);
