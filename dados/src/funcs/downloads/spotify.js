/**
 * Spotify Download - Spotify tem DRM, não existe "baixar direto" do jeito que os
 * outros provedores baixam. A estratégia aqui é: ler os metadados públicos da
 * faixa (título/artista) direto da página do Spotify (oEmbed + meta tags, sem
 * precisar de credencial), montar uma busca por texto e baixar o equivalente
 * no YouTube usando a mesma infraestrutura que já atende `play`/`ytmp3`
 * (BunnyFy como fonte primária, Vex/yt-search como fallback). Só cai no
 * download direto via Vex se essa resolução via YouTube falhar por completo.
 */

import axios from 'axios';
import { getConfig } from '../../utils/gyomeiStore.js';
import { downloadYoutubeAudioForPlay } from '../../services/bunnyfy/youtubeGateway.js';
import { legacyYoutubeAdapter } from './youtube.js';

const SEARCH_BASE_URL = 'https://api.vreden.my.id';
const OEMBED_URL = 'https://open.spotify.com/oembed';
const METADATA_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36';

// Cache simples
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

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
  if (cache.size >= 500) {
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
 * Valida se é uma URL válida do Spotify
 */
function isValidSpotifyUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes('open.spotify.com/') || url.includes('spotify.com/');
}

/**
 * Busca músicas no Spotify
 * @param {string} query - Nome da música ou artista
 * @returns {Promise<Object>} Resultados da busca
 */
async function search(query) {
  if (!query || typeof query !== 'string') {
    return { ok: false, msg: 'Query inválida' };
  }
  return { ok: false, msg: 'Busca de música por nome está indisponível no momento (o serviço usado pra isso saiu do ar). Envie o link direto da música no Spotify.' };
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractSpotifyTrackId(url) {
  const match = /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]{10,30})/.exec(String(url || ''));
  return match ? match[1] : null;
}

/**
 * Lê título/artista/capa de uma faixa pública do Spotify sem precisar de
 * credencial: oEmbed oficial (título + capa) e as meta tags Open Graph da
 * própria página (artista, via `music:musician_description`).
 * @param {string} url - URL do track do Spotify
 * @returns {Promise<{trackId:string,canonicalUrl:string,title:string,artist:string,thumbnail:?string,year:?string}|null>}
 */
async function resolveSpotifyTrackMetadata(url) {
  const trackId = extractSpotifyTrackId(url);
  if (!trackId) return null;
  const canonicalUrl = `https://open.spotify.com/track/${trackId}`;

  const [oembedResult, pageResult] = await Promise.allSettled([
    axios.get(OEMBED_URL, { params: { url: canonicalUrl }, timeout: 15000, headers: { Accept: 'application/json' } }),
    axios.get(canonicalUrl, { timeout: 15000, headers: { 'User-Agent': METADATA_USER_AGENT, Accept: 'text/html' } })
  ]);

  const oembed = oembedResult.status === 'fulfilled' ? oembedResult.value.data : null;
  const html = pageResult.status === 'fulfilled' ? String(pageResult.value.data || '') : '';

  const ogTitleMatch = /<meta property="og:title" content="([^"]*)"/.exec(html);
  const title = (typeof oembed?.title === 'string' && oembed.title.trim())
    ? oembed.title.trim()
    : (ogTitleMatch?.[1] || '').trim();
  if (!title) return null;

  const musicianMatch = /<meta name="music:musician_description" content="([^"]*)"/.exec(html);
  const descriptionMatch = /<meta property="og:description" content="([^"]*)"/.exec(html);
  const artist = (musicianMatch?.[1] || descriptionMatch?.[1]?.split('·')[0] || '').trim();
  const yearMatch = descriptionMatch?.[1]?.match(/(\d{4})\s*$/);
  const ogImageMatch = /<meta property="og:image" content="([^"]*)"/.exec(html);

  return {
    trackId,
    canonicalUrl,
    title: decodeHtmlEntities(title),
    artist: decodeHtmlEntities(artist),
    thumbnail: (typeof oembed?.thumbnail_url === 'string' && oembed.thumbnail_url) || ogImageMatch?.[1] || null,
    year: yearMatch ? yearMatch[1] : null
  };
}

/**
 * Busca por texto no YouTube (via BunnyFy, com fallback já embutido no
 * gateway) e devolve o áudio baixado no formato interno usado aqui.
 * @param {string} query - texto de busca (ex.: "Artista - Título")
 */
async function downloadViaYoutubeSearch(query) {
  const result = await downloadYoutubeAudioForPlay(query, { legacyYoutube: legacyYoutubeAdapter });
  if (!result?.ok || !Buffer.isBuffer(result.buffer)) {
    return { ok: false, msg: result?.msg || 'Não foi possível encontrar essa música para download.' };
  }
  return {
    ok: true,
    buffer: result.buffer,
    resolvedTitle: result.title,
    thumbnail: result.thumbnail,
    durationSeconds: result.durationSeconds,
    source: result.source
  };
}

/**
 * Faz o download direto via Vex, como último recurso quando a resolução via
 * YouTube falha por completo (comportamento legado preservado).
 * @param {string} url - URL do track do Spotify
 */
async function downloadViaVex(url) {
  try {
    const credenciais = getVexCredentials();
    if (!credenciais) {
      return { ok: false, msg: 'Configure site_vex e apikey_vex em dados/src/config.json.' };
    }

    // O axios manda "Accept: application/json, text/plain, */*" por padrão, e
    // como isso contém "application/json", ainda aciona o bug do roteador da Vex
    // (devolve a documentação em vez do resultado). Precisa sobrescrever pra */*.
    const apiUrl = `${credenciais.site}/api/downloads/spotify?apikey=${encodeURIComponent(credenciais.apikey)}&query=${encodeURIComponent(url)}`;
    const response = await axios.get(apiUrl, {
      timeout: 120000,
      headers: { Accept: '*/*' }
    });

    const resposta = response.data?.resposta || response.data?.resultado || response.data;
    const track = resposta?.data?.track || resposta?.data || resposta?.track;
    const dlurl = resposta?.download || resposta?.dlurl;

    if (!track || !dlurl) {
      return { ok: false, msg: response.data?.message || response.data?.msg || 'Informações da música não encontradas' };
    }

    const audioResponse = await axios.get(dlurl, {
      responseType: 'arraybuffer',
      timeout: 120000
    });

    const artists = Array.isArray(track.artists) ? track.artists : [track.artists].filter(Boolean);

    return {
      ok: true,
      buffer: Buffer.from(audioResponse.data),
      title: track.name,
      artists,
      albumImage: track.album?.images?.[0]?.url,
      year: track.release_date?.split?.('-')?.[0],
      duration: track.duration_ms,
      filename: `${artists.join(', ') || 'Spotify'} - ${track.name || 'audio'}.mp3`,
      source: 'vex'
    };
  } catch (error) {
    console.error('Erro no download do Spotify (Vex):', error.message);

    if (error.response?.status === 404) {
      return { ok: false, msg: 'Música não encontrada no Spotify' };
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return { ok: false, msg: 'Timeout ao baixar a música. Tente novamente.' };
    }

    return { ok: false, msg: error.message || 'Erro ao baixar do Spotify' };
  }
}

/**
 * Faz download de uma música do Spotify via URL: resolve os metadados
 * públicos da faixa, baixa o equivalente no YouTube (BunnyFy/Vex) e só cai
 * no download direto via Vex se essa resolução falhar por completo.
 * @param {string} url - URL do track do Spotify
 * @returns {Promise<Object>} Dados do download
 */
async function download(url) {
  if (!isValidSpotifyUrl(url)) {
    return { ok: false, msg: 'URL inválida do Spotify. Certifique-se de usar uma URL do Spotify válida.' };
  }

  const cached = getCached(`download:${url}`);
  if (cached) return cached;

  try {
    const metadata = await resolveSpotifyTrackMetadata(url);
    if (metadata) {
      const query = metadata.artist ? `${metadata.artist} - ${metadata.title}` : metadata.title;
      const viaYoutube = await downloadViaYoutubeSearch(query);
      if (viaYoutube.ok) {
        const artists = metadata.artist ? [metadata.artist] : [];
        const result = {
          ok: true,
          buffer: viaYoutube.buffer,
          title: metadata.title,
          artists,
          albumImage: metadata.thumbnail,
          year: metadata.year,
          duration: viaYoutube.durationSeconds ? viaYoutube.durationSeconds * 1000 : undefined,
          filename: `${metadata.artist || 'Spotify'} - ${metadata.title}.mp3`,
          source: viaYoutube.source
        };
        setCache(`download:${url}`, result);
        return result;
      }
    }
  } catch (error) {
    console.error('[Spotify] Falha ao resolver faixa via YouTube:', error.message);
  }

  return downloadViaVex(url);
}

/**
 * Busca uma música por texto livre (nome/artista) direto no YouTube e baixa
 * o áudio — usado quando não há um link do Spotify, só um nome de música.
 * @param {string} query - nome da música/artista
 */
async function downloadByFreeTextQuery(query) {
  if (!query || typeof query !== 'string') {
    return { ok: false, msg: 'Query inválida' };
  }
  const viaYoutube = await downloadViaYoutubeSearch(query);
  if (!viaYoutube.ok) return viaYoutube;

  return {
    ok: true,
    buffer: viaYoutube.buffer,
    title: viaYoutube.resolvedTitle || query,
    artists: [],
    albumImage: viaYoutube.thumbnail,
    duration: viaYoutube.durationSeconds ? viaYoutube.durationSeconds * 1000 : undefined,
    filename: `${viaYoutube.resolvedTitle || query}.mp3`,
    source: viaYoutube.source
  };
}

/**
 * Busca e faz download de uma música do Spotify
 * @param {string} query - Nome da música ou artista
 * @returns {Promise<Object>} Dados da busca e download
 */
async function searchDownload(query) {
  try {
    const searchResult = await search(query);

    if (!searchResult.ok || !searchResult.results?.length) {
      return { ok: false, msg: 'Nenhuma música encontrada com esse nome' };
    }

    const track = searchResult.results[0];

    if (!track.song_link) {
      return { ok: false, msg: 'Link da música não encontrado' };
    }

    const downloadResult = await download(track.song_link);

    if (!downloadResult.ok) {
      return downloadResult;
    }

    return {
      ok: true,
      buffer: downloadResult.buffer,
      query,
      track: {
        name: track.name,
        artists: track.artists,
        link: track.link
      },
      title: downloadResult.title,
      artists: downloadResult.artists,
      albumImage: downloadResult.albumImage,
      year: downloadResult.year,
      duration: downloadResult.duration,
      filename: downloadResult.filename
    };
  } catch (error) {
    console.error('Erro na busca/download do Spotify:', error.message);
    return { ok: false, msg: error.message || 'Erro ao buscar no Spotify' };
  }
}

export default {
  download,
  downloadByFreeTextQuery,
  search,
  searchDownload
};
