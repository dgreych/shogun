/** Cards próprios da BunnyFy, com fallback temporário durante a migração. */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from '../../utils/gyomeiStore.js';
import { ensureNonWebpImage } from '../../utils/mediaFormat.js';
import { resolveCapabilityMode, welcomeCardWithBunnyFy } from '../../services/bunnyfy/capabilityGateway.js';

function getVexCredentials() {
  const config = getConfig();
  const site = String(config.site_vex || '').replace(/\/$/, '');
  const apikey = String(config.apikey_vex || '').trim();
  if (!site || !apikey || apikey.startsWith('COLOQUE_')) return null;
  return { site, apikey };
}

function logDiagnostico(entry) {
  try {
    fs.appendFileSync(
      path.dirname(fileURLToPath(import.meta.url)) + '/../../../logs/debug-trigger.log',
      JSON.stringify({ ts: new Date().toISOString(), marca: 'WELCOME_CARD', ...entry }) + '\n'
    );
  } catch {}
}

async function downloadVisual(url, label) {
  if (!url) return null;
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 15_000,
    maxRedirects: 3,
    maxContentLength: 5 * 1024 * 1024,
    maxBodyLength: 5 * 1024 * 1024,
    headers: { Accept: 'image/*' }
  });
  const mime = String(response.headers?.['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
  const buffer = Buffer.from(response.data || []);
  if (!mime.startsWith('image/') || buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
    throw new Error(`${label}_INVALID`);
  }
  return { buffer, mime };
}

/**
 * Gera o card de boas-vindas/despedida via Vex e devolve o buffer pronto pra
 * enviar como mensagem de imagem no WhatsApp (nunca em WebP).
 */
async function gerarWelcomeCardLegado(avatar, nome, texto, fundo, corMoldura, corLinhas, glow = false) {
  const credenciais = getVexCredentials();
  if (!credenciais) {
    return { ok: false, msg: 'Configure site_vex e apikey_vex em dados/src/config.json.' };
  }
  if (!avatar || !nome) {
    return { ok: false, msg: 'Avatar e nome são obrigatórios para o card.' };
  }

  const url = `${credenciais.site}/api/canvas/welcome2?apikey=${encodeURIComponent(credenciais.apikey)}` +
    `&avatar=${encodeURIComponent(avatar)}` +
    `&nome=${encodeURIComponent(nome)}` +
    `&texto=${encodeURIComponent(texto || '')}` +
    `&fundo=${encodeURIComponent(fundo || '')}` +
    `&corMoldura=${encodeURIComponent(corMoldura || '')}` +
    `&corLinhas=${encodeURIComponent(corLinhas || '')}` +
    `&glow=${glow ? 'true' : 'false'}`;

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: { Accept: '*/*' }
    });

    const bytes = response.data ? response.data.byteLength : 0;
    const contentType = response.headers?.['content-type'] || '';

    if (!bytes || bytes < 1000) {
      logDiagnostico({ ok: false, capability: 'welcomeCard', bytes, contentType });
      const textoErro = bytes ? Buffer.from(response.data).toString('utf8').slice(0, 300) : '';
      return { ok: false, msg: `A Vex não retornou uma imagem válida para o card${textoErro ? `: ${textoErro}` : '.'}` };
    }

    const { buffer, mime } = await ensureNonWebpImage(Buffer.from(response.data), contentType);
    logDiagnostico({ ok: true, capability: 'welcomeCard', bytesOriginais: bytes, contentTypeOriginal: contentType, mimeFinal: mime, bytesFinais: buffer.length });

    return { ok: true, criador: 'Tokyo', type: 'image', mime, buffer };
  } catch (error) {
    logDiagnostico({ ok: false, capability: 'welcomeCard', code: error?.code || 'LEGACY_CANVAS_FAILED' });
    return { ok: false, msg: 'Não foi possível gerar o card agora.' };
  }
}

/**
 * Gera o card pelo contrato próprio da BunnyFy. O fluxo anterior permanece
 * disponível somente quando o modo da capacidade está off/primary.
 */
export async function gerarWelcomeCard(
  avatar,
  nome,
  texto,
  fundo,
  corMoldura,
  corLinhas,
  glow = false,
  context = {}
) {
  const payload = {
    event: context.event === 'leave' ? 'leave' : 'join',
    name: String(nome || 'Membro').trim().slice(0, 48) || 'Membro',
    groupName: String(context.groupName || 'Grupo').trim().slice(0, 72) || 'Grupo',
    memberCount: Math.max(0, Math.min(10_000_000, Math.floor(Number(context.memberCount) || 0))),
    headline: String(texto || '').trim().slice(0, 72),
    theme: 'obsidian'
  };

  try {
    const bunnyFyCanvasEnabled = resolveCapabilityMode('BUNNYFY_CANVAS_MODE') !== 'off';
    const [avatarVisual, backgroundVisual] = bunnyFyCanvasEnabled ? await Promise.all([
      downloadVisual(avatar, 'AVATAR').catch(error => {
        logDiagnostico({ ok: false, capability: 'welcomeAvatar', code: error?.message || 'AVATAR_DOWNLOAD_FAILED' });
        return null;
      }),
      downloadVisual(fundo, 'BACKGROUND').catch(error => {
        logDiagnostico({ ok: false, capability: 'welcomeBackground', code: error?.message || 'BACKGROUND_DOWNLOAD_FAILED' });
        return null;
      })
    ]) : [null, null];
    return await welcomeCardWithBunnyFy(payload, {
      avatarBuffer: avatarVisual?.buffer,
      avatarMime: avatarVisual?.mime,
      backgroundBuffer: backgroundVisual?.buffer,
      backgroundMime: backgroundVisual?.mime,
      legacyFallback: () => gerarWelcomeCardLegado(
        avatar,
        nome,
        texto,
        fundo,
        corMoldura,
        corLinhas,
        glow
      )
    });
  } catch (error) {
    logDiagnostico({ ok: false, capability: 'welcomeCard', code: error?.code || 'CANVAS_FAILED' });
    return { ok: false, msg: 'Não foi possível gerar o card agora.' };
  }
}
