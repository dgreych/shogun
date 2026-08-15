/**
 * Kwai Download - Usando a Vex API
 */

import axios from 'axios';
import { mediaClient } from '../../utils/httpClient.js';
import { getConfig } from '../../utils/gyomeiStore.js';
import { socialDownloadWithBunnyFy } from '../../services/bunnyfy/capabilityGateway.js';

// Cache simples
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return item.val;
}

function setCache(key, val) {
  if (cache.size >= 1000) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { val, ts: Date.now() });
}

function getVexCredentials() {
  const config = getConfig();
  const site = String(config.site_vex || '').replace(/\/$/, '');
  const apikey = String(config.apikey_vex || '').trim();
  if (!site || !apikey || apikey.startsWith('COLOQUE_')) return null;
  return { site, apikey };
}

/**
 * Faz download de vídeo do Kwai
 * @param {string} url - URL do vídeo do Kwai
 * @returns {Promise<Object>} Dados do download
 */
async function dlComVex(url) {
  const credenciais = getVexCredentials();
  if (!credenciais) {
    return { ok: false, msg: 'Configure site_vex e apikey_vex em dados/src/config.json.' };
  }

  // O axios manda "Accept: application/json, text/plain, */*" por padrão, e
  // como isso contém "application/json", ainda aciona o bug do roteador da Vex
  // (devolve a documentação em vez do resultado). Precisa sobrescrever pra */*.
  const apiUrl = `${credenciais.site}/api/downloads/kwai?apikey=${encodeURIComponent(credenciais.apikey)}&query=${encodeURIComponent(url)}`;
  const response = await axios.get(apiUrl, {
    timeout: 60000,
    headers: { Accept: '*/*' }
  });

  const dados = response.data?.resposta || response.data?.resultado || response.data;
  const videoUrl = dados?.video || dados?.url;
  if (!videoUrl) {
    return { ok: false, msg: response.data?.message || response.data?.msg || 'Vídeo não encontrado' };
  }

  let videoBuffer = null;
  try {
    const mediaResponse = await mediaClient.get(videoUrl, { timeout: 120000 });
    videoBuffer = mediaResponse.data;
  } catch (downloadError) {
    console.error('Erro ao baixar vídeo do Kwai:', downloadError.message);
  }

  return {
    ok: true,
    criador: 'Hiudy',
    data: [{
      type: 'video',
      buff: videoBuffer,
      url: videoUrl,
      mime: 'video/mp4',
      metadata: {
        titulo: dados.titulo || dados.title,
        descricao: dados.descricao || 'Sem descrição',
        thumbnail: dados.thumbnail,
        duracao: dados.duracao,
        autor: {
          nome: dados.criador?.nome,
          usuario: dados.criador?.usuario
        }
      }
    }],
    count: 1
  };
}

async function dl(url) {
  try {
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return { ok: false, msg: 'URL inválida' };
    }

    const cached = getCached(`download:${url}`);
    if (cached) return { ok: true, ...cached, cached: true };

    const bunnyResult = await socialDownloadWithBunnyFy('kwai', url, {
      legacyFallback: () => dlComVex(url)
    });
    if (!bunnyResult.ok) return bunnyResult;

    let result;
    if (bunnyResult.source === 'bunnyfy') {
      let videoBuffer = null;
      try {
        const mediaResponse = await mediaClient.get(bunnyResult.mediaUrl, { timeout: 120000 });
        videoBuffer = mediaResponse.data;
      } catch (downloadError) {
        console.error('Erro ao baixar vídeo do Kwai (BunnyFy):', downloadError.message);
      }
      result = {
        criador: 'BunnyFy',
        data: [{
          type: 'video',
          buff: videoBuffer,
          url: bunnyResult.mediaUrl,
          mime: bunnyResult.mime || 'video/mp4',
          metadata: {
            titulo: bunnyResult.title,
            descricao: 'Sem descrição',
            thumbnail: bunnyResult.thumbnail,
            duracao: bunnyResult.durationSeconds
          }
        }],
        count: 1
      };
    } else {
      result = { criador: bunnyResult.criador, data: bunnyResult.data, count: bunnyResult.count };
    }

    setCache(`download:${url}`, result);

    return { ok: true, ...result };
  } catch (error) {
    console.error('Erro no download Kwai:', error.message);
    return { ok: false, msg: 'Erro ao baixar vídeo: ' + error.message };
  }
}

export {
  dl
};
