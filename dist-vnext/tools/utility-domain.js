function socketOf(context) {
    const socket = context.socket;
    if (!socket || typeof socket.sendMessage !== 'function') {
        throw new Error('Socket legado não expõe sendMessage no domínio de ferramentas.');
    }
    return socket;
}
async function printSiteCommand(context) {
    try {
        const query = context.query.trim();
        if (!query) {
            await context.reply('Cade o link?');
            return;
        }
        await socketOf(context).sendMessage(context.groupId, { image: { url: `https://image.thum.io/get/fullpage/${query}` } }, { quoted: context.message });
    }
    catch (error) {
        console.error(error);
        await context.reply('❌ Ocorreu um erro interno. Tente novamente em alguns minutos.');
    }
}
async function zodiacSignsCommand(context) {
    await context.reply(`🔮 *Signos do Zodíaco*
      
      ♈ *Áries* (21/03 - 19/04)
      ♉ *Touro* (20/04 - 20/05)
      ♊ *Gêmeos* (21/05 - 20/06)
      ♋ *Câncer* (21/06 - 22/07)
      ♌ *Leão* (23/07 - 22/08)
      ♍ *Virgem* (23/08 - 22/09)
      ♎ *Libra* (23/09 - 22/10)
      ♏ *Escorpião* (23/10 - 21/11)
      ♐ *Sagitário* (22/11 - 21/12)
      ♑ *Capricórnio* (22/12 - 19/01)
      ♒ *Aquário* (20/01 - 18/02)
      ♓ *Peixes* (19/02 - 20/03)
      
      Use ${context.prefix}horoscopo <signo> para ver a previsão!`);
}
const HANDLERS = new Map();
function register(tokens, handler) {
    for (const token of tokens)
        HANDLERS.set(token, handler);
}
register(['printsite', 'ssweb'], printSiteCommand);
register(['signos'], zodiacSignsCommand);
export const UTILITY_TOOLS_NATIVE_COMMAND_TOKENS = Object.freeze([...HANDLERS.keys()]);
export class UtilityToolsDomainDispatchTarget {
    async dispatch(command, context) {
        const normalized = String(command || '').trim().toLowerCase();
        const handler = HANDLERS.get(normalized);
        if (!handler)
            return false;
        await handler({ ...context, command: normalized });
        return true;
    }
}
//# sourceMappingURL=utility-domain.js.map