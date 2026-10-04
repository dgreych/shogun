import { SHOGUN_SIGNATURE, createShogunMenuTheme, withShogunMenuTheme } from './theme.js';
import { rememberRenderedOutput, isRenderedOutput, renderedOutputBody } from './rendered-output.js';


export interface PresentationKey { id?: string; remoteJid?: string; participant?: string; fromMe?: boolean }
export interface PresentationMessage { key?: PresentationKey }
export interface PresentationContent {
 text?: string; caption?: string; forward?: unknown;
 react?: { text: string; key: PresentationKey };
 [field: string]: unknown;
}
export interface PresentationOptions { quoted?: PresentationMessage; [field: string]: unknown }
export interface PresentationSocket { sendMessage(target: string, content: PresentationContent, options?: PresentationOptions): Promise<unknown> }
interface CommandContext { command: string; createdAt: number; explicitReaction?: boolean; lastStatus?: string }
interface PresentationState { quotes: Map<string, CommandContext>; getTheme: () => unknown; global: boolean; installed: boolean }
export interface CardField { label: unknown; value: unknown; literal?: boolean }
export interface CommandCard { title: unknown; fields?: CardField[]; lines?: string[]; theme?: unknown; icon?: string; state?: 'pending' | 'error' }

const contexts = new WeakMap<PresentationSocket, PresentationState>();
const TTL = 300_000;
const conversationCommands = new Set([
    'gpt', 'resumir', 'resumirurl', 'ideias', 'ideia', 'explicar', 'explique', 'corrigir', 'correcao',
    'resumirchat', 'resumirgrupo', 'resumirconversa', 'historia', 'story', 'gerarhistoria',
    'recomendar', 'recomendacao', 'recomendação', 'suggest',
    'gemma', 'phi', 'phi3', 'qwen2', 'qwen', 'qwen3', 'llama', 'llama3', 'baichuan', 'baichuan2',
    'marin', 'kimi', 'kimik2', 'mistral', 'magistral', 'rakutenai', 'rocket', 'yi', 'gemma2',
    'swallow', 'falcon', 'qwencoder', 'codegemma', 'cog', 'tradutor', 'translator',
    'debater', 'debate', 'historiainterativa', 'storyinteractive', 'aventura',
]);
const titles: Record<string, string> = {
    ping: 'CONEXÃO', statusbot: 'STATUS DO BOT', infobot: 'SOBRE O SHOGUN', botinfo: 'SOBRE O SHOGUN',
    criador: 'CRIADORES', prefix: 'PREFIXO', prefixo: 'PREFIXO', instagram: 'INSTAGRAM', ig: 'INSTAGRAM',
    igdl: 'INSTAGRAM', instavideo: 'INSTAGRAM', igstory: 'STORIES DO INSTAGRAM',
    perfil: 'PERFIL', ban: 'MODERAÇÃO', kick: 'MODERAÇÃO', advertir: 'ADVERTÊNCIA',
    ajuda: 'AJUDA', help: 'AJUDA', play: 'MÚSICA', play2: 'MÚSICA', playvid: 'VÍDEO',
    gpt: 'SHOGUN RESPONDE', assistente: 'ASSISTENTE DO GRUPO', assistent: 'ASSISTENTE DO GRUPO', imagem: 'CRIAÇÃO DE IMAGEM',
    welcome: 'BOAS-VINDAS', bemvindo: 'BOAS-VINDAS', aluguel: 'ALUGUEL',
    sticker: 'ATELIÊ DE FIGURINHAS', figu: 'ATELIÊ DE FIGURINHAS', brat: 'ATELIÊ DE FIGURINHAS',
    tiktok: 'TIKTOK', twitter: 'X / TWITTER', facebook: 'FACEBOOK', kwai: 'KWAI',
    spotify: 'SPOTIFY', soundcloud: 'SOUNDCLOUD', yt: 'YOUTUBE', ytmp3: 'YOUTUBE · ÁUDIO',
    mediafire: 'ARQUIVOS', gdrive: 'GOOGLE DRIVE', pinterest: 'PINTEREST', letra: 'LETRA DA MÚSICA',
    clima: 'PREVISÃO DO TEMPO', calc: 'CALCULADORA', tradutor: 'TRADUTOR', ssweb: 'CAPTURA DO SITE',
    perfilrpg: 'FICHA DE AVENTUREIRO', carteira: 'CARTEIRA', diario: 'RECOMPENSA DIÁRIA',
    topcmd: 'EM ALTA', rankativo: 'QUEM MOVIMENTA O GRUPO', regras: 'ACORDOS DO GRUPO',
    nomegp: 'IDENTIDADE DO GRUPO', setname: 'IDENTIDADE DO GRUPO', descgrupo: 'DESCRIÇÃO DO GRUPO',
    linkgp: 'CONVITE DO GRUPO', hidetag: 'CHAMADA DO GRUPO', marcar: 'CHAMADA DO GRUPO',
    grupo: 'PORTAS DO GRUPO', gp: 'PORTAS DO GRUPO', setprefix: 'PREFIXO DO GRUPO',
    menudesign: 'ATELIÊ DO SHOGUN', designmenu: 'ATELIÊ DO SHOGUN', resetdesign: 'ATELIÊ DO SHOGUN',
    afk: 'PAUSA ATIVADA', voltei: 'DE VOLTA AO GRUPO', conquistas: 'GALERIA DE CONQUISTAS',
    resumir: 'RESUMO', explicar: 'VAMOS DESCOMPLICAR', corrigir: 'REVISÃO DO TEXTO', ideias: 'LABORATÓRIO DE IDEIAS',
    historia: 'UMA HISTÓRIA PARA VOCÊ', recomendar: 'ESCOLHAS DO SHOGUN', resumirurl: 'RESUMO DO LINK',
    resumirchat: 'O QUE ROLOU NO GRUPO', regrasgp: 'ACORDOS DO GRUPO',
};
const titleIcons: Record<string, string> = {
    'CONEXÃO': '📡', 'STATUS DO BOT': '📡', 'SOBRE O SHOGUN': '🐈‍⬛', 'PERFIL': '👤',
    'MÚSICA': '🎧', 'SPOTIFY': '🎧', 'SOUNDCLOUD': '🎧', 'LETRA DA MÚSICA': '🎼',
    'INSTAGRAM': '📸', 'STORIES DO INSTAGRAM': '📸', 'VÍDEO': '🎬', 'TIKTOK': '🎬',
    'MODERAÇÃO': '🛡️', 'ADVERTÊNCIA': '🛡️', 'ACORDOS DO GRUPO': '📜',
    'FICHA DE AVENTUREIRO': '⚔️', 'CARTEIRA': '🪙', 'RECOMPENSA DIÁRIA': '🎁',
    'ATELIÊ DE FIGURINHAS': '🪄', 'ATELIÊ DO SHOGUN': '🎨', 'EM ALTA': '🏆',
    'PREVISÃO DO TEMPO': '🌤️', 'CRIAÇÃO DE IMAGEM': '🎨', 'TRADUTOR': '🌍',
    'BOAS-VINDAS': '👋', 'PAUSA ATIVADA': '🌙', 'DE VOLTA AO GRUPO': '🐾',
    'SHOGUN RESPONDE': '💭', 'RESUMO': '💭', 'VAMOS DESCOMPLICAR': '💡',
    'REVISÃO DO TEXTO': '✍️', 'LABORATÓRIO DE IDEIAS': '💡', 'AVISO': '🐾',
};
function clean(value: unknown) {
    return String(value ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').replace(/\r\n?/g, '\n');
}
function singleLine(value: unknown, literal = false) {
    const text = clean(value).replace(/\s+/gu, ' ').trim();
    return literal ? text : text.replace(/[*_~`]/g, '');
}
function isRendered(text: string) {
    return isRenderedOutput(text) || text.includes(SHOGUN_SIGNATURE);
}
function bodyLines(lines: string[], side: string) {
    const result: string[] = []; let code = false;
    for (const line of lines.flatMap(value => clean(value).split('\n'))) {
        const fence = /^\s*```/.test(line);
        // Bordas dentro do bloco virariam parte do código copiado.
        if (fence || code) result.push(line);
        else result.push(line ? `${side}  ${line}` : side);
        if (fence) code = !code;
    }
    return result;
}
export function renderCommandCard({ title, fields = [], lines = [], theme: options = {}, icon, state }: CommandCard): string {
    const theme = withShogunMenuTheme(options);
    const displayTitle = singleLine(title);
    const mark = state === 'pending' ? '⏳' : state === 'error' ? '⚠️' : icon || titleIcons[displayTitle] || '✦';
    const headline = `${mark} *${displayTitle}*${state === 'pending' ? ' · EM ANDAMENTO' : state === 'error' ? ' · NÃO FOI DESSA VEZ' : ''}`;
    const header = theme.header === createShogunMenuTheme().header
      ? `${SHOGUN_SIGNATURE}\n\n${theme.menuTopBorder} ${headline}\n`
      : theme.header.split('\n').filter(line => !/#nome#|#prefix#|#intro#|\{userName\}|\{prefix\}/.test(line) || /#title#|#titulo#|\{botName\}/.test(line))
        .join('\n').replaceAll('#title#', singleLine(title)).replaceAll('#titulo#', singleLine(title))
        .replaceAll('{botName}', 'SHOGUN').replaceAll('#separator#', theme.separator)
        .replaceAll('#nome#', 'SHOGUN').replaceAll('{userName}', 'SHOGUN').replaceAll('#prefix#', '').replaceAll('{prefix}', '')
        .replaceAll('#intro#', '').replaceAll('#footer#', '');
    const content = fields.flatMap(({ label, value, literal = false }) => {
        if (value === null || value === undefined || value === '') return [];
        const text = singleLine(value, literal);
        return text ? [`*${singleLine(label)}*  ${text}`] : [];
    });
    if (content.length && lines.length) content.push('');
    content.push(...lines);
    return rememberRenderedOutput([header, ...bodyLines(content, theme.middleBorder), theme.bottomBorder].filter(part => part !== '').join('\n'), { body: content.join('\n') });
}
function unframe(value: string) {
    const lines = clean(value).split('\n');
    let start = lines.findIndex(line => line.trim());
    if (start < 0) return lines;
    // Só aceitamos um preâmbulo de estado. Texto personalizado antes de um
    // desenho não transforma esse desenho em moldura do produto.
    if (/^[⚠❌⛔🚫]/u.test(lines[start]!.trim())) {
        start = lines.findIndex((line, index) => index > start && Boolean(line.trim()));
    }
    if (start < 0 || !/^[╭┌┏╔]/u.test(lines[start]!.trim())) return lines;
    let code = false;
    let end = -1;
    for (let index = start + 1; index < lines.length; index++) {
        const line = lines[index]!;
        const body = line.replace(/^[│┃] ?/u, '');
        if (/^\s*```/u.test(body)) { code = !code; continue; }
        if (!code && /^[╰└┗╚][─━═]/u.test(line.trim())) { end = index; break; }
    }
    if (end < 0) return lines;
    const frame = lines.slice(start, end + 1);
    if (!/\p{L}/u.test(frame[0]!) && !frame.some(line => /^[│┃]\s*[^\p{L}]*\*\p{L}/u.test(line))) return lines;
    code = false;
    for (const line of frame) {
        const body = line.replace(/^[│┃] ?/u, '');
        if (/^\s*```/u.test(body)) { code = !code; continue; }
        if (!code && (/[┬┼┴]/u.test(line) || /^[│┃].*[│┃]/u.test(line))) return lines;
    }
    let codeHasSide = false;
    code = false;
    return lines.map((line, index) => {
        if (index < start || index > end) return line;
        const body = line.replace(/^[│┃] ?/u, '');
        const fence = /^\s*```/u.test(body);
        if (code && !fence) return codeHasSide ? body : line;
        if (fence) {
            if (!code) codeHasSide = /^[│┃]/u.test(line);
            code = !code;
            return body.trim();
        }
        return line.replace(/^[╭╮╰╯┌┐└┘┏┓┗┛╔╗╚╝├┤┣┫┊│┃─━═]+ ?/u, '')
            .replace(/[╮╯┐┘┓┛╗╝─━═]+\s*$/u, '').trim();
    });
}
export function formatCommandResponse<T>(value: T, command?: string, theme: unknown = {}): T | string {
    if (typeof value !== 'string' || !value.trim() || isRendered(value)) return value;
    if (!command || conversationCommands.has(command)) return value;
    const status = outputStatus({ text: value });
    const state = status === '⚠️' ? 'error' : status === null ? 'pending' : undefined;
    return renderCommandCard({ title: (command ? titles[command] : undefined) || singleLine(command || 'AVISO').replace(/[_-]/g, ' ').toUpperCase(), lines: unframe(value), theme, ...(state ? { state } : {}) });
}
function outputStatus(content: PresentationContent) {
    const value = content.text ?? content.caption ?? '';
    const text = typeof value === 'string' ? renderedOutputBody(value) : '';
    const first = text.split('\n').map(line => line.trim()).find(Boolean) || '';
    const plain = first.replace(/^[^\p{L}\p{N}`]+/u, '');
    if (/^(?:Buscando|Procurando|Criando|Baixando|Preparando|Processando|Trabalhando|Resolvendo|Aguarde|Um instante|Já estou|Gerando|Convertendo|Aplicando|Pesquisando|Traduzindo|Transcrevendo|Carregando|Enviando)\b/iu.test(plain)) return null;
    if (/^(?:❌|⚠️|⛔|🚫)/u.test(first) || /^(?:Não (?:consegui|foi|posso|é possível)|Erro\b|Falha\b|Ocorreu um erro\b|Este ajuste está disponível somente|Este comando é (?:apenas|exclusivo|restrito)|Este comando (?:só|somente) (?:pode ser usado|funciona)|Use este comando em um grupo\b|(?:Somente|Apenas) (?:o |a |os |as )?(?:donos?|administradores?|admins?|adms?|subdonos?|moderadores?|criador)\b)/iu.test(plain)) return '⚠️';
    return ['text', 'caption', 'audio', 'image', 'video', 'document', 'sticker', 'contacts', 'location'].some(key => content[key] != null) ? '✅' : null;
}
function contextKey(chat: string | undefined, id: string | undefined) { return JSON.stringify([chat || '', id]); }
function getState(socket: PresentationSocket): PresentationState {
    let state = contexts.get(socket);
    if (!state) { state = { quotes: new Map(), getTheme: () => ({}), global: false, installed: false }; contexts.set(socket, state); }
    return state;
}
function install(socket: PresentationSocket, state: PresentationState) {
    if (state.installed) return;
    state.installed = true;
    const send = socket.sendMessage.bind(socket);
    socket.sendMessage = async (target, content, options) => {
        const quote = options?.quoted?.key;
        const reactionContext = content?.react?.key && state.quotes.get(contextKey(target, content.react.key.id));
        if (reactionContext && !['⏳', '✅', '⚠️'].includes(content.react!.text)) reactionContext.explicitReaction = true;
        const context = quote && (state.quotes.get(contextKey(target, quote.id)) || state.quotes.get(contextKey('', quote.id)));
        const active = context && Date.now() - context.createdAt < TTL ? context : null;
        if (context && !active && quote) state.quotes.delete(contextKey(target, quote.id));
        const field = typeof content?.text === 'string' ? 'text' : typeof content?.caption === 'string' ? 'caption' : null;
        const rendered = field && !content.forward && (state.global || active)
            ? { ...content, [field]: formatCommandResponse(content[field] as string, active?.command, state.getTheme()) }
            : content;
        const result = await send(target, rendered, options);
        if (state.global && active && !active.explicitReaction && !['instagram', 'ig', 'igdl', 'instavideo', 'igstory'].includes(active.command)) {
            const status = outputStatus(content);
            if (status && quote && status !== active.lastStatus) {
                try { await send(target, { react: { text: status, key: quote } }); active.lastStatus = status; } catch { /* envio principal já confirmado */ }
            }
        }
        return result;
    };
}
export function installBotPresentation(socket: PresentationSocket, { getTheme }: { getTheme?: () => unknown } = {}) {
    const state = getState(socket);
    state.global = true;
    if (typeof getTheme === 'function') state.getTheme = getTheme;
    install(socket, state);
}
export function installCommandPresentation(socket: PresentationSocket, message: PresentationMessage | undefined, command: string | undefined) {
    if (!message?.key?.id || !command) return;
    const state = getState(socket);
    install(socket, state);
    state.quotes.set(contextKey(message.key.remoteJid, message.key.id), { command, createdAt: Date.now() });
    if (state.quotes.size > 500) { const first = state.quotes.keys().next().value; if (first !== undefined) state.quotes.delete(first); }
}
