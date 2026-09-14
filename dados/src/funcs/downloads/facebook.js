/**
 * Facebook Download - Usando a serviço legado API
 */

import { mediaClient } from '../../utils/httpClient.js';
import { socialDownloadWithBunnyFy } from '../../services/bunnyfy/capabilityGateway.js';



/**
 * Faz download de vídeo do Facebook em HD
 * @param {string} url - URL do vídeo do Facebook
 * @returns {Promise<Object>} Dados do download
 */
async function downloadHD(url) {
  try {
    const bunnyResult = await socialDownloadWithBunnyFy('facebook', url);
    if (!bunnyResult.ok) return bunnyResult;
    console.log(`[Facebook] Baixando via BunnyFy: ${bunnyResult.mediaUrl}`);
    const videoResponse = await mediaClient.get(bunnyResult.mediaUrl, {
      timeout: 180000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    return {
      ok: true,
      buffer: Buffer.from(videoResponse.data),
      resolution: 'BunnyFy',
      thumbnail: bunnyResult.thumbnail,
      allQualities: [],
      filename: `facebook_video_bunnyfy.mp4`
    };
  } catch (error) {
    console.error('Erro no download do Facebook:', error.message);

    if (error.response?.status === 404) {
      return { ok: false, msg: 'Vídeo não encontrado ou não está disponível' };
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return { ok: false, msg: 'Timeout ao baixar o vídeo. O arquivo pode ser muito grande.' };
    }

    return { ok: false, msg: error.message || 'Erro ao baixar do Facebook' };
  }
}

export default {
  downloadHD
};
