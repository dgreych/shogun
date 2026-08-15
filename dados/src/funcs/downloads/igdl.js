/**
 * Instagram Download - Usando instância própria da Nodz (a Vex não cobre Instagram)
 */

import axios from 'axios';
import { mediaClient } from '../../utils/httpClient.js';
import { getConfig } from '../../utils/gyomeiStore.js';

const BASE_URL_PADRAO = 'http://node1.vexhost.com.br:20018';

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

function getNodzBase() {
  const config = getConfig();
  return String(config.site_nodz || BASE_URL_PADRAO).replace(/\/$/, '');
}

/**
 * Faz download de post do Instagram
 * @param {string} url - URL do post do Instagram
 * @returns {Promise<Object>} Dados do download
 */
async function dl(url) {
  try {
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return { ok: false, msg: 'URL inválida' };
    }

    const cached = getCached(`download:${url}`);
    if (cached) return { ok: true, ...cached, cached: true };

    // O axios manda "Accept: application/json, text/plain, */*" por padrão; alguns
    // roteadores no estilo Nodz/Vex tratam isso como pedido de documentação em vez
    // do resultado real. Sobrescrever pra */* evita esse problema.
    const apiUrl = `${getNodzBase()}/api/downloads/instagram?url=${encodeURIComponent(url)}`;
    const response = await axios.get(apiUrl, { timeout: 120000, headers: { Accept: '*/*' } });

    if (!response.data?.success) {
      return { ok: false, msg: response.data?.resultado?.error || response.data?.message || 'Não foi possível processar o Instagram' };
    }

    const resultado = response.data.resultado;
    const itens = Array.isArray(resultado) ? resultado
      : Array.isArray(resultado?.midias) ? resultado.midias
      : Array.isArray(resultado?.data) ? resultado.data
      : Array.isArray(resultado?.medias) ? resultado.medias
      : resultado?.url ? [resultado]
      : [];

    if (itens.length === 0) {
      return { ok: false, msg: resultado?.error || 'Postagem não encontrada' };
    }

    const results = [];
    const uniqueUrls = new Set();

    for (const item of itens) {
      const mediaUrl = item.url || item.link || item.download_url;
      if (!mediaUrl || uniqueUrls.has(mediaUrl)) continue;
      uniqueUrls.add(mediaUrl);

      try {
        const headResponse = await axios.head(mediaUrl, { timeout: 30000 });
        const contentType = headResponse.headers['content-type'] || '';

        const mediaResponse = await mediaClient.get(mediaUrl, { timeout: 120000 });

        results.push({
          type: (item.tipo || item.type || contentType).toString().includes('image') ? 'image' : 'video',
          buff: mediaResponse.data,
          url: mediaUrl,
          mime: contentType || 'application/octet-stream'
        });
      } catch (downloadError) {
        console.error('Erro ao baixar mídia do Instagram:', downloadError.message);
      }
    }

    if (results.length === 0) {
      return { ok: false, msg: 'Nenhuma mídia foi baixada com sucesso' };
    }

    const result = {
      criador: 'Hiudy',
      data: results,
      count: results.length
    };

    setCache(`download:${url}`, result);

    return { ok: true, ...result };
  } catch (error) {
    console.error('Erro no download Instagram:', error.message);
    return { ok: false, msg: 'Erro ao baixar post: ' + error.message };
  }
}

export {
  dl
};
