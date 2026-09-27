function singleLine(value, literal = false) {
    const text = String(value ?? '')
        .replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
    return literal ? text : text.replace(/[*_~`]/g, '');
}

// O quadro organiza o texto; permissão e envio ficam com o comando.
export function renderCommandCard({ title, fields = [], lines = [] }) {
    const content = [];
    for (const { label, value, literal = false } of fields) {
        if (value === null || value === undefined || value === '') continue;
        const rendered = singleLine(value, literal);
        if (rendered) content.push(`┃  ${singleLine(label)} › ${rendered}`);
    }
    const help = lines.map(line => singleLine(line, true)).filter(Boolean);
    if (content.length && help.length) content.push('┃');
    content.push(...help.map(line => `┃  ${line}`));
    return [
        '╭━━━─〔 🐈‍⬛ SHOGUN 〕─━━━',
        `┃  *${singleLine(title)}*`,
        '┃',
        ...content,
        '┃',
        '╰━━━─〔 SHOGUN 〕─━━━━',
    ].join('\n');
}

export function formatCommandResponse(value, command) {
    if (typeof value !== 'string' || !value.trim()) return value;
    if (value.includes('〔 🐈‍⬛ SHOGUN 〕') || value.includes('```')) return value;
    const titles = { ping: 'CONEXÃO', statusbot: 'STATUS', infobot: 'STATUS', botinfo: 'STATUS', criador: 'CRIADOR', prefix: 'PREFIXO', prefixo: 'PREFIXO' };
    const framed = /^[\s\u200e]*[╭┌┏╔]/u.test(value);
    const lines = value.split('\n').map(line => framed
        ? line.replace(/^[\s╭╮╰╯┌┐└┘┏┓┗┛╔╗╚╝├┤┣┫┊│┃─━═]+/u, '').replace(/[╮╯┐┘┓┛╗╝─━═]+\s*$/u, '').trim()
        : line.trim());
    if (framed) { lines.shift(); while (lines.length && !lines.at(-1)) lines.pop(); }
    return renderCommandCard({ title: titles[command] || String(command || 'SHOGUN').toUpperCase(), lines });
}

const commandContexts = new WeakMap();

export function installCommandPresentation(socket, message, command) {
    if (!message?.key?.id || !command) return;
    let state = commandContexts.get(socket);
    if (!state) {
        state = { quotes: new Map(), send: socket.sendMessage.bind(socket) };
        commandContexts.set(socket, state);
        socket.sendMessage = async (target, content, options) => {
            const context = state.quotes.get(options?.quoted?.key?.id);
            const field = typeof content?.text === 'string' ? 'text' : typeof content?.caption === 'string' ? 'caption' : null;
            const rendered = context && Date.now() - context.createdAt < 300_000 && field
                ? { ...content, [field]: formatCommandResponse(content[field], context.command) }
                : content;
            return state.send(target, rendered, options);
        };
    }
    state.quotes.set(message.key.id, { command, createdAt: Date.now() });
    if (state.quotes.size > 500) state.quotes.delete(state.quotes.keys().next().value);
}
