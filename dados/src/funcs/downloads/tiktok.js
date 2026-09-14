/**
 * TikTok Download - BunnyFy com fallback para a serviço legado API
 */

import { socialDownloadWithBunnyFy } from '../../services/bunnyfy/capabilityGateway.js';



/**
 * Faz download de vídeo do TikTok
 * @param {string} url - URL do vídeo do TikTok
 * @returns {Promise<Object>} Dados do download
 */
async function dl(url) {
  try {
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return { ok: false, msg: 'URL inválida' };
    }

    const result = await socialDownloadWithBunnyFy('tiktok', url);
    if (!result.ok) return result;
    return {
      ok: true,
      criador: 'BunnyFy',
      type: 'video',
      mime: result.mime || 'video/mp4',
      urls: [result.mediaUrl],
      title: result.title || ''
    };
  } catch (error) {
    console.error('Erro no download TikTok:', error.message);
    return { ok: false, msg: 'Erro ao baixar vídeo: ' + error.message };
  }
}

/**
 * Pesquisa vídeos no TikTok
 * @param {string} query - Termo de pesquisa
 * @returns {Promise<Object>} Resultados da pesquisa
 */
async function search(query) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return { ok: false, msg: 'Termo de pesquisa inválido' };
  }
  return { ok: false, msg: 'Pesquisa de TikTok por termo ainda não disponível nesta versão. Envie o link direto do vídeo.' };
}

export {
  search,
  dl
};
