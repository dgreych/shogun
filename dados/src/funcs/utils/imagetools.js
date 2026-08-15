/**
 * Image Tools - Remoção de fundo e Upscale, usando a Vex API
 */

import axios from 'axios';
import { getConfig } from '../../utils/gyomeiStore.js';

function getVexCredentials() {
  const config = getConfig();
  const site = String(config.site_vex || '').replace(/\/$/, '');
  const apikey = String(config.apikey_vex || '').trim();
  if (!site || !apikey || apikey.startsWith('COLOQUE_')) return null;
  return { site, apikey };
}

/**
 * Remover fundo de uma imagem
 * @param {string} url - URL da imagem
 * @returns {Promise<Object>} Resultado com URL da imagem sem fundo
 */
async function removeBg(url) {
  try {
    if (!url || typeof url !== 'string') {
      return { ok: false, msg: 'URL da imagem é obrigatória' };
    }

    const credenciais = getVexCredentials();
    if (!credenciais) {
      return { ok: false, msg: 'Configure site_vex e apikey_vex em dados/src/config.json.' };
    }

    console.log('[RemoveBG] Processando imagem...');

    // O axios manda "Accept: application/json, text/plain, */*" por padrão, e
    // como isso contém "application/json", aciona o bug do roteador da Vex
    // (devolve a documentação em vez do resultado). Precisa sobrescrever pra */*.
    const download = `${credenciais.site}/api/ferramentas/removebg?apikey=${encodeURIComponent(credenciais.apikey)}&query=${encodeURIComponent(url)}`;
    const response = await axios.get(download, {
      responseType: 'arraybuffer',
      timeout: 120000,
      headers: { Accept: '*/*' }
    });

    if (!response.data || response.data.byteLength < 1000) {
      return { ok: false, msg: 'A Vex não retornou uma imagem válida.' };
    }

    return {
      ok: true,
      status: true,
      result: { download }
    };
  } catch (error) {
    console.error('[RemoveBG] Erro:', error.message);
    return { ok: false, msg: error.message || 'Erro ao remover fundo da imagem' };
  }
}

/**
 * Melhorar qualidade de uma imagem (upscale)
 * @param {string} url - URL da imagem
 * @param {number} scale - Escala de aumento (2 ou 4)
 * @returns {Promise<Object>} Resultado com URL da imagem melhorada
 */
async function upscale(url, scale = 2) {
  if (!url || typeof url !== 'string') {
    return { ok: false, msg: 'URL da imagem é obrigatória' };
  }

  const credenciais = getVexCredentials();
  if (!credenciais) {
    return { ok: false, msg: 'Configure site_vex e apikey_vex em dados/src/config.json.' };
  }

  console.log(`[Upscale] Processando imagem (${scale}x)...`);

  // A URL já é a imagem em si (a Vex processa na hora que é acessada), então não
  // precisa baixar nada aqui — só montar o link certo, como o próprio endpoint espera.
  const download = `${credenciais.site}/api/ferramentas/upscale?apikey=${encodeURIComponent(credenciais.apikey)}&query=${encodeURIComponent(url)}&scale=${scale}`;

  return {
    ok: true,
    status: true,
    result: { download }
  };
}

export default { removeBg, upscale };
export { removeBg, upscale };
