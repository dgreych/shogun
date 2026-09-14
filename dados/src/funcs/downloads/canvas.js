/** Cards próprios da BunnyFy, com fallback temporário durante a migração. */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureNonWebpImage } from '../../utils/mediaFormat.js';
import { resolveCapabilityMode, welcomeCardWithBunnyFy } from '../../services/bunnyfy/capabilityGateway.js';


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
 * Gera o card de boas-vindas/despedida via serviço legado e devolve o buffer pronto pra
 * enviar como mensagem de imagem no WhatsApp (nunca em WebP).
 */
async function gerarWelcomeCardLegado() {
  return { ok: false, code: 'BUNNYFY_DISABLED', msg: 'Os cards automáticos requerem BunnyFy configurada nesta instância.' };
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
