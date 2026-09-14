import { downloadContentFromMessage } from 'baileys';
import { getQuotedMediaSource } from './gyomeiCore.js';

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function downloadQuotedCommandMedia(message) {
  const source = getQuotedMediaSource(message);
  if (!source?.message) {
    return {
      ok: false,
      msg: 'Responda a uma foto, GIF ou vídeo válido.'
    };
  }

  try {
    const stream = await downloadContentFromMessage(source.message, source.type);
    const buffer = await streamToBuffer(stream);

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return {
        ok: false,
        msg: 'A mídia citada foi reconhecida, mas veio vazia.'
      };
    }

    return {
      ok: true,
      buffer,
      type: source.type,
      gifPlayback: source.gifPlayback === true
    };
  } catch (error) {
    return {
      ok: false,
      msg: `Não foi possível baixar a mídia citada: ${error.message}`
    };
  }
}
