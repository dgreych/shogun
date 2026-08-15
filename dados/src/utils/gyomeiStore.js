import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { DEFAULT_NVIDIA_MODEL, isKnownNvidiaModel } from './nvidiaApi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const SRC_DIR = path.resolve(__dirname, '..');
export const DATABASE_DIR = path.resolve(SRC_DIR, '..', 'database');
export const OWNER_DB_DIR = path.join(DATABASE_DIR, 'dono');
export const AUTOMATIONS_FILE = path.join(OWNER_DB_DIR, 'automacoes-v9.json');
export const MEDIA_DIR = path.join(OWNER_DB_DIR, 'command-media');
export const DELETED_FILE = path.join(OWNER_DB_DIR, 'deleted-messages-v9.json');
export const CONFIG_FILE = path.join(SRC_DIR, 'config.json');

export const DEFAULT_DATA = {
  autoTranscriptionGroups: {},
  commandMedia: {},
  additionalOwners: [],
  assistantPrompts: {},
  activePersona: 'gyomei'
};

export function ensureDirectories() {
  fs.mkdirSync(OWNER_DB_DIR, { recursive: true });
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

function reviveJsonValue(_key, value) {
  if (
    value
    && value.type === 'Buffer'
    && Array.isArray(value.data)
    && value.data.every(item => Number.isInteger(item) && item >= 0 && item <= 255)
  ) {
    return Buffer.from(value.data);
  }
  return value;
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'), reviveJsonValue);
  } catch {
    return fallback;
  }
}

export function writeJson(file, value) {
  ensureDirectories();
  const temporary = `${file}.tmp`;
  fs.writeFileSync(
    temporary,
    JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, 2)
  );
  fs.renameSync(temporary, file);
}

export function getAutomationData() {
  const stored = readJson(AUTOMATIONS_FILE, {});
  return {
    ...DEFAULT_DATA,
    ...stored,
    autoTranscriptionGroups: stored.autoTranscriptionGroups || {},
    commandMedia: stored.commandMedia || {},
    additionalOwners: Array.isArray(stored.additionalOwners) ? stored.additionalOwners : [],
    assistantPrompts: stored.assistantPrompts || {}
  };
}

export function saveAutomationData(data) {
  writeJson(AUTOMATIONS_FILE, data);
}

export function getConfig() {
  const stored = readJson(CONFIG_FILE, {});
  return {
    ...stored,
    nvidia_api_key: process.env.NVIDIA_API_KEY || stored.nvidia_api_key || '',
    nvidia_model: isKnownNvidiaModel(stored.nvidia_model) ? stored.nvidia_model : DEFAULT_NVIDIA_MODEL,
    apikey_vex: process.env.VEX_API_KEY || stored.apikey_vex || '',
    site_vex: process.env.VEX_SITE || stored.site_vex || '',
    upload_github_token: process.env.UPLOAD_GITHUB_TOKEN || stored.upload_github_token || '',
    upload_github_repo: process.env.UPLOAD_GITHUB_REPO || stored.upload_github_repo || 'uploadsnew/uploads'
  };
}

export function normalizeCommand(command) {
  return String(command || '')
    .trim()
    .replace(/^[!./#]+/, '')
    .toLowerCase();
}

export function normalizeIdentity(value) {
  const raw = String(value || '').trim().replace(/^@/, '');
  if (!raw) return '';
  if (raw.includes('@')) return raw.split(':')[0].toLowerCase();
  const digits = raw.replace(/\D/g, '');
  return digits || raw.toLowerCase();
}

export function identityAliases(value) {
  const normalized = normalizeIdentity(value);
  if (!normalized) return new Set();
  const aliases = new Set([normalized]);
  const base = normalized.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (base) aliases.add(base);
  if (/^\d+$/.test(normalized)) {
    aliases.add(`${normalized}@s.whatsapp.net`);
    aliases.add(`${normalized}@lid`);
  }
  return aliases;
}

export function identitiesMatch(left, right) {
  const leftAliases = identityAliases(left);
  const rightAliases = identityAliases(right);
  return [...leftAliases].some(alias => rightAliases.has(alias));
}

export function unwrapMessageContent(message) {
  let current = message?.message || message || null;
  const wrappers = [
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'documentWithCaptionMessage',
    'editedMessage'
  ];

  for (let depth = 0; depth < 8 && current; depth++) {
    const wrapper = wrappers.find(key => current?.[key]?.message);
    if (!wrapper) break;
    current = current[wrapper].message;
  }
  return current;
}

export function contextInfoFromContent(content) {
  return content?.extendedTextMessage?.contextInfo
    || content?.imageMessage?.contextInfo
    || content?.videoMessage?.contextInfo
    || content?.audioMessage?.contextInfo
    || content?.documentMessage?.contextInfo
    || content?.stickerMessage?.contextInfo
    || null;
}
