import axios from 'axios';
import fs from 'fs';
import { downloadContentFromMessage } from 'baileys';
import {
  DELETED_FILE,
  MEDIA_DIR,
  getAutomationData,
  getConfig,
  normalizeCommand,
  readJson,
  saveAutomationData,
  unwrapMessageContent,
  writeJson
} from './shogunStore.js';
import { getActivePersona } from './shogunCore.js';
import { transcriptionWithBunnyFy } from '../services/bunnyfy/capabilityGateway.js';

const MAX_RECENT_MESSAGES = 5000;
const commandContext = new Map();
const deletedMessages = new Map();
const recentMessages = new Map();
const mediaInterceptorSockets = new WeakSet();
const deletedTrackerSockets = new WeakSet();

export function isAutoTranscriptionEnabled(chatId) {
  return getAutomationData().autoTranscriptionGroups?.[chatId] === true;
}

export function toggleAutoTranscription(chatId) {
  const data = getAutomationData();
  data.autoTranscriptionGroups[chatId] = !data.autoTranscriptionGroups[chatId];
  saveAutomationData(data);
  return data.autoTranscriptionGroups[chatId];
}

export async function transcribeAudioUrl(audioUrl) {
  const config = getConfig();
  const site = String(config.site_vex || '').replace(/\/$/, '');
  const apiKey = String(config.apikey_vex || '').trim();

  if (!site || !apiKey || apiKey.startsWith('COLOQUE_')) {
    return { ok: false, msg: 'Configure site_vex e apikey_vex em dados/src/config.json.' };
  }
  if (!audioUrl) return { ok: false, msg: 'Não foi possível gerar o link temporário do áudio.' };

  try {
    const url = `${site}/api/ias/transcrever?apikey=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(audioUrl)}`;
    const response = await axios.get(url, {
      headers: { Accept: '*/*', 'User-Agent': 'Node.js' },
      timeout: 120000
    });
    const data = response.data;
    const text = data?.resultado?.data?.texto
      || data?.resultado?.texto
      || data?.data?.texto
      || data?.data?.text
      || data?.texto
      || data?.text
      || data?.resposta
      || data?.result;

    if (!text) {
      return { ok: false, msg: data?.message || data?.msg || 'A API não retornou uma transcrição.' };
    }
    return { ok: true, texto: String(text).trim(), source: 'vex' };
  } catch (error) {
    return {
      ok: false,
      msg: error?.response?.data?.message
        || error?.response?.data?.msg
        || error?.response?.data?.detail
        || error.message
    };
  }
}

export async function transcribeAudio(buffer, { mime = 'audio/ogg', language, uploadForFallback } = {}) {
  try {
    return await transcriptionWithBunnyFy(buffer, {
      mime,
      language,
      legacyFallback: async () => {
        if (typeof uploadForFallback !== 'function') {
          return { ok: false, msg: 'Não foi possível gerar o link temporário do áudio.' };
        }
        const audioUrl = await uploadForFallback();
        return transcribeAudioUrl(audioUrl);
      }
    });
  } catch (error) {
    return { ok: false, msg: error?.message || 'Não foi possível transcrever o áudio agora.' };
  }
}

export async function saveCommandMedia(command, buffer, type, gifPlayback = false) {
  const normalized = normalizeCommand(command);
  if (!normalized) throw new Error('Informe o comando que receberá a mídia.');
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('Mídia inválida.');

  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const normalizedType = type === 'image' ? 'image' : type === 'gif' ? 'gif' : 'video';
  const extension = normalizedType === 'image' ? 'jpg' : normalizedType === 'gif' ? 'gif' : 'mp4';
  const safeName = normalized.replace(/[^a-z0-9_-]/gi, '_');
  const filePath = `${MEDIA_DIR}/${safeName}.${extension}`;
  fs.writeFileSync(filePath, buffer);

  const data = getAutomationData();
  data.commandMedia[normalized] = {
    type: normalizedType,
    path: filePath,
    gifPlayback: Boolean(gifPlayback),
    updatedAt: new Date().toISOString()
  };
  saveAutomationData(data);
  return data.commandMedia[normalized];
}

export function listCommandMedia() {
  return Object.entries(getAutomationData().commandMedia || {})
    .filter(([, item]) => item?.path)
    .map(([command, item]) => ({ command, ...item }));
}

export function getCommandMedia(command) {
  const normalized = normalizeCommand(command);
  const item = getAutomationData().commandMedia?.[normalized];
  return item?.path ? item : null;
}

export function resolveCommandMedia(command) {
  const persona = getActivePersona();
  return getCommandMedia(`${persona}_${command}`) || getCommandMedia(command);
}

export function removeCommandMedia(command) {
  const normalized = normalizeCommand(command);
  const data = getAutomationData();
  const current = data.commandMedia?.[normalized];
  if (!current) return false;

  try {
    if (current.path && fs.existsSync(current.path)) fs.unlinkSync(current.path);
  } catch {}

  delete data.commandMedia[normalized];
  saveAutomationData(data);
  return true;
}

function installCommandMediaInterceptor(sock) {
  if (!sock?.sendMessage || mediaInterceptorSockets.has(sock)) return;
  mediaInterceptorSockets.add(sock);

  const originalSendMessage = sock.sendMessage.bind(sock);
  sock.sendMessage = async (jid, content, options) => {
    try {
      const context = commandContext.get(jid);
      const fresh = context && Date.now() - context.timestamp < 20000;
      const replaceable = content && (
        content.image
        || content.video
        || typeof content.text === 'string'
        || typeof content.caption === 'string'
      );

      if (fresh && replaceable) {
        const custom = resolveCommandMedia(context.command);
        if (custom?.path && fs.existsSync(custom.path)) {
          const nextContent = { ...content };
          const caption = String(content.caption ?? content.text ?? '');
          delete nextContent.text;
          delete nextContent.caption;
          delete nextContent.image;
          delete nextContent.video;

          const mediaBuffer = fs.readFileSync(custom.path);
          if (custom.type === 'image') {
            nextContent.image = mediaBuffer;
            nextContent.caption = caption;
            nextContent.mimetype = 'image/jpeg';
          } else {
            nextContent.video = mediaBuffer;
            nextContent.caption = caption;
            nextContent.gifPlayback = Boolean(custom.gifPlayback);
            nextContent.mimetype = custom.type === 'gif' ? 'image/gif' : 'video/mp4';
          }

          commandContext.delete(jid);
          return originalSendMessage(jid, nextContent, options);
        }
      }
    } catch (error) {
      console.error('[GYOMEI/MÍDIA] Falha ao aplicar mídia personalizada:', error.message);
    }
    return originalSendMessage(jid, content, options);
  };
}

export function prepareCommandMediaContext(sock, chatId, command) {
  const normalized = normalizeCommand(command);
  const ignored = new Set([
    'setmidia', 'delmidia', 'remmidia', 'menumidia', 'listmidias',
    'setmidia-profilep', 'setperfilpersona', 'changeperso', 'mudarpersona',
    'setprompt', 'verprompt', 'resetprompt', 'prompts', 'menuprompt',
    'adddono', 'deldono', 'listdonos'
  ]);
  if (!chatId || !normalized || ignored.has(normalized)) return;
  installCommandMediaInterceptor(sock);
  commandContext.set(chatId, { command: normalized, timestamp: Date.now() });
}

function recentKey(remoteJid, id) {
  return remoteJid && id ? `${remoteJid}_${id}` : '';
}

function extractDeleteKey(message) {
  return unwrapMessageContent(message)?.protocolMessage?.key || null;
}

function cacheIncomingMessage(message) {
  const remoteJids = [message?.key?.remoteJid, message?.key?.remoteJidAlt].filter(Boolean);
  const id = message?.key?.id;
  if (!id || !remoteJids.length || extractDeleteKey(message)) return;

  for (const remoteJid of remoteJids) recentMessages.set(recentKey(remoteJid, id), message);
  while (recentMessages.size > MAX_RECENT_MESSAGES) {
    const oldest = recentMessages.keys().next().value;
    if (!oldest) break;
    recentMessages.delete(oldest);
  }
}

function rememberDeleted(chatId, message) {
  if (!chatId || !message?.key?.id) return;
  const list = deletedMessages.get(chatId) || [];
  if (list.some(item => item?.key?.id === message.key.id)) return;
  list.unshift(message);
  deletedMessages.set(chatId, list.slice(0, 5));

  const serializable = {};
  for (const [jid, items] of deletedMessages.entries()) serializable[jid] = items.slice(0, 5);
  writeJson(DELETED_FILE, serializable);
}

function findCachedMessage(cacheGetter, key) {
  if (!key?.id) return null;
  const possibleChats = [key.remoteJid, key.remoteJidAlt].filter(Boolean);
  for (const chatId of possibleChats) {
    const internal = recentMessages.get(recentKey(chatId, key.id));
    if (internal) return internal;
  }

  const cache = typeof cacheGetter === 'function' ? cacheGetter() : cacheGetter;
  if (!cache) return null;
  for (const chatId of possibleChats) {
    const external = cache.get?.(recentKey(chatId, key.id));
    if (external) return external;
  }
  return null;
}

export function installDeletedMessageTracker(sock, cacheGetter) {
  if (!sock?.ev || deletedTrackerSockets.has(sock)) return;
  deletedTrackerSockets.add(sock);

  const persisted = readJson(DELETED_FILE, {});
  for (const [jid, items] of Object.entries(persisted)) {
    if (Array.isArray(items)) deletedMessages.set(jid, items.slice(0, 5));
  }

  const captureKey = key => {
    const original = findCachedMessage(cacheGetter, key);
    if (original) {
      const chatId = key.remoteJid || original.key?.remoteJid;
      if (chatId) rememberDeleted(chatId, original);
    }
  };

  sock.ev.on('messages.delete', event => {
    const keys = Array.isArray(event?.keys) ? event.keys : Array.isArray(event) ? event : [];
    keys.forEach(captureKey);
  });

  sock.ev.on('messages.update', updates => {
    if (!Array.isArray(updates)) return;
    for (const item of updates) {
      const key = extractDeleteKey(item?.update?.message || item?.message);
      if (key) captureKey(key);
    }
  });

  sock.ev.on('messages.upsert', event => {
    for (const message of event?.messages || []) {
      const deleteKey = extractDeleteKey(message);
      if (deleteKey) captureKey(deleteKey);
      else cacheIncomingMessage(message);
    }
  });
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function returnDeletedMessage(sock, chatId, position, quotedMessage) {
  const index = Number(position) - 1;
  if (!Number.isInteger(index) || index < 0 || index > 4) {
    return { ok: false, msg: 'Use return1 a return5 ou return 1 a return 5.' };
  }

  const original = (deletedMessages.get(chatId) || [])[index];
  if (!original?.message) {
    return { ok: false, msg: `Não há mensagem apagada na posição ${position}.` };
  }

  const content = unwrapMessageContent(original.message);
  const sender = original.key?.participant || original.key?.remoteJid;
  const prefix = sender
    ? `🗑️ *Mensagem apagada #${position}*\n👤 @${String(sender).split('@')[0]}\n\n`
    : `🗑️ *Mensagem apagada #${position}*\n\n`;
  const mentions = sender ? [sender] : [];
  const options = quotedMessage ? { quoted: quotedMessage } : undefined;

  try {
    const text = content?.conversation || content?.extendedTextMessage?.text;
    if (text) {
      await sock.sendMessage(chatId, { text: `${prefix}${text}`, mentions }, options);
      return { ok: true };
    }

    const candidates = [
      ['imageMessage', 'image'],
      ['videoMessage', 'video'],
      ['audioMessage', 'audio'],
      ['stickerMessage', 'sticker'],
      ['documentMessage', 'document']
    ];

    for (const [field, type] of candidates) {
      const media = content?.[field];
      if (!media) continue;
      const stream = await downloadContentFromMessage(media, type);
      const buffer = await streamToBuffer(stream);
      const caption = media.caption ? `${prefix}${media.caption}` : prefix.trim();
      const payload = { mentions };

      if (type === 'image') Object.assign(payload, { image: buffer, caption });
      if (type === 'video') Object.assign(payload, { video: buffer, caption, gifPlayback: media.gifPlayback === true });
      if (type === 'audio') Object.assign(payload, {
        audio: buffer,
        mimetype: media.mimetype || 'audio/ogg; codecs=opus',
        ptt: media.ptt === true
      });
      if (type === 'sticker') Object.assign(payload, { sticker: buffer });
      if (type === 'document') Object.assign(payload, {
        document: buffer,
        fileName: media.fileName || 'arquivo',
        mimetype: media.mimetype || 'application/octet-stream',
        caption
      });

      await sock.sendMessage(chatId, payload, options);
      return { ok: true };
    }

    await sock.sendMessage(chatId, { text: `${prefix}[Tipo de mensagem ainda não suportado]`, mentions }, options);
    return { ok: true };
  } catch (error) {
    return { ok: false, msg: `Não foi possível recuperar a mídia: ${error.message}` };
  }
}
