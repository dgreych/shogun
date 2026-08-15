#!/usr/bin/env node

import fs from 'node:fs/promises';
import dns from 'node:dns/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import mysql from 'mysql2/promise';

const rootDirectory = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const configFile = process.env.TAVERN_DATABASE_CONFIG_PATH || path.join(
  rootDirectory,
  'dados',
  'database',
  'tavern.mysql.json'
);
const resultFile = process.env.TAVERN_DATABASE_CHECK_RESULT || path.join(
  rootDirectory,
  'dados',
  'logs',
  'tavern-db-check.json'
);

function safeFailure(error, startedAt, scan = { hostsTested: 0, openPortCount: 0 }) {
  return {
    checkedAt: new Date().toISOString(),
    ok: false,
    queryOk: false,
    latencyMs: Date.now() - startedAt,
    code: typeof error?.code === 'string' ? error.code.slice(0, 64) : 'DATABASE_CHECK_FAILED',
    scan
  };
}

async function saveResult(result) {
  await fs.mkdir(path.dirname(resultFile), { recursive: true });
  await fs.writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
}

async function defaultGateway() {
  try {
    const routes = (await fs.readFile('/proc/net/route', 'utf8')).trim().split(/\r?\n/).slice(1);
    const fields = routes.map(line => line.trim().split(/\s+/));
    const route = fields.find(parts => parts[1] === '00000000' && parts[2]?.length === 8);
    if (!route) return null;
    return route[2].match(/../g).reverse().map(value => Number.parseInt(value, 16)).join('.');
  } catch {
    return null;
  }
}

async function connectionCandidates(configuredHost) {
  const candidates = [{ kind: 'configured', host: configuredHost }];
  try {
    const resolved = await dns.lookup('host.docker.internal');
    if (resolved.address) candidates.push({ kind: 'host_alias', host: resolved.address });
  } catch {}
  const gateway = await defaultGateway();
  if (gateway) candidates.push({ kind: 'container_gateway', host: gateway });
  return candidates.filter((candidate, index, values) => (
    values.findIndex(item => item.host === candidate.host) === index
  ));
}

function ipv4ToNumber(value) {
  const parts = String(value).split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts.reduce((total, part) => ((total << 8) | part) >>> 0, 0);
}

function numberToIpv4(value) {
  return [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join('.');
}

function privateScanHosts() {
  const hosts = new Set();
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      const ip = ipv4ToNumber(address.address);
      const mask = ipv4ToNumber(address.netmask);
      if (ip === null || mask === null) continue;
      const network = (ip & mask) >>> 0;
      const broadcast = (network | (~mask >>> 0)) >>> 0;
      const total = broadcast - network - 1;
      if (total <= 0 || total > 65534) continue;
      for (let candidate = network + 1; candidate < broadcast; candidate += 1) {
        if (candidate !== ip) hosts.add(numberToIpv4(candidate >>> 0));
      }
    }
  }
  for (let suffix = 17; suffix <= 31; suffix += 1) hosts.add(`172.${suffix}.0.1`);
  return [...hosts];
}

function portIsOpen(host, port, timeoutMs = 250) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const finish = result => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function scanMysqlHosts(port) {
  const hosts = privateScanHosts();
  const openHosts = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(256, hosts.length) }, async () => {
    while (cursor < hosts.length) {
      const index = cursor;
      cursor += 1;
      const host = hosts[index];
      if (await portIsOpen(host, port)) openHosts.push(host);
    }
  });
  await Promise.all(workers);
  return { hostsTested: hosts.length, openHosts };
}

const startedAt = Date.now();
let connection;
let exitCode = 0;
let scanSummary = { hostsTested: 0, openPortCount: 0 };
try {
  const config = JSON.parse(await fs.readFile(configFile, 'utf8'));
  const connectionString = String(config.connectionString || '').replace(/^jdbc:/i, '');
  if (!connectionString) throw Object.assign(new Error('missing connection'), { code: 'CONFIG_MISSING' });
  const parsed = new URL(connectionString);
  if (parsed.protocol !== 'mysql:') {
    throw Object.assign(new Error('invalid protocol'), { code: 'CONFIG_PROTOCOL_INVALID' });
  }
  const baseOptions = {
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\/+/, '')),
    connectTimeout: 5_000,
    multipleStatements: false,
    enableKeepAlive: true
  };
  let selectedCandidate = null;
  let lastError = null;
  let rows = null;
  const directCandidates = await connectionCandidates(parsed.hostname);
  const attemptedHosts = new Set();
  const tryCandidates = async candidates => {
    for (const candidate of candidates) {
      attemptedHosts.add(candidate.host);
      try {
        connection = await mysql.createConnection({ ...baseOptions, host: candidate.host });
        [rows] = await connection.query('SELECT 1 AS health, VERSION() AS server_version');
        selectedCandidate = candidate;
        return true;
      } catch (error) {
        lastError = error;
        await connection?.end().catch(() => {});
        connection = null;
      }
    }
    return false;
  };
  await tryCandidates(directCandidates);
  let scan = { hostsTested: 0, openHosts: [] };
  if (!selectedCandidate && process.env.TAVERN_DATABASE_CHECK_NO_SCAN !== '1') {
    scan = await scanMysqlHosts(baseOptions.port);
    scanSummary = { hostsTested: scan.hostsTested, openPortCount: scan.openHosts.length };
    const discovered = scan.openHosts
      .filter(host => !attemptedHosts.has(host))
      .map(host => ({ kind: 'private_scan', host }));
    await tryCandidates(discovered);
  }
  if (!selectedCandidate) throw lastError || Object.assign(new Error('unreachable'), { code: 'DATABASE_UNREACHABLE' });
  const result = {
    checkedAt: new Date().toISOString(),
    ok: rows?.[0]?.health === 1,
    queryOk: rows?.[0]?.health === 1,
    latencyMs: Date.now() - startedAt,
    serverVersion: String(rows?.[0]?.server_version || '').slice(0, 80),
    endpointKind: selectedCandidate.kind,
    selectedHost: selectedCandidate.host,
    scan: scanSummary
  };
  await saveResult(result);
  console.log(`[BANCO] Diagnóstico concluído: ${result.ok ? 'conexão e consulta válidas' : 'consulta inválida'}.`);
  if (!result.ok) exitCode = 1;
} catch (error) {
  await saveResult(safeFailure(error, startedAt, scanSummary));
  console.error(`[BANCO] Diagnóstico falhou com código ${String(error?.code || 'DATABASE_CHECK_FAILED').slice(0, 64)}.`);
  exitCode = 1;
} finally {
  await connection?.end().catch(() => {});
}

if (process.argv.includes('--hold')) {
  console.log('[BANCO] Aguardando restauração do processo normal.');
  setInterval(() => {}, 60_000);
} else {
  process.exitCode = exitCode;
}
