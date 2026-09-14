/**
 * Pinterest — busca e download.
 *
 * A busca passou a ser servida pela BunnyFy, que agrega Pinterest e Wallhaven.
 * Era a última capacidade além do YouTube ainda presa à serviço legado, e a fonte deixou
 * de responder: o comando devolvia "nenhuma imagem encontrada" para qualquer
 * termo. A serviço legado fica como fallback enquanto o modo não for exclusivo.
 */

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
    const resultado = await pinterestSearchWithBunnyFy(termo);

    // legacyFallback devolve o formato antigo já pronto; só o caminho BunnyFy
    // precisa ser convertido.
    if (!resultado?.ok) return resultado || { ok: false, msg: 'A busca do Pinterest requer BunnyFy configurada.' };

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
    return { ok: false, msg: 'Erro ao buscar imagens no Pinterest' };
  }
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
    // automaticamente no fallback da serviço legado, que cobre os dois casos.
    const bunnyResult = await socialDownloadWithBunnyFy('pinterest', url);
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
