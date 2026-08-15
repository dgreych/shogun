import fs from 'fs';

import { normalizar } from './helpers.js';
import { COMMAND_ALIASES_FILE } from './paths.js';

const BUILTIN_COMMAND_ALIASES = Object.freeze({
  d: 'delete',
  del: 'delete',
  deletar: 'delete',
  delete: 'delete'
});

export function normalizeCommandToken(value) {
  return normalizar(String(value || '').trim()).replace(/\s+/g, '');
}

export function normalizeCommandAliases(rawData) {
  const source = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.aliases)
      ? rawData.aliases
      : [];

  const seen = new Set();
  const aliases = [];

  for (const item of source) {
    if (!item || typeof item !== 'object') continue;

    const alias = normalizeCommandToken(item.alias);
    const command = normalizeCommandToken(item.command);
    if (!alias || !command || seen.has(alias)) continue;

    // Comandos oficiais têm prioridade e não podem ser sequestrados por JSON local antigo.
    if (Object.prototype.hasOwnProperty.call(BUILTIN_COMMAND_ALIASES, alias)) continue;

    seen.add(alias);
    aliases.push({
      ...item,
      alias,
      command,
      fixedParams: typeof item.fixedParams === 'string' ? item.fixedParams.trim() : ''
    });
  }

  return aliases;
}

export function loadSafeCommandAliases(file = COMMAND_ALIASES_FILE) {
  let rawData = { aliases: [] };

  try {
    if (fs.existsSync(file)) {
      rawData = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (error) {
    console.warn(`⚠️ commandAliases.json inválido; usando lista vazia: ${error.message}`);
  }

  const aliases = normalizeCommandAliases(rawData);
  const normalizedData = { aliases };

  try {
    if (JSON.stringify(rawData) !== JSON.stringify(normalizedData)) {
      fs.writeFileSync(file, JSON.stringify(normalizedData, null, 2));
    }
  } catch (error) {
    console.warn(`⚠️ Não foi possível reparar commandAliases.json: ${error.message}`);
  }

  return aliases;
}

export function resolveCommandInput(rawToken, rawAliases = []) {
  const token = normalizeCommandToken(rawToken);
  const builtinCommand = BUILTIN_COMMAND_ALIASES[token];

  if (builtinCommand) {
    return {
      command: builtinCommand,
      matchedAlias: null,
      source: 'builtin'
    };
  }

  const aliases = normalizeCommandAliases(rawAliases);
  const matchedAlias = aliases.find(item => item.alias === token) || null;

  return {
    command: matchedAlias?.command || token,
    matchedAlias,
    source: matchedAlias ? 'custom' : 'direct'
  };
}

export function getQuotedContextInfo(message) {
  if (!message || typeof message !== 'object') return null;

  const directTypes = [
    'extendedTextMessage',
    'imageMessage',
    'videoMessage',
    'documentMessage',
    'audioMessage',
    'stickerMessage',
    'buttonsResponseMessage',
    'listResponseMessage',
    'templateButtonReplyMessage'
  ];

  for (const type of directTypes) {
    const contextInfo = message[type]?.contextInfo;
    if (contextInfo?.stanzaId || contextInfo?.quotedMessage) return contextInfo;
  }

  const wrappers = [
    message.viewOnceMessage?.message,
    message.viewOnceMessageV2?.message,
    message.viewOnceMessageV2Extension?.message,
    message.ephemeralMessage?.message,
    message.documentWithCaptionMessage?.message
  ];

  for (const wrapped of wrappers) {
    const contextInfo = getQuotedContextInfo(wrapped);
    if (contextInfo) return contextInfo;
  }

  return null;
}

export { BUILTIN_COMMAND_ALIASES };
