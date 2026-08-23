/**
 * Pinterest — busca e download.
 *
 * A busca passou a ser servida pela BunnyFy, que agrega Pinterest e Wallhaven.
 * Era a última capacidade além do YouTube ainda presa à Vex, e a fonte deixou
 * de responder: o comando devolvia "nenhuma imagem encontrada" para qualquer
 * termo. A Vex fica como fallback enquanto o modo não for exclusivo.
 */

import axios from 'axios';
import { getConfig } from '../../utils/shogunStore.js';
import { pinterestSearchWithBunnyFy, socialDownloadWithBunnyFy } from '../../services/bunnyfy/capabilityGateway.js';

// Cache simples
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

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

// Validador de URL
const PIN_REGEX = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)?pinterest\.\w{2,6}(?:\.\w{2})?\/pin\/\d+|https?:\/\/pin\.it\/[a-zA-Z0-9]+/;

function isValidPinURL(url) {
  return PIN_REGEX.test(url);
}

/**
 * Pesquisa imagens no Pinterest
 * @param {string} query - Termo de pesquisa
 * @returns {Promise<Object>} Resultados da pesquisa
 */
async function searchComVex(query) {
  try {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return { ok: false, msg: 'Termo de pesquisa inválido' };
    }

    const cached = getCached(`search:${query.toLowerCase()}`);
    if (cached) return { ok: true, ...cached, cached: true };

    const credenciais = getVexCredentials();
    if (!credenciais) {
      return { ok: false, msg: 'Configure site_vex e apikey_vex em dados/src/config.json.' };
    }

    // O axios manda "Accept: application/json, text/plain, */*" por padrão, e
    // como isso contém "application/json", ainda aciona o bug do roteador da Vex
    // (devolve a documentação em vez do resultado). Precisa sobrescrever pra */*.
    const apiUrl = `${credenciais.site}/api/search/pinterest?apikey=${encodeURIComponent(credenciais.apikey)}&query=${encodeURIComponent(query)}`;
    const response = await axios.get(apiUrl, {
      timeout: 60000,
      headers: { Accept: '*/*' }
    });

    const dados = response.data?.resposta || response.data?.resultado || response.data;
    const items = dados?.results || dados;
    const images = Array.isArray(items) ? items.map(item => item.directLink || item.url).filter(Boolean) : [];

    if (images.length === 0) {
      return { ok: false, msg: 'Nenhuma imagem encontrada' };
    }

    const result = {
      criador: 'shogun',
      type: 'image',
      mime: 'image/jpeg',
      query,
      count: images.length,
      urls: images.slice(0, 50)
    };

    setCache(`search:${query.toLowerCase()}`, result);

    return { ok: true, ...result };
  } catch (error) {
    console.error('Erro na pesquisa Pinterest:', error.message);
    return { ok: false, msg: 'Erro ao buscar imagens no Pinterest' };
  }
}

/**
 * Busca por assunto. A BunnyFy devolve as mídias já baixadas e assinadas, com
 * o tipo real de cada uma — é isso que preserva GIF como GIF, coisa que o
 * caminho antigo não fazia por fixar image/jpeg para tudo.
 */
async function search(query) {
  const termo = String(query || '').trim();
  if (!termo) return { ok: false, msg: 'Termo de pesquisa inválido' };

  const cached = getCached(`search:${termo.toLowerCase()}`);
  if (cached) return { ok: true, ...cached, cached: true };

  try {
    const resultado = await pinterestSearchWithBunnyFy(termo, {
      legacyFallback: async () => searchComVex(termo)
    });

    // legacyFallback devolve o formato antigo já pronto; só o caminho BunnyFy
    // precisa ser convertido.
    if (!resultado || resultado.source !== 'bunnyfy') return resultado ?? searchComVex(termo);

    const midias = (resultado.results || [])
      .map((item) => ({ url: item.mediaUrl, mime: item.mime, title: item.title ?? null }))
      .filter((item) => item.url);
    if (midias.length === 0) return { ok: false, msg: 'Nenhuma imagem encontrada' };

    const saida = {
      criador: 'shogun',
      type: 'image',
      mime: midias[0].mime || 'image/jpeg',
      query: termo,
      count: midias.length,
      urls: midias.map((m) => m.url),
      medias: midias
    };
    setCache(`search:${termo.toLowerCase()}`, saida);
    return { ok: true, ...saida };
  } catch (error) {
    console.error('Erro na pesquisa Pinterest:', error.message);
    return searchComVex(termo);
  }
}

async function dlComVex(url) {
  const credenciais = getVexCredentials();
  if (!credenciais) {
    return { ok: false, msg: 'Configure site_vex e apikey_vex em dados/src/config.json.' };
  }

  const buscarMidia = async (endpoint) => {
    try {
      const apiUrl = `${credenciais.site}/api/downloads/${endpoint}?apikey=${encodeURIComponent(credenciais.apikey)}&query=${encodeURIComponent(url)}`;
      const response = await axios.get(apiUrl, { timeout: 60000, headers: { Accept: '*/*' } });
      const dados = response.data?.resposta || response.data?.resultado || response.data;
      return Array.isArray(dados?.medias) ? dados.medias : [];
    } catch {
      return [];
    }
  };

  let medias = await buscarMidia('pinterestmp4');
  let type = 'video';
  if (medias.length === 0) {
    medias = await buscarMidia('pinterestimg');
    type = 'image';
  }

  const mediaUrls = medias.map(m => m.url).filter(Boolean);
  if (mediaUrls.length === 0) {
    return { ok: false, msg: 'O pin não contém mídia disponível para download' };
  }

  return {
    ok: true,
    criador: 'shogun',
    type,
    mime: type === 'video' ? 'video/mp4' : 'image/jpeg',
    title: 'Pin do Pinterest',
    urls: mediaUrls
  };
}

/**
 * Faz download de um pin do Pinterest (imagem ou vídeo)
 * @param {string} url - URL do pin
 * @returns {Promise<Object>} Dados do download
 */
async function dl(url) {
  try {
    if (!isValidPinURL(url)) {
      return { ok: false, msg: 'URL inválida. Certifique-se de que é um link válido do Pinterest' };
    }

    const cached = getCached(`download:${url}`);
    if (cached) return { ok: true, ...cached, cached: true };

    // A BunnyFy só cobre vídeo (via yt-dlp); pin de imagem faz a chamada
    // falhar com um erro transitório (503) e o modo 'primary' já cai
    // automaticamente no fallback da Vex, que cobre os dois casos.
    const bunnyResult = await socialDownloadWithBunnyFy('pinterest', url, {
      legacyFallback: () => dlComVex(url)
    });
    if (!bunnyResult.ok) return bunnyResult;

    const result = bunnyResult.source === 'bunnyfy'
      ? {
        criador: 'BunnyFy',
        type: 'video',
        mime: bunnyResult.mime || 'video/mp4',
        title: bunnyResult.title || 'Pin do Pinterest',
        urls: [bunnyResult.mediaUrl]
      }
      : {
        criador: bunnyResult.criador,
        type: bunnyResult.type,
        mime: bunnyResult.mime,
        title: bunnyResult.title,
        urls: bunnyResult.urls
      };

    setCache(`download:${url}`, result);

    return { ok: true, ...result };
  } catch (error) {
    console.error('Erro no download Pinterest:', error.message);
    return { ok: false, msg: 'Erro ao baixar o conteúdo do Pinterest' };
  }
}

export {
  search,
  dl
};
