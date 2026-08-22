import axios from 'axios';
function required(value, label) {
    if (value == null)
        throw new Error(`Serviço legado indisponível: ${label}`);
    return value;
}
function socketOf(context) {
    const socket = context.socket;
    if (!socket || typeof socket.sendMessage !== 'function') {
        throw new Error('Socket legado não expõe sendMessage no domínio de ferramentas diversas.');
    }
    return socket;
}
function recordOf(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
function quotedMessageOf(context) {
    const message = recordOf(context.message);
    const envelope = recordOf(message?.message);
    const extended = recordOf(envelope?.extendedTextMessage);
    const contextInfo = recordOf(extended?.contextInfo);
    return recordOf(contextInfo?.quotedMessage);
}
async function nickCommand(context) {
    const query = context.query.trim();
    if (!query) {
        await context.reply(`🎮 *GERADOR DE NICK*\n\n📝 *Como usar:*\n• Digite o nick após o comando\n• Ex: ${context.prefix}nick nazuna`);
        return;
    }
    try {
        const styles = await required(context.styleText, 'styleText')(query);
        await context.reply([...styles].join('\n'));
    }
    catch (error) {
        console.error('[vnext:tools:nick] falha:', error);
        await context.reply('❌ Ocorreu um erro interno. Tente novamente em alguns minutos.');
    }
}
async function qrCodeCommand(context) {
    const query = context.query.trim();
    if (!query) {
        await context.reply(`📲 *Gerador de QR Code*\n\n💡 *Como usar:*\n• Envie o texto ou link após o comando\n• Ex: ${context.prefix}qrcode https://exemplo.com\n• Ex: ${context.prefix}qrcode Seu texto aqui\n\n✨ O QR Code será gerado instantaneamente!`);
        return;
    }
    try {
        await context.reply(required(context.pickLoadingMessage, 'pickLoadingMessage')());
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(query)}`;
        await socketOf(context).sendMessage(context.groupId, {
            image: { url: qrUrl },
            caption: `📱✨ *Seu QR Code super fofo está pronto!*\n\nConteúdo: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`,
        }, { quoted: context.message });
    }
    catch (error) {
        console.error('[vnext:tools:qrcode] falha:', error);
        await context.reply('❌ Erro ao gerar QR Code. Tente novamente mais tarde.');
    }
}
async function readQrCommand(context) {
    const reader = context.qrReader;
    if (!reader) {
        await context.reply('Sistema de QR Code temporariamente indisponível.');
        return;
    }
    const quoted = quotedMessageOf(context);
    const directMessage = recordOf(recordOf(context.message)?.message);
    const quotedImage = quoted?.imageMessage;
    const directImage = directMessage?.imageMessage;
    const hasImage = context.messageType === 'imageMessage' || Boolean(quotedImage);
    if (!hasImage) {
        await context.reply('❌ Responda a uma imagem com QR Code para ler!');
        return;
    }
    try {
        const mediaMessage = quotedImage || directImage;
        const stream = await required(context.downloadContentFromMessage, 'downloadContentFromMessage')(mediaMessage, 'image');
        const chunks = [];
        for await (const chunk of stream)
            chunks.push(chunk);
        const result = await reader.readQRCode(Buffer.concat(chunks));
        await context.reply(result.message);
    }
    catch (error) {
        console.error('[vnext:tools:lerqr] falha:', error);
        await context.reply('❌ Erro ao processar a imagem!');
    }
}
async function shortenLinkCommand(context, httpPost) {
    const query = context.query.trim();
    const command = context.command || 'encurtalink';
    try {
        if (!query) {
            await context.reply(`❌️ *Forma incorreta, use está como exemplo:* ${context.prefix}${command} https://instagram.com/hiudyyy_`);
            return;
        }
        await context.reply(required(context.pickLoadingMessage, 'pickLoadingMessage')());
        const response = await httpPost('https://spoo.me/api/v1/shorten', {
            long_url: query,
            alias: `nazuna_${Math.floor(10000 + Math.random() * 90000)}`,
        });
        await context.reply(`✅ *Link encurtado com sucesso!*\n\n🔗 *Link curto:* ${String(response.data.short_url ?? '')}\n📎 *Link original:* ${String(response.data.long_url ?? '')}`);
    }
    catch (error) {
        console.error('[vnext:tools:encurtalink] falha:', error);
        await context.reply('❌ Ocorreu um erro interno. Tente novamente em alguns minutos.');
    }
}
async function dictionaryCommand(context) {
    const query = context.query.trim();
    const command = context.command || 'dicionario';
    if (!query) {
        await context.reply(`📔 Qual palavra você quer procurar no dicionário? Me diga após o comando ${context.prefix}${command}! 😊`);
        return;
    }
    await context.reply('📔 Procurando no dicionário... Aguarde um pouquinho! ⏳');
    const word = query.toLowerCase();
    try {
        const result = await required(context.dictionary, 'Dicionary')(word);
        if (!result || result.significados.length === 0)
            throw new Error('Sem resultados');
        let text = `📘✨ *Significado de "${result.palavra || word.toUpperCase()}":*\n\n`;
        if (result.classe)
            text += `*📚 Classe:* ${result.classe}\n\n`;
        if (result.separacao)
            text += `*🔤 Separação:* ${result.separacao}\n\n`;
        text += '*📖 Significados:*\n';
        result.significados.slice(0, 3).forEach((meaning, index) => { text += `${index + 1}. ${meaning}\n`; });
        if (result.significados.length > 3)
            text += `_...e mais ${result.significados.length - 3} significados_\n`;
        text += '\n';
        const example = result.exemplos[0];
        if (example) {
            text += `*💡 Exemplo:*\n${example.texto}\n`;
            if (example.fonte)
                text += `_Fonte: ${example.fonte}_\n`;
            text += '\n';
        }
        if (result.etimologia)
            text += `*📜 Etimologia:*\n${result.etimologia.substring(0, 150)}...\n\n`;
        const phrase = result.frases[0];
        if (phrase) {
            text += `*✨ Frase:*\n“${phrase.texto}”\n`;
            if (phrase.autor && phrase.autor !== 'Desconhecido')
                text += `_— ${phrase.autor}_\n`;
        }
        await context.reply(text);
        return;
    }
    catch {
        const prompt = `Defina a palavra "${word}" em português de forma completa e fofa. Inclua a classe gramatical, os principais significados e um exemplo de uso em uma frase curta e bonitinha.`;
        try {
            const ai = required(context.ai, 'ia');
            const model = required(context.defaultAiModel, 'DEFAULT_NVIDIA_MODEL');
            const formatter = required(context.formatAIResponse, 'formatAIResponse');
            const response = await ai.makeCognimaRequest(model, prompt, null);
            await context.reply(formatter(response.data.choices[0].message.content));
        }
        catch (error) {
            console.error('[vnext:tools:dicionario] falha:', error);
            await context.reply('❌ Palavra não encontrada. Verifique a ortografia e tente novamente.');
        }
    }
}
async function translatorCommand(context) {
    const query = context.query.trim();
    const command = context.command || 'tradutor';
    if (!query) {
        await context.reply(`🌍 Quer traduzir algo? Me diga o idioma e o texto assim: ${context.prefix}${command} idioma | texto\n      Exemplo: ${context.prefix}tradutor inglês | Bom dia! 😊`);
        return;
    }
    const parts = query.split('|');
    if (parts.length < 2) {
        await context.reply(`Formato incorreto! 😅 Use: ${context.prefix}tradutor idioma | texto\n      Exemplo: ${context.prefix}tradutor espanhol | Olá mundo! ✨`);
        return;
    }
    const language = parts[0]?.trim() || '';
    const text = parts.slice(1).join('|').trim();
    try {
        await context.reply(required(context.pickLoadingMessage, 'pickLoadingMessage')());
        const ai = required(context.ai, 'ia');
        const model = required(context.defaultAiModel, 'DEFAULT_NVIDIA_MODEL');
        const formatter = required(context.formatAIResponse, 'formatAIResponse');
        const prompt = `Traduza o seguinte texto para ${language}:\n\n${text}\n\nForneça apenas a tradução, sem explicações adicionais.`;
        const response = await ai.makeCognimaRequest(model, prompt, null);
        await context.reply(`🌐✨ *Prontinho! Sua tradução para ${language.toUpperCase()} está aqui:*\n\n${formatter(response.data.choices[0].message.content)}`);
    }
    catch (error) {
        console.error('[vnext:tools:tradutor] falha:', error);
        await context.reply('❌ Não foi possível realizar a tradução no momento. Tente novamente mais tarde.');
    }
}
async function uploadCommand(context) {
    if (!context.isQuotedImage && !context.isQuotedVideo && !context.isQuotedDocument && !context.isQuotedAudio) {
        await context.reply('Marque um video, uma foto, um audio ou um documento');
        return;
    }
    try {
        const quoted = quotedMessageOf(context);
        if (!quoted)
            throw new Error('Mensagem citada ausente.');
        const getFileBuffer = required(context.getFileBuffer, 'getFileBuffer');
        let media;
        if (context.isQuotedDocument)
            media = await getFileBuffer(quoted.documentMessage, 'document');
        else if (context.isQuotedVideo)
            media = await getFileBuffer(quoted.videoMessage, 'video');
        else if (context.isQuotedImage)
            media = await getFileBuffer(quoted.imageMessage, 'image');
        else
            media = await getFileBuffer(quoted.audioMessage, 'audio');
        const link = await required(context.uploadMedia, 'upload')(media);
        await context.reply(String(link));
    }
    catch (error) {
        console.error('[vnext:tools:upload] falha:', error);
        await context.reply('❌ Ocorreu um erro interno. Tente novamente em alguns minutos.');
    }
}
export class MiscToolsDomainDispatchTarget {
    httpPost;
    constructor(httpPost = (url, body) => axios.post(url, body)) {
        this.httpPost = httpPost;
    }
    async dispatch(command, context) {
        const normalized = String(command || '').trim().toLowerCase();
        let handler;
        if (['nick', 'gerarnick', 'nickgenerator'].includes(normalized))
            handler = nickCommand;
        else if (normalized === 'qrcode')
            handler = qrCodeCommand;
        else if (['lerqr', 'readqr', 'scanqr'].includes(normalized))
            handler = readQrCommand;
        else if (['encurtalink', 'tinyurl'].includes(normalized)) {
            handler = (ctx) => shortenLinkCommand(ctx, this.httpPost);
        }
        else if (['dicionario', 'dictionary'].includes(normalized))
            handler = dictionaryCommand;
        else if (['tradutor', 'translator'].includes(normalized))
            handler = translatorCommand;
        else if (['upload', 'imgpralink', 'videopralink', 'gerarlink'].includes(normalized))
            handler = uploadCommand;
        if (!handler)
            return false;
        await handler({ ...context, command: normalized });
        return true;
    }
}
export const MISC_TOOLS_NATIVE_COMMAND_TOKENS = Object.freeze([
    'nick', 'gerarnick', 'nickgenerator',
    'qrcode',
    'lerqr', 'readqr', 'scanqr',
    'encurtalink', 'tinyurl',
    'dicionario', 'dictionary',
    'tradutor', 'translator',
    'upload', 'imgpralink', 'videopralink', 'gerarlink',
]);
//# sourceMappingURL=misc-domain.js.map