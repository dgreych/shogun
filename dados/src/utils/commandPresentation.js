import { SHOGUN_SIGNATURE, withShogunMenuTheme } from '../menus/theme.js';
import { rememberRenderedOutput, isRenderedOutput, renderedOutputBody } from '../menus/renderedOutput.js';

const contexts = new WeakMap();
const TTL = 300_000;
const titles = {
    ping: 'CONEXÃO', statusbot: 'STATUS DO BOT', infobot: 'SOBRE O SHOGUN', botinfo: 'SOBRE O SHOGUN',
    criador: 'CRIADORES', prefix: 'PREFIXO', prefixo: 'PREFIXO', instagram: 'INSTAGRAM', ig: 'INSTAGRAM',
    igdl: 'INSTAGRAM', instavideo: 'INSTAGRAM', igstory: 'STORIES DO INSTAGRAM',
    perfil: 'PERFIL', ban: 'MODERAÇÃO', kick: 'MODERAÇÃO', advertir: 'ADVERTÊNCIA',
    ajuda: 'AJUDA', help: 'AJUDA', play: 'MÚSICA', play2: 'MÚSICA', playvid: 'VÍDEO',
    gpt: 'SHOGUN RESPONDE', assistente: 'SHOGUN RESPONDE', imagem: 'CRIAÇÃO DE IMAGEM',
    welcome: 'BOAS-VINDAS', bemvindo: 'BOAS-VINDAS', aluguel: 'ALUGUEL',
};
function clean(value) {
    return String(value ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').replace(/\r\n?/g, '\n');
}
function singleLine(value, literal = false) {
    const text = clean(value).replace(/\s+/gu, ' ').trim();
    return literal ? text : text.replace(/[*_~`]/g, '');
}
function isRendered(text) {
    return isRenderedOutput(text) || text.includes(SHOGUN_SIGNATURE);
}
function bodyLines(lines, side) {
    const result = []; let code = false;
    for (const line of lines.flatMap(value => clean(value).split('\n'))) {
        const fence = /^\s*```/.test(line);
        // Bordas dentro do bloco virariam parte do código copiado.
        if (fence || code) result.push(line);
        else result.push(line ? `${side}  ${line}` : side);
        if (fence) code = !code;
    }
    return result;
}
export function renderCommandCard({ title, fields = [], lines = [], theme: options = {} }) {
    const theme = withShogunMenuTheme(options);
    const header = theme.header.split('\n').filter(line => !/#nome#|#prefix#|\{userName\}|\{prefix\}/.test(line) || /#title#|#titulo#|\{botName\}/.test(line))
        .join('\n').replaceAll('#title#', singleLine(title)).replaceAll('#titulo#', singleLine(title))
        .replaceAll('{botName}', 'SHOGUN').replaceAll('#separator#', theme.separator)
        .replaceAll('#nome#', 'SHOGUN').replaceAll('{userName}', 'SHOGUN').replaceAll('#prefix#', '').replaceAll('{prefix}', '');
    const content = fields.flatMap(({ label, value, literal = false }) => {
        if (value === null || value === undefined || value === '') return [];
        const text = singleLine(value, literal);
        return text ? [`${singleLine(label)} › ${text}`] : [];
    });
    if (content.length && lines.length) content.push('');
    content.push(...lines);
    return rememberRenderedOutput([header, ...bodyLines(content, theme.middleBorder), theme.bottomBorder].filter(part => part !== '').join('\n'), { body: content.join('\n') });
}
function unframe(value) {
    if (!/^[\s\u200e]*[╭┌┏╔]/u.test(value)) return clean(value).split('\n');
    let code = false;
    return clean(value).split('\n').map(line => {
        const stripped = line.replace(/^[╭╮╰╯┌┐└┘┏┓┗┛╔╗╚╝├┤┣┫┊│┃─━═]+ ?/u, '')
            .replace(/[╮╯┐┘┓┛╗╝─━═]+\s*$/u, '');
        const fence = /^\s*```/.test(stripped);
        const result = code && !fence ? stripped : stripped.trim();
        if (fence) code = !code;
        return result;
    }).filter((line, i, all) => line || (i > 0 && i < all.length - 1));
}
export function formatCommandResponse(value, command, theme = {}) {
    if (typeof value !== 'string' || !value.trim() || isRendered(value)) return value;
    return renderCommandCard({ title: titles[command] || singleLine(command || 'AVISO').replace(/[_-]/g, ' ').toUpperCase(), lines: unframe(value), theme });
}
function outputStatus(content) {
    const value = content.text ?? content.caption ?? '';
    const text = typeof value === 'string' ? renderedOutputBody(value) : '';
    const first = text.split('\n').map(line => line.trim()).find(Boolean) || '';
    const plain = first.replace(/^[^\p{L}\p{N}`]+/u, '');
    if (/^(?:Buscando|Procurando|Criando|Baixando|Preparando|Processando|Trabalhando|Resolvendo|Aguarde|Um instante|Já estou|Gerando|Convertendo|Aplicando|Pesquisando|Traduzindo|Transcrevendo|Carregando|Enviando)\b/iu.test(plain)) return null;
    if (/^(?:❌|⚠️|⛔|🚫)/u.test(first) || /^(?:Não (?:consegui|foi|posso|é possível)|Erro\b|Falha\b|Este ajuste está disponível somente|Este comando é (?:apenas|exclusivo))/iu.test(plain)) return '⚠️';
    return ['text', 'caption', 'audio', 'image', 'video', 'document', 'sticker', 'contacts', 'location'].some(key => content[key] != null) ? '✅' : null;
}
function contextKey(chat, id) { return JSON.stringify([chat || '', id]); }
function getState(socket) {
    let state = contexts.get(socket);
    if (!state) { state = { quotes: new Map(), getTheme: () => ({}), global: false, installed: false }; contexts.set(socket, state); }
    return state;
}
function install(socket, state) {
    if (state.installed) return;
    state.installed = true;
    const send = socket.sendMessage.bind(socket);
    socket.sendMessage = async (target, content, options) => {
        const quote = options?.quoted?.key;
        const reactionContext = content?.react?.key && state.quotes.get(contextKey(target, content.react.key.id));
        if (reactionContext && !['⏳', '✅', '⚠️'].includes(content.react.text)) reactionContext.explicitReaction = true;
        const context = quote && (state.quotes.get(contextKey(target, quote.id)) || state.quotes.get(contextKey('', quote.id)));
        const active = context && Date.now() - context.createdAt < TTL ? context : null;
        if (context && !active) state.quotes.delete(contextKey(target, quote.id));
        const field = typeof content?.text === 'string' ? 'text' : typeof content?.caption === 'string' ? 'caption' : null;
        const rendered = field && !content.forward && (state.global || active)
            ? { ...content, [field]: formatCommandResponse(content[field], active?.command, state.getTheme()) }
            : content;
        const result = await send(target, rendered, options);
        if (state.global && active && !active.explicitReaction && !['instagram', 'ig', 'igdl', 'instavideo', 'igstory'].includes(active.command)) {
            const status = outputStatus(content);
            if (status && status !== active.lastStatus) {
                try { await send(target, { react: { text: status, key: quote } }); active.lastStatus = status; } catch { /* envio principal já confirmado */ }
            }
        }
        return result;
    };
}
export function installBotPresentation(socket, { getTheme } = {}) {
    const state = getState(socket);
    state.global = true;
    if (typeof getTheme === 'function') state.getTheme = getTheme;
    install(socket, state);
}
export function installCommandPresentation(socket, message, command) {
    if (!message?.key?.id || !command) return;
    const state = getState(socket);
    install(socket, state);
    state.quotes.set(contextKey(message.key.remoteJid, message.key.id), { command, createdAt: Date.now() });
    if (state.quotes.size > 500) state.quotes.delete(state.quotes.keys().next().value);
}
