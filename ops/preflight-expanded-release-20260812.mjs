#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const HOME = os.homedir();
const TS = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').replace(/\..+/, '');
const ART = path.join(HOME, 'Downloads', `RELEASE-EXPANDED-PREFLIGHT-${TS}`);
const REPORT = path.join(ART, 'REPORT.md');
fs.mkdirSync(ART, { recursive: true });

const BUNNY_SERVER = 'e75730fa';
const BUNNY_UUID = 'e75730fa-f3f9-4dc6-be1a-d50024ba00a1';
const GYOMEI_SERVER = 'd56f3096';
const BUNNY_BRANCH = 'release/bun017-ai-cut-logos-20260812';
const GYOMEI_BRANCH = 'release/gyomei-bun017-ai-exclusive-logos-20260812';

const lines = [];
function log(value = '') {
  const text = String(value);
  console.log(text);
  lines.push(text);
}
function save() { fs.writeFileSync(REPORT, lines.join('\n') + '\n'); }

function run(command, args, cwd = undefined, { allowFail = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0 && !allowFail) {
    throw new Error(`${command} ${args.join(' ')} falhou${cwd ? ` em ${cwd}` : ''}: ${String(result.stderr || result.stdout || '').trim()}`);
  }
  return { status: result.status, stdout: String(result.stdout || ''), stderr: String(result.stderr || '') };
}

function normalizeRemote(value) {
  return String(value || '')
    .trim()
    .replace(/^git@github\.com:/i, 'https://github.com/')
    .replace(/^ssh:\/\/git@github\.com\//i, 'https://github.com/')
    .replace(/\.git$/i, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

function discoverRepos() {
  const roots = [path.join(HOME, 'Downloads'), path.join(HOME, 'whatsapp-bot')].filter(fs.existsSync);
  const repos = [];
  for (const root of roots) {
    const found = run('find', [root, '-maxdepth', '5', '-name', '.git', '-print0'], undefined, { allowFail: true });
    for (const gitDir of found.stdout.split('\0').filter(Boolean)) {
      const repo = path.dirname(gitDir);
      const remote = run('git', ['remote', 'get-url', 'origin'], repo, { allowFail: true });
      if (remote.status !== 0) continue;
      const branch = run('git', ['branch', '--show-current'], repo, { allowFail: true }).stdout.trim();
      const status = run('git', ['status', '--porcelain'], repo, { allowFail: true }).stdout.trim();
      repos.push({ repo, remote: normalizeRemote(remote.stdout), branch, clean: !status });
    }
  }
  return repos;
}

function chooseRepo(repos, expectedRemote, kind) {
  const expected = normalizeRemote(expectedRemote);
  const candidates = repos.filter(item => item.remote === expected && item.clean);
  if (!candidates.length) throw new Error(`${kind}: nenhum checkout limpo encontrado para ${expectedRemote}.`);
  const score = item => {
    let n = 0;
    if (kind === 'Gyomei' && item.branch === GYOMEI_BRANCH) n += 100;
    if (kind === 'BunnyFy' && item.branch === BUNNY_BRANCH) n += 100;
    if (kind === 'Gyomei' && item.branch === 'reconcile/gyomei-20260810') n += 80;
    if (kind === 'BunnyFy' && item.branch.startsWith('feature/bun-018')) n += 80;
    if (fs.existsSync(path.join(item.repo, 'package.json'))) n += 10;
    return n;
  };
  const ranked = candidates.map(item => ({ ...item, score: score(item) })).sort((a, b) => b.score - a.score || a.repo.localeCompare(b.repo));
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    throw new Error(`${kind}: checkouts igualmente válidos: ${ranked.filter(x => x.score === ranked[0].score).map(x => x.repo).join(', ')}`);
  }
  return ranked[0];
}

function redact(text) {
  return String(text)
    .replace(/nvapi-[A-Za-z0-9_-]+/g, 'nvapi-[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~-]{12,}/gi, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key\s*[:=]\s*['"]?)[^'"\s]+/gi, '$1[REDACTED]')
    .replace(/(token\s*[:=]\s*['"]?)[A-Za-z0-9._~-]{16,}/gi, '$1[REDACTED]');
}

function writeGrep(repo, filename, regex, includes = ['dados/src']) {
  const args = ['grep', '-n', '-I', '-E', regex, 'HEAD', '--', ...includes];
  const result = run('git', args, repo, { allowFail: true });
  const body = result.status === 0 ? redact(result.stdout) : result.status === 1 ? '(sem ocorrências)\n' : `ERRO: ${redact(result.stderr || result.stdout)}\n`;
  fs.writeFileSync(path.join(ART, filename), body);
  return body.split(/\r?\n/).filter(line => line && !line.startsWith('(') && !line.startsWith('ERRO:')).length;
}

function findCredentials() {
  const preferred = path.join(HOME, 'Downloads', 'nazuna-main-final-20260806-175302', 'CREDENCIAIS-DEV.md');
  if (fs.existsSync(preferred)) return preferred;
  const result = run('find', [path.join(HOME, 'Downloads'), '-maxdepth', '4', '-name', 'CREDENCIAIS-DEV.md', '-print'], undefined, { allowFail: true });
  return result.stdout.split(/\r?\n/).map(x => x.trim()).filter(Boolean)[0] || '';
}

function field(markdown, label) {
  const safe = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^\\s*(?:[-*]\\s*)?${safe}\\s*:\\s*(.+?)\\s*$`, 'im'));
  return (match?.[1] || '').trim().replace(/^`|`$/g, '');
}

async function panelAudit() {
  const credentialsPath = findCredentials();
  if (!credentialsPath) return { available: false, reason: 'CREDENCIAIS-DEV.md não encontrado' };
  const markdown = fs.readFileSync(credentialsPath, 'utf8');
  const base = field(markdown, 'URL').replace(/\/+$/, '');
  const key = field(markdown, 'Client API key');
  if (!base || !key) return { available: false, reason: 'campos do Client API ausentes' };
  const headers = { Accept: 'application/json', Authorization: `Bearer ${key}` };
  async function req(server, endpoint) {
    const response = await fetch(`${base}/api/client/servers/${server}${endpoint}`, { headers, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`${server}${endpoint}: HTTP ${response.status}`);
    return response;
  }
  async function identity(server) {
    const body = await (await req(server, '')).json();
    return body.attributes || body.data?.attributes || {};
  }
  async function file(server, relative) {
    const response = await req(server, `/files/contents?file=${encodeURIComponent('/' + relative)}`);
    return await response.text();
  }
  const bunny = await identity(BUNNY_SERVER);
  const gyomei = await identity(GYOMEI_SERVER);
  if (bunny.name !== 'BunnyFy' || bunny.identifier !== BUNNY_SERVER || bunny.uuid !== BUNNY_UUID) throw new Error('Identidade BunnyFy divergente.');
  if (gyomei.name !== 'Gyomei Nazuna' || gyomei.identifier !== GYOMEI_SERVER) throw new Error('Identidade Gyomei divergente.');
  if (/mendes/i.test(`${bunny.name} ${gyomei.name}`)) throw new Error('DENYLIST Mendes acionada.');
  const configText = await file(GYOMEI_SERVER, 'dados/src/config.json');
  let config = {};
  try { config = JSON.parse(configText); } catch { throw new Error('config.json de produção inválido.'); }
  const ownerDigits = String(config.numerodono || '').replace(/\D/g, '');
  const ownerValid = /^\d{10,15}$/.test(ownerDigits);
  return {
    available: true,
    bunnyName: bunny.name,
    bunnyIdentifier: bunny.identifier,
    gyomeiName: gyomei.name,
    gyomeiIdentifier: gyomei.identifier,
    ownerContactConfigured: ownerValid,
    ownerDigitsLength: ownerDigits.length,
    credentialsPath: path.relative(HOME, credentialsPath)
  };
}

async function main() {
  log('# PREFLIGHT READ-ONLY — RELEASE AMPLIADA');
  log('');
  log(`Data: ${new Date().toISOString()}`);
  log('Natureza: read-only para source e servidores; nenhuma escrita Git/Pterodactyl; nenhum power action.');
  log('');

  const repos = discoverRepos();
  const gyomei = chooseRepo(repos, 'https://github.com/dgreych/nazuna-gyomei', 'Gyomei');
  const bunny = chooseRepo(repos, 'https://github.com/dgreych/BunnyFy', 'BunnyFy');

  log('## Checkouts selecionados');
  log(`- Gyomei: \`${gyomei.repo}\`, branch \`${gyomei.branch || '(detached)'}\`, clean=true.`);
  log(`- BunnyFy: \`${bunny.repo}\`, branch \`${bunny.branch || '(detached)'}\`, clean=true.`);
  log('');

  const bunnyRemote = run('git', ['ls-remote', '--heads', 'origin', BUNNY_BRANCH], bunny.repo, { allowFail: true }).stdout.trim();
  const gyomeiRemote = run('git', ['ls-remote', '--heads', 'origin', GYOMEI_BRANCH], gyomei.repo, { allowFail: true }).stdout.trim();
  fs.writeFileSync(path.join(ART, 'remote-branches.txt'), `BunnyFy=${redact(bunnyRemote)}\nGyomei=${redact(gyomeiRemote)}\n`);
  log(`- branch remota BunnyFy: ${bunnyRemote ? 'PRESENTE' : 'AUSENTE'}.`);
  log(`- branch remota Gyomei: ${gyomeiRemote ? 'PRESENTE' : 'AUSENTE'}.`);

  const personaCount = writeGrep(gyomei.repo, 'persona-candidates.txt', 'changeperso|getActivePersona|setActivePersona|assistentePersonality|set-personalidade|buildAssistantSystemPrompt|persona', ['dados/src']);
  const canvasCount = writeGrep(gyomei.repo, 'canvas-candidates.txt', 'setbannerbv|setbannersaiu|welcome-card|socialCardWithBunnyFy|backgroundMediaId|avatarMediaId|bannerbv|bannersaiu', ['dados/src']);
  const brandingCount = writeGrep(gyomei.repo, 'branding-vex-nodz-candidates.txt', 'Vex|VEX|vex|Nodz|NODZ|nodz', ['dados/src']);
  const contactCount = writeGrep(gyomei.repo, 'contact-output-candidates.txt', 'BUNNYFY_ACCOUNT_URL|resolveBunnyFyAccountUrl|buildBunnyFyAccessMessage|numerodono|wa\.me|Planos e chaves', ['dados/src']);
  const outputCount = writeGrep(gyomei.repo, 'technical-output-candidates.txt', 'BUNNYFY_[A-Z_]+|HTTP [0-9]{3}|capability|gateway|provider|fallback|scope', ['dados/src']);
  const bunnyCanvasCount = writeGrep(bunny.repo, 'bunnyfy-canvas-candidates.txt', 'welcome|leave|persona|identity|backgroundMediaId|avatarMediaId|renderWelcomeCard', ['src', 'assets/social-canvas']);

  log('');
  log('## Inventário source');
  log(`- persona/changeperso: ${personaCount} ocorrência(s).`);
  log(`- Canvas/banner: ${canvasCount} ocorrência(s).`);
  log(`- Vex/Nodz em source Gyomei: ${brandingCount} ocorrência(s) candidatas.`);
  log(`- contato/site: ${contactCount} ocorrência(s).`);
  log(`- outputs técnicos candidatos: ${outputCount} ocorrência(s).`);
  log(`- BunnyFy Canvas/persona: ${bunnyCanvasCount} ocorrência(s).`);

  log('');
  log('## Produção read-only');
  try {
    const remote = await panelAudit();
    if (!remote.available) {
      log(`- Pterodactyl: NÃO COLETADO (${remote.reason}).`);
    } else {
      log(`- BunnyFy: ${remote.bunnyName}/${remote.bunnyIdentifier} identidade OK.`);
      log(`- Gyomei: ${remote.gyomeiName}/${remote.gyomeiIdentifier} identidade OK.`);
      log('- Mendes: fora do alvo.');
      log(`- OWNER_CONTACT_CONFIGURED=${remote.ownerContactConfigured}.`);
      log(`- OWNER_CONTACT_DIGITS_LENGTH=${remote.ownerDigitsLength}.`);
      log('- número completo do dono: não registrado.');
    }
  } catch (error) {
    log(`- Pterodactyl audit ERROR: ${String(error?.message || error).replace(/\s+/g, ' ')}.`);
  }

  log('');
  log('## Estado');
  log('- PREFLIGHT_CONCLUIDO_READ_ONLY.');
  log('- Nenhuma alteração local de projeto foi executada.');
  log('- Nenhuma escrita Pterodactyl foi executada.');
  log('- Nenhuma power action foi executada.');
  log('- Este pacote deve ser usado para implementar/versionar a release ampliada antes de novo deploy.');
  save();
}

let failed = null;
try {
  await main();
} catch (error) {
  failed = error;
  log('');
  log('## FALHA DO PREFLIGHT');
  log(`- ${String(error?.message || error).replace(/\s+/g, ' ')}`);
  log('- Nenhuma mutação de servidor foi executada por este script.');
  save();
  process.exitCode = 1;
} finally {
  save();
  const archive = `${ART}.tar.gz`;
  const packed = spawnSync('tar', ['-C', path.dirname(ART), '-czf', archive, path.basename(ART)], { encoding: 'utf8' });
  console.log('');
  console.log('============================================================');
  console.log(' PREFLIGHT RELEASE AMPLIADA ENCERRADO');
  console.log('============================================================');
  console.log(`REPORT=${REPORT}`);
  console.log(`PACOTE=${archive}`);
  console.log(`STATUS=${failed ? 'FALHOU_READ_ONLY' : 'CONCLUIDO_READ_ONLY'}`);
  console.log('O terminal permanece aberto.');
}
