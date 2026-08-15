/**
 * YouTube Download - Usando a Vex API
 */

import yts from 'yt-search';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from '../../utils/gyomeiStore.js';
import { downloadYoutubeAudioForPlay, downloadYoutubeVideoForPlay } from '../../services/bunnyfy/youtubeGateway.js';

const DOWNLOAD_TIMEOUT = 180000;
const MAX_AUDIO_DURATION_SECONDS = 30 * 60;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const VEX_YOUTUBE_ENDPOINTS = new Set(['youtubemp3', 'youtubemp4']);

export function buildVexFailureLogEntry(endpoint, response) {
  const payload = response?.data;
  const responseShape = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? Object.prototype.hasOwnProperty.call(payload, 'resposta')
      ? 'resposta'
      : Object.prototype.hasOwnProperty.call(payload, 'resultado')
        ? 'resultado'
        : 'direto'
    : Array.isArray(payload)
      ? 'lista'
      : typeof payload;

  return {
    ts: new Date().toISOString(),
    marca: 'VEX_YOUTUBE_SEM_LINK',
    code: 'UPSTREAM_INVALID_RESPONSE',
    endpoint: VEX_YOUTUBE_ENDPOINTS.has(endpoint) ? endpoint : 'desconhecido',
    httpStatus: Number.isInteger(response?.status) && response.status >= 100 && response.status <= 599
      ? response.status
      : null,
    responseShape,
    success: typeof payload?.success === 'boolean' ? payload.success : null,
    hasMessage: typeof payload?.message === 'string' || typeof payload?.msg === 'string'
  };
}

function getVexCredentials() {
  const config = getConfig();
  const site = String(config.site_vex || '').replace(/\/$/, '');
  const apikey = String(config.apikey_vex || '').trim();
  if (!site || !apikey || apikey.startsWith('COLOQUE_')) return null;
  return { site, apikey };
}

function getYouTubeVideoId(url) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "00:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

async function getMetadataByVideoId(videoId) {
  const normalizedVideoId = String(videoId || '').trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(normalizedVideoId)) {
    return { ok: false, msg: 'Identificador de vídeo inválido' };
  }

  try {
    const video = await yts({ videoId: normalizedVideoId });
    const seconds = Number(video?.seconds ?? video?.duration?.seconds);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return { ok: false, msg: 'Não foi possível confirmar a duração do vídeo' };
    }
    if (seconds > MAX_AUDIO_DURATION_SECONDS) {
      return { ok: false, code: 'YOUTUBE_TOO_LONG', msg: 'O vídeo excede o limite de 30 minutos' };
    }

    return {
      ok: true,
      data: {
        videoId: normalizedVideoId,
        url: video?.url || `https://youtube.com/watch?v=${normalizedVideoId}`,
        title: video?.title || 'YouTube Audio',
        thumbnail: video?.thumbnail || video?.image || '',
        seconds,
        timestamp: video?.timestamp || video?.duration?.timestamp || formatDuration(seconds)
      }
    };
  } catch {
    return { ok: false, msg: 'Não foi possível consultar os metadados do vídeo' };
  }
}

async function downloadFile(url) {
  try {
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      timeout: DOWNLOAD_TIMEOUT,
      maxRedirects: 5,
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    return Buffer.from(response.data);
  } catch (error) {
    throw new Error(`Falha no download: ${error.message}`);
  }
}

async function baixarViaVex(endpoint, youtubeUrl) {
  const credenciais = getVexCredentials();
  if (!credenciais) {
    return { success: false, error: 'Configure site_vex e apikey_vex em dados/src/config.json.' };
  }

  try {
    // O axios manda "Accept: application/json, text/plain, */*" por padrão, e
    // como isso contém "application/json", ainda aciona o bug do roteador da Vex
    // (devolve a documentação em vez do resultado). Precisa sobrescrever pra */*.
    const apiUrl = `${credenciais.site}/api/downloads/${endpoint}?apikey=${encodeURIComponent(credenciais.apikey)}&query=${encodeURIComponent(youtubeUrl)}`;
    const response = await axios.get(apiUrl, {
      timeout: DOWNLOAD_TIMEOUT,
      headers: { Accept: '*/*' }
    });

    const resposta = response.data?.resposta || response.data?.resultado || response.data;
    const dlurl = resposta?.dlurl || resposta?.url;
    if (!dlurl) {
      try {
        fs.appendFileSync(
          path.dirname(fileURLToPath(import.meta.url)) + '/../../../logs/debug-vex-youtube.log',
          `${JSON.stringify(buildVexFailureLogEntry(endpoint, response))}\n`
        );
      } catch {}
      throw new Error(response.data?.message || response.data?.msg || 'A Vex não retornou um link de download.');
    }

    const buffer = await downloadFile(dlurl);
    if (!buffer) throw new Error('Falha ao baixar o arquivo');

    return {
      success: true,
      buffer,
      title: resposta.title || resposta.titulo || null,
      dlurl
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.response?.data?.msg || error.message
    };
  }
}

async function DownloadAudio(url) {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return { success: false, error: 'URL do YouTube inválida' };

  const resultado = await baixarViaVex('youtubemp3', `https://youtube.com/watch?v=${videoId}`);
  if (!resultado.success) return { ...resultado, source: 'vex' };

  let videoInfo = null;
  try {
    const searchResults = await yts(url);
    videoInfo = searchResults?.videos?.[0] || null;
  } catch (e) {}

  return {
    success: true,
    buffer: resultado.buffer,
    title: resultado.title || videoInfo?.title || 'YouTube Audio',
    thumbnail: videoInfo?.thumbnail || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    quality: '128 kbps',
    filename: `${(resultado.title || videoInfo?.title || 'audio').replace(/[^\w\s]/gi, '')}.mp3`,
    tempo: videoInfo?.seconds || 0,
    duration: formatDuration(videoInfo?.seconds || 0),
    source: 'vex'
  };
}

async function DownloadVideo(url, qualidade = '360p') {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return { success: false, error: 'URL do YouTube inválida' };

  const resultado = await baixarViaVex('youtubemp4', `https://youtube.com/watch?v=${videoId}`);
  if (!resultado.success) return { ...resultado, source: 'vex' };

  let videoInfo = null;
  try {
    const searchResults = await yts(url);
    videoInfo = searchResults?.videos?.[0] || null;
  } catch (e) {}

  return {
    success: true,
    buffer: resultado.buffer,
    title: resultado.title || videoInfo?.title || 'YouTube Video',
    thumbnail: videoInfo?.thumbnail || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    quality: qualidade,
    filename: `${(resultado.title || videoInfo?.title || 'video').replace(/[^\w\s]/gi, '')}.mp4`,
    tempo: videoInfo?.seconds || 0,
    duration: formatDuration(videoInfo?.seconds || 0),
    source: 'vex'
  };
}

// ============================================
// FUNÇÕES PÚBLICAS
// ============================================

async function search(query) {
  try {
    if (!query?.trim()) return { ok: false, msg: 'Termo de pesquisa inválido' };

    const results = await yts(query);
    const video = results?.videos?.[0];
    if (!video) return { ok: false, msg: 'Nenhum vídeo encontrado' };

    return {
      ok: true,
      criador: 'Hiudy',
      data: {
        videoId: video.videoId || video.id || '',
        url: video.url,
        title: video.title,
        description: video.description || '',
        thumbnail: video.thumbnail || video.image || '',
        seconds: video.seconds || 0,
        timestamp: video.timestamp || formatDuration(video.seconds || 0),
        ago: video.ago || '',
        views: video.views || 0,
        author: {
          name: video.author?.name || 'Unknown',
          url: video.author?.url || ''
        }
      }
    };
  } catch (error) {
    return { ok: false, msg: 'Erro ao buscar vídeo: ' + error.message };
  }
}

// Adapta as funções desta mesma tela (que já sabiam falar com a Vex) para a
// interface que o gateway do BunnyFy espera de um "legacyYoutube" — é o
// mesmo objeto usado pelo comando `play`, só que reaproveitando as chamadas
// diretas à Vex já existentes aqui em vez de importar o próprio módulo.
const legacyYoutubeAdapter = {
  async mp3(url) {
    const result = await DownloadAudio(url);
    if (!result.success || !result.buffer) return { ok: false, msg: result.error };
    return { ok: true, buffer: result.buffer, title: result.title, thumbnail: result.thumbnail, tempo: result.tempo };
  },
  async mp4(url, qualidade) {
    const result = await DownloadVideo(url, qualidade);
    if (!result.success || !result.buffer) return { ok: false, msg: result.error };
    return { ok: true, buffer: result.buffer, title: result.title, thumbnail: result.thumbnail, tempo: result.tempo };
  },
  getMetadataByVideoId,
  search
};

async function mp3(url) {
  try {
    const id = getYouTubeVideoId(url);
    if (!id) return { ok: false, msg: 'URL inválida do YouTube' };

    const result = await downloadYoutubeAudioForPlay(`https://youtube.com/watch?v=${id}`, {
      legacyYoutube: legacyYoutubeAdapter
    });

    if (!result.ok || !result.buffer) {
      return { ok: false, msg: result.msg || 'Erro ao processar áudio' };
    }

    return {
      ok: true,
      criador: result.source === 'bunnyfy' ? 'BunnyFy' : 'Hiudy',
      buffer: result.buffer,
      title: result.title,
      thumbnail: result.thumbnail,
      quality: '128 kbps',
      filename: result.filename,
      source: result.source,
      tempo: result.durationSeconds
    };
  } catch (error) {
    return { ok: false, msg: 'Erro ao baixar áudio: ' + error.message };
  }
}

async function mp4(url, qualidade = '360p') {
  try {
    const id = getYouTubeVideoId(url);
    if (!id) return { ok: false, msg: 'URL inválida do YouTube' };

    const result = await downloadYoutubeVideoForPlay(`https://youtube.com/watch?v=${id}`, {
      quality: qualidade,
      legacyYoutube: legacyYoutubeAdapter
    });

    if (!result.ok || !result.buffer) {
      return { ok: false, msg: result.msg || 'Erro ao processar vídeo' };
    }

    return {
      ok: true,
      criador: result.source === 'bunnyfy' ? 'BunnyFy' : 'Hiudy',
      buffer: result.buffer,
      title: result.title,
      thumbnail: result.thumbnail,
      quality: qualidade,
      filename: result.filename,
      source: result.source,
      tempo: result.durationSeconds
    };
  } catch (error) {
    return { ok: false, msg: 'Erro ao baixar vídeo: ' + error.message };
  }
}

// ============================================
// EXPORTS
// ============================================

export const ytmp3 = mp3;
export const ytmp4 = mp4;
export { getMetadataByVideoId, search, mp3, mp4, legacyYoutubeAdapter };
