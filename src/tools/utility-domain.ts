import type { MacrotrancheExecutionContext } from '../macrotranche/domain.js';
import type { VNextCommandDispatchTarget } from '../runtime/compatibility-dispatch.js';

type UtilitySocket = {
  sendMessage(jid: string, content: unknown, options?: unknown): Promise<unknown>;
};

export interface UtilityToolsExecutionContext extends MacrotrancheExecutionContext {
  readonly command: string;
}

type Handler = (context: UtilityToolsExecutionContext) => Promise<void>;

function socketOf(context: UtilityToolsExecutionContext): UtilitySocket {
  const socket = context.socket as Partial<UtilitySocket>;
  if (!socket || typeof socket.sendMessage !== 'function') {
    throw new Error('Socket legado não expõe sendMessage no domínio de ferramentas.');
  }
  return socket as UtilitySocket;
}

async function printSiteCommand(context: UtilityToolsExecutionContext): Promise<void> {
  try {
    const query = context.query.trim();
    if (!query) {
      await context.reply('Cade o link?');
      return;
    }

    await socketOf(context).sendMessage(
      context.groupId,
      { image: { url: `https://image.thum.io/get/fullpage/${query}` } },
      { quoted: context.message },
    );
  } catch (error) {
    console.error(error);
    await context.reply('❌ Ocorreu um erro interno. Tente novamente em alguns minutos.');
  }
}

async function zodiacSignsCommand(context: UtilityToolsExecutionContext): Promise<void> {
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

const HANDLERS = new Map<string, Handler>();
function register(tokens: readonly string[], handler: Handler): void {
  for (const token of tokens) HANDLERS.set(token, handler);
}

register(['printsite', 'ssweb'], printSiteCommand);
register(['signos'], zodiacSignsCommand);

export const UTILITY_TOOLS_NATIVE_COMMAND_TOKENS = Object.freeze([...HANDLERS.keys()]);

export class UtilityToolsDomainDispatchTarget
implements VNextCommandDispatchTarget<UtilityToolsExecutionContext> {
  async dispatch(command: string, context: UtilityToolsExecutionContext): Promise<boolean> {
    const normalized = String(command || '').trim().toLowerCase();
    const handler = HANDLERS.get(normalized);
    if (!handler) return false;
    await handler({ ...context, command: normalized });
    return true;
  }
}
