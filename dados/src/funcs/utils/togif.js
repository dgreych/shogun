/**
 * Converte vídeo ou figurinha animada em "gif" válido pro WhatsApp.
 * Não existe mensagem de gif de verdade no protocolo — o WhatsApp entende
 * como gif um mp4 mudo enviado com { video, gifPlayback: true }.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import webp from 'node-webpmux';

const __dirnameTogif = path.dirname(fileURLToPath(import.meta.url));

function ensureTmpDir() {
  const tmpDir = path.join(__dirnameTogif, '..', '..', '..', 'database', 'tmp');
  if (!fsSync.existsSync(tmpDir)) {
    fsSync.mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
}

function generateTempFileName(ext) {
  return path.join(ensureTmpDir(), `${Date.now()}_${Math.floor(Math.random() * 1e6)}.${ext}`);
}

const MAX_DURATION_SECONDS = 10;
const OUTPUT_VF = "scale='min(480,iw)':-2,fps=15";

async function encodeToMp4(inputArgs, extraOutputOptions = []) {
  const tmpOut = generateTempFileName('mp4');
  try {
    await new Promise((resolve, reject) => {
      const cmd = ffmpeg();
      inputArgs(cmd);
      cmd
        .outputOptions([
          '-an',
          '-vf', OUTPUT_VF,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          ...extraOutputOptions,
        ])
        .format('mp4')
        .on('error', reject)
        .on('end', resolve)
        .save(tmpOut);
    });
    const stat = await fs.stat(tmpOut).catch(() => null);
    if (!stat || stat.size === 0) {
      throw new Error('Conversão falhou: saída vazia');
    }
    return await fs.readFile(tmpOut);
  } finally {
    await fs.unlink(tmpOut).catch(() => {});
  }
}

async function convertVideoToGifPlayback(buffer) {
  const tmpIn = generateTempFileName('mp4');
  await fs.writeFile(tmpIn, buffer);
  try {
    return await encodeToMp4(cmd => cmd.input(tmpIn), ['-t', String(MAX_DURATION_SECONDS)]);
  } finally {
    await fs.unlink(tmpIn).catch(() => {});
  }
}

// O decoder nativo do ffmpeg não entende os chunks ANIM/ANMF de webp animado
// (só decodifica frame único). Por isso os frames são extraídos separadamente
// via node-webpmux (cada frame demuxado já sai como um webp estático válido,
// que o ffmpeg decodifica normalmente) e remontados com o demuxer concat,
// respeitando o delay original de cada frame.
async function convertAnimatedStickerToGifPlayback(buffer) {
  const img = new webp.Image();
  await img.load(buffer);
  if (!img.hasAnim) {
    return convertVideoToGifPlayback(buffer);
  }

  const frameBuffers = await img.demux({ buffers: true });
  const stamp = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const tmpDir = ensureTmpDir();
  const framePaths = [];
  const listLines = [];
  let elapsedMs = 0;

  try {
    for (let i = 0; i < frameBuffers.length; i++) {
      if (elapsedMs >= MAX_DURATION_SECONDS * 1000) break;
      const framePath = path.join(tmpDir, `${stamp}_f${i}.webp`);
      await fs.writeFile(framePath, frameBuffers[i]);
      framePaths.push(framePath);
      const delayMs = img.frames[i].delay > 0 ? img.frames[i].delay : 100;
      listLines.push(`file '${framePath.replace(/'/g, "'\\''")}'`);
      listLines.push(`duration ${(delayMs / 1000).toFixed(3)}`);
      elapsedMs += delayMs;
    }
    if (framePaths.length === 0) {
      throw new Error('Figurinha animada sem frames válidos');
    }
    // o demuxer concat ignora a duration do último item, então repete o último frame
    listLines.push(`file '${framePaths[framePaths.length - 1].replace(/'/g, "'\\''")}'`);

    const listPath = path.join(tmpDir, `${stamp}_list.txt`);
    await fs.writeFile(listPath, listLines.join('\n'));
    framePaths.push(listPath);

    return await encodeToMp4(cmd => cmd.input(listPath).inputOptions(['-f', 'concat', '-safe', '0']));
  } finally {
    await Promise.all(framePaths.map(p => fs.unlink(p).catch(() => {})));
  }
}

export async function convertToGifPlayback(buffer, isAnimatedSticker = false) {
  if (isAnimatedSticker) {
    return convertAnimatedStickerToGifPlayback(buffer);
  }
  return convertVideoToGifPlayback(buffer);
}
