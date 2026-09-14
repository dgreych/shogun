/**
 * YouTube Download - Usando a serviço legado API
 */

import yts from 'yt-search';
import axios from 'axios';
import { downloadYoutubeAudioForPlay, downloadYoutubeVideoForPlay } from '../../services/bunnyfy/youtubeGateway.js';

const DOWNLOAD_TIMEOUT = 180000;
const MAX_AUDIO_DURATION_SECONDS = 30 * 60;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';



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
      criador: 'shogun',
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

// Adapta as funções desta mesma tela (que já sabiam falar com a serviço legado) para a
// interface que o gateway do BunnyFy espera de um "legacyYoutube" — é o
// mesmo objeto usado pelo comando `play`, só que reaproveitando as chamadas
// diretas à serviço legado já existentes aqui em vez de importar o próprio módulo.
const youtubeMetadataAdapter = {
  getMetadataByVideoId,
  search
};

async function mp3(url) {
  try {
    const id = getYouTubeVideoId(url);
    if (!id) return { ok: false, msg: 'URL inválida do YouTube' };

    const result = await downloadYoutubeAudioForPlay(`https://youtube.com/watch?v=${id}`, {
      legacyYoutube: youtubeMetadataAdapter
    });

    if (!result.ok || !result.buffer) {
      return { ok: false, msg: result.msg || 'Erro ao processar áudio' };
    }

    return {
      ok: true,
      criador: result.source === 'bunnyfy' ? 'BunnyFy' : 'shogun',
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
      legacyYoutube: youtubeMetadataAdapter
    });

    if (!result.ok || !result.buffer) {
      return { ok: false, msg: result.msg || 'Erro ao processar vídeo' };
    }

    return {
      ok: true,
      criador: result.source === 'bunnyfy' ? 'BunnyFy' : 'shogun',
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
export { getMetadataByVideoId, search, mp3, mp4, youtubeMetadataAdapter };
