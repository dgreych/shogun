/**
 * TikTok Download - BunnyFy com fallback para a Vex API
 */

import axios from 'axios';
import { getConfig } from '../../utils/gyomeiStore.js';
import { socialDownloadWithBunnyFy } from '../../services/bunnyfy/capabilityGateway.js';

function getVexCredentials() {
  const config = getConfig();
  const site = String(config.site_vex || '').replace(/\/$/, '');
  const apikey = String(config.apikey_vex || '').trim();
  if (!site || !apikey || apikey.startsWith('COLOQUE_')) return null;
  return { site, apikey };
}

async function dlComVex(url) {
  const credenciais = getVexCredentials();
  if (!credenciais) {
    return { ok: false, msg: 'Configure site_vex e apikey_vex em dados/src/config.json.' };
  }

  // O axios manda "Accept: application/json, text/plain, */*" por padrão, e
  // como isso contém "application/json", ainda aciona o bug do roteador da Vex
  // (devolve a documentação em vez do resultado). Precisa sobrescrever pra */*.
  const apiUrl = `${credenciais.site}/api/downloads/tiktok?apikey=${encodeURIComponent(credenciais.apikey)}&query=${encodeURIComponent(url)}`;
  const response = await axios.get(apiUrl, {
    timeout: 120000,
    headers: { Accept: '*/*' }
  });

  const dados = response.data?.resposta || response.data?.resultado || response.data?.result || response.data;
  const video = dados?.video || dados;
  const playUrl = video?.video?.playAddr?.[0] || video?.playAddr?.[0] || video?.play || video?.url;

  if (!playUrl) {
    return { ok: false, msg: response.data?.message || response.data?.msg || 'Não foi possível obter dados do vídeo' };
  }

  return {
    ok: true,
    criador: 'Hiudy',
    type: 'video',
    mime: 'video/mp4',
    urls: [playUrl],
    title: video?.desc || dados?.title || '',
    audio: video?.music?.playUrl?.[0] || video?.musicMeta?.playUrl?.[0]
  };
}

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

    const result = await socialDownloadWithBunnyFy('tiktok', url, {
      legacyFallback: () => dlComVex(url)
    });
    if (!result.ok) return result;
    if (result.source !== 'bunnyfy') return result;

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
