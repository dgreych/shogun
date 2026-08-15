/**
 * Facebook Download - Usando a Vex API
 */

import axios from 'axios';
import { mediaClient } from '../../utils/httpClient.js';
import { getConfig } from '../../utils/gyomeiStore.js';
import { socialDownloadWithBunnyFy } from '../../services/bunnyfy/capabilityGateway.js';

function getVexCredentials() {
  const config = getConfig();
  const site = String(config.site_vex || '').replace(/\/$/, '');
  const apikey = String(config.apikey_vex || '').trim();
  if (!site || !apikey || apikey.startsWith('COLOQUE_')) return null;
  return { site, apikey };
}

async function downloadHDComVex(url) {
  const credenciais = getVexCredentials();
  if (!credenciais) {
    return { ok: false, msg: 'Configure site_vex e apikey_vex em dados/src/config.json.' };
  }

  // O axios manda "Accept: application/json, text/plain, */*" por padrão, e
  // como isso contém "application/json", ainda aciona o bug do roteador da Vex
  // (devolve a documentação em vez do resultado). Precisa sobrescrever pra */*.
  const apiUrl = `${credenciais.site}/api/downloads/facebook?apikey=${encodeURIComponent(credenciais.apikey)}&query=${encodeURIComponent(url)}`;
  const response = await axios.get(apiUrl, {
    timeout: 120000,
    headers: { Accept: '*/*' }
  });

  const dados = response.data?.resposta || response.data?.resultado || response.data;
  if (!dados || dados.error) {
    return { ok: false, msg: dados?.error || response.data?.message || 'Erro ao processar download do Facebook' };
  }

  const medias = Array.isArray(dados.medias) ? dados.medias : [];
  const priorities = ['1080p', '720p', '480p', '360p'];
  let selecionada = null;
  for (const qualidade of priorities) {
    selecionada = medias.find(m => String(m.quality || '').includes(qualidade));
    if (selecionada) break;
  }
  if (!selecionada) selecionada = medias[0] || (dados.url ? { quality: 'padrão', url: dados.url } : null);

  if (!selecionada?.url) {
    return { ok: false, msg: 'Vídeo não disponível para download direto.' };
  }

  console.log(`[Facebook] Baixando de: ${selecionada.url}`);
  console.log(`[Facebook] Qualidade: ${selecionada.quality}`);

  const videoResponse = await mediaClient.get(selecionada.url, {
    timeout: 180000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  return {
    ok: true,
    buffer: Buffer.from(videoResponse.data),
    resolution: selecionada.quality,
    thumbnail: dados.thumbnail,
    allQualities: medias,
    filename: `facebook_video_${selecionada.quality || 'padrao'}.${selecionada.extension || 'mp4'}`
  };
}

/**
 * Faz download de vídeo do Facebook em HD
 * @param {string} url - URL do vídeo do Facebook
 * @returns {Promise<Object>} Dados do download
 */
async function downloadHD(url) {
  try {
    const bunnyResult = await socialDownloadWithBunnyFy('facebook', url, {
      legacyFallback: () => downloadHDComVex(url)
    });
    if (!bunnyResult.ok) return bunnyResult;
    if (bunnyResult.source !== 'bunnyfy') return bunnyResult;

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
