import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPTS_DIR = path.dirname(__filename);
export const ROOT_DIR = path.resolve(SCRIPTS_DIR, '..', '..', '..');
export const CONFIG_PATH = path.join(ROOT_DIR, 'dados', 'src', 'config.json');
export const CONFIG_EXAMPLE_PATH = path.join(ROOT_DIR, 'dados', 'src', 'config.example.json');
export const ENV_LOCAL_PATH = path.join(ROOT_DIR, '.env.local');
export const ENV_EXAMPLE_PATH = path.join(ROOT_DIR, '.env.example');

export const BUNNYFY_MODE_KEYS = Object.freeze([
  'BUNNYFY_AI_MODE',
  'BUNNYFY_YOUTUBE_MODE',
  'BUNNYFY_IMAGES_MODE',
  'BUNNYFY_STICKERS_MODE',
  'BUNNYFY_CANVAS_MODE',
  'BUNNYFY_LOGOS_MODE',
  'BUNNYFY_TRANSCRIPTION_MODE',
  'BUNNYFY_FACEBOOK_MODE',
  'BUNNYFY_PINTEREST_MODE',
  'BUNNYFY_TIKTOK_MODE',
  'BUNNYFY_KWAI_MODE',
  'BUNNYFY_GAMES_MODE',
  'BUNNYFY_IMAGE_GEN_MODE',
  'BUNNYFY_TAVERN_RENDER_MODE',
  'BUNNYFY_NEXO_RENDER_MODE'
]);

export const ALLOWED_BUNNYFY_MODES = new Set(['off', 'primary', 'exclusive']);

function safeJsonRead(file, fallback = {}) {
  if (!fs.existsSync(file)) return { ...fallback };
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { ...fallback };
}

export function loadInstanceConfig() {
  const fallback = safeJsonRead(CONFIG_EXAMPLE_PATH, {
    nomedono: 'Comandante',
    numerodono: '55DDDNUMERO',
    nomebot: 'SHOGUN',
    prefixo: '!'
  });
  return { ...fallback, ...safeJsonRead(CONFIG_PATH, {}) };
}

export function normalizeOwnerNumber(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function validateIdentity(config) {
  const failures = [];
  const ownerName = String(config?.nomedono ?? '').trim();
  const ownerNumber = normalizeOwnerNumber(config?.numerodono);
  const botName = String(config?.nomebot ?? '').trim();
  const prefix = String(config?.prefixo ?? '').trim();

  if (!ownerName) failures.push('Informe o nome do dono principal da instância.');
  if (!/^\d{10,15}$/.test(ownerNumber)) failures.push('O número do dono deve ter entre 10 e 15 dígitos, incluindo país e DDD.');
  if (!botName) failures.push('Informe o nome desta instância do bot.');
  if (prefix.length !== 1) failures.push('O prefixo deve conter exatamente um caractere.');
  return failures;
}

export function saveInstanceConfig(config, file = CONFIG_PATH) {
  const normalized = {
    ...config,
    nomedono: String(config.nomedono ?? '').trim(),
    numerodono: normalizeOwnerNumber(config.numerodono),
    nomebot: String(config.nomebot ?? '').trim(),
    prefixo: String(config.prefixo ?? '').trim()
  };
  const failures = validateIdentity(normalized);
  if (failures.length) throw new Error(failures.join(' '));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
  if (process.platform !== 'win32') fs.chmodSync(file, 0o600);
  return normalized;
}

export function parseEnvText(text = '') {
  const values = new Map();
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

function serializeEnvValue(value) {
  const text = String(value ?? '');
  if (!text) return '';
  if (/^[A-Za-z0-9_./:@%+,-]+$/.test(text)) return text;
  return JSON.stringify(text);
}

export function updateEnvText(originalText, updates) {
  const lines = String(originalText ?? '').split(/\r?\n/);
  const pending = new Map(Object.entries(updates ?? {}).map(([key, value]) => [key, String(value ?? '')]));
  const output = [];

  for (const rawLine of lines) {
    const match = rawLine.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match || !pending.has(match[1])) {
      output.push(rawLine);
      continue;
    }
    const key = match[1];
    output.push(`${key}=${serializeEnvValue(pending.get(key))}`);
    pending.delete(key);
  }

  if (pending.size) {
    if (output.length && output.at(-1) !== '') output.push('');
    output.push('# Configurado pelo painel do SHOGUN');
    for (const [key, value] of pending) output.push(`${key}=${serializeEnvValue(value)}`);
  }

  while (output.length > 1 && output.at(-1) === '' && output.at(-2) === '') output.pop();
  return `${output.join('\n').replace(/\n+$/u, '')}\n`;
}

export function loadEnvDocument() {
  const source = fs.existsSync(ENV_LOCAL_PATH) ? ENV_LOCAL_PATH : ENV_EXAMPLE_PATH;
  const text = fs.existsSync(source) ? fs.readFileSync(source, 'utf8') : '';
  return { source, text, values: parseEnvText(text) };
}

export function validateEnvUpdates(updates) {
  const failures = [];
  for (const key of BUNNYFY_MODE_KEYS) {
    if (!(key in updates)) continue;
    const value = String(updates[key] ?? '').trim().toLowerCase();
    if (!ALLOWED_BUNNYFY_MODES.has(value)) failures.push(`${key}: use off, primary ou exclusive.`);
  }
  const enabled = ['1', 'true', 'yes', 'on'].includes(String(updates.BUNNYFY_ENABLED ?? '').trim().toLowerCase());
  const active = BUNNYFY_MODE_KEYS.some(key => String(updates[key] ?? 'off').trim().toLowerCase() !== 'off');
  if (enabled && active) {
    const base = String(updates.BUNNYFY_BASE_URL ?? '').trim();
    const token = String(updates.BUNNYFY_API_TOKEN ?? '').trim();
    if (!base) failures.push('BunnyFy ativa exige a URL da API.');
    if (!token) failures.push('BunnyFy ativa exige a credencial de consumidor.');
    if (base) {
      try {
        const url = new URL(base);
        if (!['https:', 'http:'].includes(url.protocol)) failures.push('A URL BunnyFy deve usar http ou https.');
      } catch {
        failures.push('A URL BunnyFy é inválida.');
      }
    }
  }
  return failures;
}

export function saveEnvUpdates(updates, file = ENV_LOCAL_PATH) {
  const baseText = fs.existsSync(file)
    ? fs.readFileSync(file, 'utf8')
    : (fs.existsSync(ENV_EXAMPLE_PATH) ? fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8') : '');
  const merged = Object.fromEntries(parseEnvText(baseText));
  Object.assign(merged, Object.fromEntries(Object.entries(updates ?? {}).map(([key, value]) => [key, String(value ?? '')])));
  const failures = validateEnvUpdates(merged);
  if (failures.length) throw new Error(failures.join(' '));
  const next = updateEnvText(baseText, updates);
  fs.writeFileSync(file, next, { mode: 0o600 });
  if (process.platform !== 'win32') fs.chmodSync(file, 0o600);
  return parseEnvText(next);
}

export function secretState(value) {
  return String(value ?? '').trim() ? 'configurado' : 'não configurado';
}
