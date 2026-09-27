/**
 * Garante que saídas de imagem nunca sejam WebP (o WhatsApp não abre/baixa de
 * forma confiável quando enviado como mensagem de imagem comum — só stickers
 * usam WebP de propósito). Converte pra JPEG via ffmpeg quando necessário.
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';

const __dirnameMediaFormat = path.dirname(fileURLToPath(import.meta.url));

function ensureTmpDir() {
  const tmpDir = path.join(__dirnameMediaFormat, '..', '..', 'database', 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
}

function generateTempFileName(ext) {
  return path.join(ensureTmpDir(), `${Date.now()}_${Math.floor(Math.random() * 1e6)}.${ext}`);
}

function isWebp(buffer) {
  return buffer.length >= 12
    && buffer.slice(0, 4).toString() === 'RIFF'
    && buffer.slice(8, 12).toString() === 'WEBP';
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Detecta o mime real pelos bytes (não confia no content-type do servidor de
 * origem — a Vex já teve bug de roteador devolvendo o tipo errado). Retorna
 * null se não reconhecer, pra quem chamar decidir o fallback.
 */
function sniffImageMime(buffer) {
  if (isWebp(buffer)) return 'image/webp';
  if (buffer.length >= 8 && buffer.slice(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.slice(0, 6).toString())) return 'image/gif';
  return null;
}

async function converterWebpParaJpeg(buffer) {
  const tmpIn = generateTempFileName('webp');
  const tmpOut = generateTempFileName('jpg');
  await fsPromises.writeFile(tmpIn, buffer);
  try {
    await new Promise((resolve, reject) => {
      ffmpeg(tmpIn)
        .outputOptions(['-q:v', '4'])
        .format('mjpeg')
        .on('error', reject)
        .on('end', resolve)
        .save(tmpOut);
    });
    return await fsPromises.readFile(tmpOut);
  } finally {
    await fsPromises.unlink(tmpIn).catch(() => {});
    await fsPromises.unlink(tmpOut).catch(() => {});
  }
}

/**
 * Recebe um buffer de imagem e o content-type declarado pelo servidor de origem.
 * Se for WebP (pelo header OU pelos bytes reais), converte pra JPEG.
 * Devolve { buffer, mime }.
 */
export async function ensureNonWebpImage(buffer, contentType = '') {
  const sniffed = sniffImageMime(buffer);
  const pareceWebp = sniffed ? sniffed === 'image/webp' : String(contentType).includes('webp');
  if (pareceWebp) {
    const convertido = await converterWebpParaJpeg(buffer);
    return { buffer: convertido, mime: 'image/jpeg' };
  }
  return { buffer, mime: sniffed || contentType || 'image/jpeg' };
}
