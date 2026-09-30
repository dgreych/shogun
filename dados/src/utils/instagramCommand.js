/** Uma execução aguarda o carrossel completo; reação não substitui entrega. */
export async function executeInstagramDownload({ url, prefix, command, chatId, message, socket, reply, download }) {
    if (!String(url || '').trim()) {
        await reply(`Envie o link de um post, reel ou story do Instagram.\n\n${prefix}${command} <link>\n${prefix}igstory https://www.instagram.com/stories/usuario/<id>/\n\nCarrosséis são enviados na ordem. Stories precisam continuar disponíveis.`);
        return false;
    }
    const react = async text => {
        try { await socket.sendMessage(chatId, { react: { text, key: message.key } }); } catch { /* feedback opcional; mídia continua */ }
    };
    await react('⏳');
    try {
        await reply('Buscando as mídias do Instagram. Aguarde um instante.');
        const result = await download(url.trim());
        if (!result?.ok) {
            await reply(result?.msg || 'Não consegui baixar essa publicação do Instagram agora.');
            await react('⚠️');
            return false;
        }
        if (!Array.isArray(result.data) || !result.data.length || result.data.length > 20 || result.data.some(item => !['image', 'video'].includes(item.type) || !Buffer.isBuffer(item.buff) || !item.buff.length)) {
            throw new Error('Mídias do Instagram inválidas.');
        }
        for (const [index, item] of result.data.entries()) {
            await socket.sendMessage(chatId, {
                [item.type]: item.buff,
                mimetype: item.mime || (item.type === 'video' ? 'video/mp4' : 'image/jpeg'),
                caption: `Instagram · ${item.type === 'video' ? 'vídeo' : 'imagem'} ${index + 1}/${result.data.length}`,
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
