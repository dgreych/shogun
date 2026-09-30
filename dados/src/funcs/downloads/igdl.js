import { instagramDownloadWithBunnyFy } from '../../services/bunnyfy/capabilityGateway.js';

// A sessão fica na BunnyFy; nenhuma conta precisa entrar no bot.
export async function dl(url) {
  try {
    if (typeof url !== 'string' || !url.trim()) return { ok: false, msg: 'Envie o link de um post, reel ou story do Instagram.' };
    const result = await instagramDownloadWithBunnyFy(url.trim());
    return result || { ok: false, msg: 'O download do Instagram está desativado nesta instância.' };
  } catch (error) {
    return { ok: false, msg: error.code?.startsWith('BUNNYFY_') ? error.message : 'Não consegui baixar esse post agora. Tente novamente em instantes.' };
  }
}
