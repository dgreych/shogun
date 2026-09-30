/** Uma execução aguarda o carrossel completo; reação não substitui entrega. */
export interface InstagramMessageKey {
  id?: string;
  remoteJid?: string;
  participant?: string;
  fromMe?: boolean;
}
export interface InstagramMessage { key: InstagramMessageKey }
export interface InstagramMedia {
  type: 'image' | 'video';
  buff: Buffer;
  mime?: string;
}
export interface InstagramOutbound {
  image?: Buffer;
  video?: Buffer;
  mimetype?: string;
  caption?: string;
  react?: { text: string; key: InstagramMessageKey };
}
export interface InstagramDownloadContext {
  url: string;
  prefix: string;
  command: string;
  chatId: string;
  message: InstagramMessage;
  socket: { sendMessage(chatId: string, content: InstagramOutbound, options?: { quoted: InstagramMessage }): Promise<unknown> };
  reply(text: string): Promise<unknown>;
  download(url: string): Promise<unknown>;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function mediaList(value: unknown): InstagramMedia[] {
  if (!Array.isArray(value) || !value.length || value.length > 20) throw new Error('Mídias do Instagram inválidas.');
  return value.map((item: unknown): InstagramMedia => {
    if (!record(item) || (item.type !== 'image' && item.type !== 'video') || !Buffer.isBuffer(item.buff) || !item.buff.length) throw new Error('Mídias do Instagram inválidas.');
    return { type: item.type, buff: item.buff, ...(typeof item.mime === 'string' && item.mime ? { mime: item.mime } : {}) };
  });
}
export async function executeInstagramDownload({ url, prefix, command, chatId, message, socket, reply, download }: InstagramDownloadContext): Promise<boolean> {
  if (!String(url || '').trim()) {
    await reply(`Envie o link de um post, reel ou story do Instagram.\n\n${prefix}${command} <link>\n${prefix}igstory https://www.instagram.com/stories/usuario/<id>/\n\nCarrosséis são enviados na ordem. Stories precisam continuar disponíveis.`);
    return false;
  }
  const react = async (text: string): Promise<void> => {
    try { await socket.sendMessage(chatId, { react: { text, key: message.key } }); } catch { /* feedback opcional; mídia continua */ }
  };
  await react('⏳');
  try {
    await reply('Buscando as mídias do Instagram. Aguarde um instante.');
    const result = await download(url.trim());
    if (!record(result) || result.ok !== true) {
      await reply(record(result) && typeof result.msg === 'string' && result.msg ? result.msg : 'Não consegui baixar essa publicação do Instagram agora.');
      await react('⚠️');
      return false;
    }
    const items = mediaList(result.data);
    for (const [index, item] of items.entries()) {
      await socket.sendMessage(chatId, {
        [item.type]: item.buff,
        mimetype: item.mime || (item.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        caption: `Instagram · ${item.type === 'video' ? 'vídeo' : 'imagem'} ${index + 1}/${items.length}`,
      }, { quoted: message });
    }
    await react('✅');
    return true;
  } catch {
    await reply('Não consegui entregar todas as mídias do Instagram. Confira o link e tente novamente em instantes.');
    await react('⚠️');
    return false;
  }
}
