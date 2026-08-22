import type { VNextCommandDispatchTarget } from '../runtime/compatibility-dispatch.js';
import { ensureAdminAccess } from './access.js';
import { adminAccess, type AdminExecutionContext } from './contracts.js';
import { isRecord, JsonGroupStateStore, type GroupStateRecord } from './state.js';

type Handler = (context: AdminExecutionContext) => Promise<void>;

type WarningRecord = Readonly<{
  reason: string;
  timestamp: number;
  issuer: string;
}>;

type WhitelistRecord = Readonly<{
  antis: readonly string[];
  addedBy: string;
  addedAt: string;
}>;

type ParticipantUpdateSocket = {
  groupParticipantsUpdate?: (
    groupId: string,
    participants: readonly string[],
    action: 'remove',
  ) => Promise<unknown>;
};

const VALID_WHITELIST_ANTIS = Object.freeze([
  'antilink',
  'antilinkgp',
  'antilinkhard',
  'antilinksoft',
  'antiporn',
  'antistatus',
  'antibtn',
  'antidoc',
  'antiloc',
  'antifig',
]);

function stateStore(context: AdminExecutionContext): JsonGroupStateStore {
  return new JsonGroupStateStore(context.groupFile, context.groupData);
}

function syncContext(context: AdminExecutionContext, state: GroupStateRecord): void {
  Object.assign(context.groupData, state);
}

function warningsOf(state: GroupStateRecord): Record<string, WarningRecord[]> {
  const source = isRecord(state.warnings) ? state.warnings : {};
  const output: Record<string, WarningRecord[]> = {};
  for (const [user, value] of Object.entries(source)) {
    if (!Array.isArray(value)) continue;
    output[user] = value.filter((item): item is WarningRecord => {
      if (!isRecord(item)) return false;
      return typeof item.reason === 'string'
        && typeof item.timestamp === 'number'
        && typeof item.issuer === 'string';
    });
  }
  return output;
}

function whitelistOf(state: GroupStateRecord): Record<string, WhitelistRecord> {
  const source = isRecord(state.adminWhitelist) ? state.adminWhitelist : {};
  const output: Record<string, WhitelistRecord> = {};
  for (const [user, value] of Object.entries(source)) {
    if (!isRecord(value) || !Array.isArray(value.antis)) continue;
    output[user] = {
      antis: value.antis.filter((item): item is string => typeof item === 'string'),
      addedBy: typeof value.addedBy === 'string' ? value.addedBy : '',
      addedAt: typeof value.addedAt === 'string' ? value.addedAt : '',
    };
  }
  return output;
}

function reasonFromQuery(context: AdminExecutionContext): string {
  const raw = context.query.trim();
  if (!raw) return 'Motivo não informado';
  const parts = raw.split(/\s+/u);
  if (parts[0]?.includes('@')) parts.shift();
  const reason = parts.join(' ').trim();
  return reason || 'Motivo não informado';
}

async function warnUser(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  const target = context.mentionedUser;
  if (!target) {
    await context.reply('Marque um usuário 🙄');
    return;
  }
  if (context.botIds.some((id) => context.identitiesMatch(id, target))) {
    await context.reply('❌ Não posso advertir a mim mesma!');
    return;
  }

  try {
    const store = stateStore(context);
    const state = store.read();
    const warnings = warningsOf(state);
    const current = warnings[target] ?? [];
    const reason = reasonFromQuery(context);
    current.push({ reason, timestamp: Date.now(), issuer: context.sender });
    warnings[target] = current;
    state.warnings = warnings;
    store.write(state);

    if (current.length >= 3) {
      const socket = context.socket as ParticipantUpdateSocket;
      if (typeof socket.groupParticipantsUpdate !== 'function') {
        throw new Error('Socket não expõe groupParticipantsUpdate.');
      }
      await socket.groupParticipantsUpdate(context.groupId, [target], 'remove');
      delete warnings[target];
      state.warnings = warnings;
      store.write(state);
      syncContext(context, state);
      await context.reply(
        `🚫 @${context.getUserName(target)} recebeu 3 advertências e foi banido!\nÚltima advertência: ${reason}`,
        { mentions: [target] },
      );
      return;
    }

    syncContext(context, state);
    await context.reply(
      `⚠️ @${context.getUserName(target)} recebeu uma advertência (${current.length}/3).\nMotivo: ${reason}`,
      { mentions: [target] },
    );
  } catch (error) {
    console.error('[vnext:admin:adv] falha:', error);
    await context.reply('Ocorreu um erro 💔');
  }
}

async function removeWarning(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  const target = context.mentionedUser;
  if (!target) {
    await context.reply('Marque um usuário 🙄');
    return;
  }
  try {
    const store = stateStore(context);
    const state = store.read();
    const warnings = warningsOf(state);
    const current = warnings[target] ?? [];
    if (current.length === 0) {
      await context.reply('❌ Este usuário não tem advertências.');
      return;
    }
    current.pop();
    if (current.length === 0) delete warnings[target];
    else warnings[target] = current;
    state.warnings = warnings;
    store.write(state);
    syncContext(context, state);
    await context.reply(
      `✅ Uma advertência foi removida de @${context.getUserName(target)}. Advertências restantes: ${current.length}/3`,
      { mentions: [target] },
    );
  } catch (error) {
    console.error('[vnext:admin:removeradv] falha:', error);
    await context.reply('Ocorreu um erro 💔');
  }
}

async function listWarnings(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  try {
    const warnings = warningsOf(stateStore(context).read());
    const entries = Object.entries(warnings).filter(([, values]) => values.length > 0);
    if (entries.length === 0) {
      await context.reply('📋 Não há advertências ativas no grupo.');
      return;
    }
    const mentions = new Set<string>();
    let text = '📋 *Lista de Advertências*\n\n';
    for (const [user, values] of entries) {
      mentions.add(user);
      text += `👤 @${context.getUserName(user)} (${values.length}/3)\n`;
      values.forEach((warning, index) => {
        mentions.add(warning.issuer);
        text += `  ${index + 1}. Motivo: ${warning.reason}\n`;
        text += `     Por: @${context.getUserName(warning.issuer)}\n`;
        text += `     Em: ${new Date(warning.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n`;
      });
      text += '\n';
    }
    await context.reply(text, { mentions: [...mentions] });
  } catch (error) {
    console.error('[vnext:admin:listadv] falha:', error);
    await context.reply('Ocorreu um erro 💔');
  }
}

async function addWhitelist(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  const target = context.mentionedUser;
  if (!target) {
    await context.reply(`📋 *Uso do comando:*\n      ${context.prefix}wl.add @usuario | anti1,anti2,anti3\n      \n      *Antis disponíveis:*\n      ${VALID_WHITELIST_ANTIS.map((anti) => `• ${anti}`).join('\n')}\n      \n      *Exemplo:*\n      ${context.prefix}wl.add @usuario | antilink,antistatus,antiporn`);
    return;
  }
  const pieces = context.query.split('|').map((value) => value.trim());
  const rawAntis = pieces.length > 1 ? pieces[1] : pieces[0];
  if (!rawAntis) {
    await context.reply(`⚠️ Especifique os antis após o |\n      \n      *Exemplo:*\n      ${context.prefix}wl.add @usuario | antilink,antistatus`);
    return;
  }
  const antis = rawAntis
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0 && !value.includes('@'));
  if (antis.length === 0) {
    await context.reply('⚠️ Nenhum anti válido foi especificado. Use o formato: antilink,antistatus,antiporn');
    return;
  }
  const invalid = antis.filter((anti) => !VALID_WHITELIST_ANTIS.includes(anti));
  if (invalid.length > 0) {
    await context.reply(`❌ Antis inválidos: ${invalid.join(', ')}\n\n*Válidos:* ${VALID_WHITELIST_ANTIS.join(', ')}`);
    return;
  }
  try {
    const store = stateStore(context);
    const state = store.read();
    const whitelist = whitelistOf(state);
    whitelist[target] = { antis, addedBy: context.sender, addedAt: new Date().toISOString() };
    state.adminWhitelist = whitelist;
    store.write(state);
    syncContext(context, state);
    await context.reply(
      `✅ @${context.getUserName(target)} adicionado à whitelist!\n\n*Antis ignorados:*\n${antis.map((anti) => `• ${anti}`).join('\n')}`,
      { mentions: [target] },
    );
  } catch (error) {
    console.error('[vnext:admin:wl.add] falha:', error);
    await context.reply('❌ Ocorreu um erro ao adicionar à whitelist.');
  }
}

async function removeWhitelist(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  const target = context.mentionedUser;
  if (!target) {
    await context.reply(`⚠️ Marque o usuário que deseja remover da whitelist.\n\nEx: ${context.prefix}wl.remove @usuario`);
    return;
  }
  try {
    const store = stateStore(context);
    const state = store.read();
    const whitelist = whitelistOf(state);
    if (!whitelist[target]) {
      await context.reply(`@${context.getUserName(target)} não está na whitelist.`, { mentions: [target] });
      return;
    }
    delete whitelist[target];
    state.adminWhitelist = whitelist;
    store.write(state);
    syncContext(context, state);
    await context.reply(`✅ @${context.getUserName(target)} removido da whitelist!`, { mentions: [target] });
  } catch (error) {
    console.error('[vnext:admin:wl.remove] falha:', error);
    await context.reply('❌ Ocorreu um erro ao remover da whitelist.');
  }
}

async function listWhitelist(context: AdminExecutionContext): Promise<void> {
  if (!context.isGroup) {
    await context.reply('Este comando só funciona em grupos.');
    return;
  }
  try {
    const entries = Object.entries(whitelistOf(stateStore(context).read()));
    if (entries.length === 0) {
      await context.reply('📋 Não há usuários na whitelist deste grupo.');
      return;
    }
    const mentions: string[] = [];
    let message = '📋 *Whitelist do Grupo*\n═══════════════════\n\n';
    entries.forEach(([userId, data], index) => {
      mentions.push(userId);
      message += `${index + 1}. @${context.getUserName(userId)}\n`;
      message += '   *Antis ignorados:*\n';
      data.antis.forEach((anti) => { message += `   • ${anti}\n`; });
      message += `   *Adicionado em:* ${new Date(data.addedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n\n`;
    });
    message += `═══════════════════\nTotal: ${entries.length} usuário(s)`;
    await context.reply(message, { mentions });
  } catch (error) {
    console.error('[vnext:admin:wl.lista] falha:', error);
    await context.reply('❌ Ocorreu um erro ao listar whitelist.');
  }
}

async function listBlacklist(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  try {
    const state = stateStore(context).read();
    const blacklist = isRecord(state.blacklist) ? state.blacklist : {};
    const entries = Object.entries(blacklist);
    if (entries.length === 0) {
      await context.reply('📋 A blacklist está vazia.');
      return;
    }
    let text = '📋 *Lista de Usuários na Blacklist*\n\n';
    for (const [user, raw] of entries) {
      const data = isRecord(raw) ? raw : {};
      const reason = typeof data.reason === 'string' ? data.reason : 'Motivo não informado';
      const timestamp = typeof data.timestamp === 'number' ? data.timestamp : 0;
      text += `👤 @${context.getUserName(user)}\n📝 Motivo: ${reason}\n🕒 Adicionado em: ${new Date(timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n\n`;
    }
    await context.reply(text, { mentions: entries.map(([user]) => user) });
  } catch (error) {
    console.error('[vnext:admin:listblacklist] falha:', error);
    await context.reply('Ocorreu um erro 💔');
  }
}

async function listModerators(context: AdminExecutionContext): Promise<void> {
  if (!context.isGroup) {
    await context.reply('Este comando só funciona em grupos.');
    return;
  }
  try {
    const moderators = Array.isArray(context.groupData.moderators)
      ? context.groupData.moderators.filter((item): item is string => typeof item === 'string')
      : [];
    if (moderators.length === 0) {
      await context.reply('🛡️ Não há moderadores definidos para este grupo.');
      return;
    }
    const body = moderators.map((id) => `➥ @${context.getUserName(id)}`).join('\n');
    await context.reply(`🛡️ *Moderadores do Grupo ${context.groupName}* 🛡️\n\n${body}\n`, { mentions: moderators });
  } catch (error) {
    console.error('[vnext:admin:listmods] falha:', error);
    await context.reply('Ocorreu um erro ao listar moderadores 💔');
  }
}

const HANDLERS = new Map<string, Handler>();
function register(tokens: readonly string[], handler: Handler): void {
  for (const token of tokens) {
    if (HANDLERS.has(token)) throw new Error(`Token administrativo duplicado: ${token}`);
    HANDLERS.set(token, handler);
  }
}

register(['adv', 'advertir', 'warning'], warnUser);
register(['removeradv', 'rmadv', 'unwarning'], removeWarning);
register(['listadv', 'warninglist'], listWarnings);
register(['wl.add', 'wladd', 'addwhitelist'], addWhitelist);
register(['wl.remove', 'wlremove', 'removewhitelist'], removeWhitelist);
register(['wl.lista', 'wllist', 'listawhitelist', 'whitelistlista'], listWhitelist);
register(['listblacklist'], listBlacklist);
register(['listmods', 'modlist'], listModerators);

export const ADMIN_COLLECTION_COMMAND_TOKENS = Object.freeze([...HANDLERS.keys()]);

export class AdminCollectionsDispatchTarget
implements VNextCommandDispatchTarget<AdminExecutionContext> {
  public async dispatch(command: string, context: AdminExecutionContext): Promise<boolean> {
    const handler = HANDLERS.get(String(command || '').trim().toLowerCase());
    if (!handler) return false;
    await handler(context);
    return true;
  }
}
