import type { VNextCommandDispatchTarget } from '../runtime/compatibility-dispatch.js';
import { ensureAdminAccess } from './access.js';
import { adminAccess, type AdminExecutionContext } from './contracts.js';
import {
  isRecord,
  JsonGroupStateStore,
  type GroupStateRecord,
} from './state.js';

type AdminSettingsHandler = (context: AdminExecutionContext) => Promise<void>;

function argsOf(context: AdminExecutionContext): readonly string[] {
  if (context.args && context.args.length > 0) return context.args;
  const query = context.query.trim();
  return query ? query.split(/\s+/u) : [];
}

function normalizeBlockedCommand(value: string, prefix: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replaceAll(prefix, '');
}

async function withGroupState(
  context: AdminExecutionContext,
  mutator: (state: GroupStateRecord) => string | Promise<string>,
  errorMessage: string,
): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  try {
    const store = new JsonGroupStateStore(context.groupFile, context.groupData);
    const state = store.read();
    const reply = await mutator(state);
    store.write(state);
    Object.assign(context.groupData, state);
    await context.reply(reply);
  } catch (error) {
    console.error('[vnext:admin:settings] falha:', error);
    await context.reply(errorMessage);
  }
}

async function setBamMessage(context: AdminExecutionContext): Promise<void> {
  const q = context.query.trim();
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  if (!q) {
    await context.reply(
      `📝 *Configurar Mensagem do Bam*\n\nUse: ${context.prefix}setbammsg <mensagem>\n\n*Variável disponível:*\n#user# - Será substituído pelo nome do usuário\n\n*Exemplo:*\n${context.prefix}setbammsg 😂 Era só uma pegadinha #user#!\n\nPara ver a mensagem atual: ${context.prefix}verbammsg\nPara resetar: ${context.prefix}resetbammsg`,
    );
    return;
  }
  await withGroupState(
    context,
    (state) => {
      state.bamMessage = q;
      return `✅ *Mensagem do bam configurada!*\n\n📝 Nova mensagem:\n${q}\n\n💡 Use #user# para mencionar o usuário marcado.`;
    },
    'ocorreu um erro 💔',
  );
}

async function setMessageLimit(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  const args = argsOf(context);
  if (!context.query.trim()) {
    await context.reply(
      `📝 Configure o limite de mensagens! Exemplo: ${context.prefix}limitmessage 5 1m ban\n`
      + `Formato: ${context.prefix}limitmessage <quantidade> <tempo> <ação>\n`
      + 'Tempo: s (segundos), m (minutos), h (horas)\n'
      + 'Ação: ban (banimento direto) ou adv (advertências)',
    );
    return;
  }
  if (args.length !== 3) {
    await context.reply(`  ❌ Formato inválido! Use: ${context.prefix}limitmessage <quantidade> <tempo> <ação>`);
    return;
  }

  const limit = Number.parseInt(args[0] ?? '', 10);
  const timeInput = (args[1] ?? '').toLowerCase();
  const action = (args[2] ?? '').toLowerCase();
  if (action !== 'ban' && action !== 'adv') {
    await context.reply("❌ Ação inválida! Use 'ban' para banimento direto ou 'adv' para advertências.");
    return;
  }
  const match = /^(\d+)(s|m|h)$/u.exec(timeInput);
  if (!match) {
    await context.reply('❌ Tempo inválido! Use formatos como 20s, 1m ou 2h.');
    return;
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    await context.reply('❌ Quantidade de mensagens deve ser um número positivo!');
    return;
  }
  const magnitude = Number.parseInt(match[1] ?? '0', 10);
  const unit = match[2];
  const interval = unit === 's' ? magnitude : unit === 'm' ? magnitude * 60 : magnitude * 3600;

  try {
    const store = new JsonGroupStateStore(context.groupFile, context.groupData);
    const state = store.read();
    const previous = isRecord(state.messageLimit) ? state.messageLimit : {};
    state.messageLimit = {
      enabled: true,
      limit,
      interval,
      action,
      warnings: isRecord(previous.warnings) ? previous.warnings : {},
      users: isRecord(previous.users) ? previous.users : {},
    };
    store.write(state);
    Object.assign(context.groupData, state);
    const actionText = action === 'ban' ? 'banimento direto' : 'advertências (ban após 3)';
    await context.reply(`✅ Limite de mensagens configurado: ${limit} mensagens a cada ${timeInput} com ${actionText}!`);
  } catch (error) {
    console.error('[vnext:admin:limitmessage] falha:', error);
    await context.reply('❌ Ocorreu um erro interno. Tente novamente em alguns minutos.');
  }
}

async function deleteMessageLimit(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  try {
    const store = new JsonGroupStateStore(context.groupFile, context.groupData);
    const state = store.read();
    if (!state.messageLimit) {
      await context.reply('📴 O limite de mensagens não está ativo neste grupo.');
      return;
    }
    delete state.messageLimit;
    store.write(state);
    Object.assign(context.groupData, state);
    await context.reply('🗑️ Sistema de limite de mensagens desativado com sucesso!');
  } catch (error) {
    console.error('[vnext:admin:dellimitmessage] falha:', error);
    await context.reply('❌ Ocorreu um erro interno. Tente novamente em alguns minutos.');
  }
}

async function setPrefix(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  const raw = context.query.trim();
  if (!raw) {
    await context.reply(`Por favor, forneça o novo prefixo. Exemplo: ${context.groupPrefix}setprefix !`);
    return;
  }
  let next = raw;
  let reserved = false;
  if (next === '$') {
    next = '/';
    reserved = true;
  }
  if (next.length > 1) {
    await context.reply('🤔 O prefixo deve ter no máximo 1 digito.');
    return;
  }
  if (/\s/u.test(next)) {
    await context.reply('🤔 O prefixo não pode conter espaços.');
    return;
  }
  try {
    const store = new JsonGroupStateStore(context.groupFile, context.groupData);
    const state = store.read();
    state.customPrefix = next;
    store.write(state);
    Object.assign(context.groupData, state);
    await context.reply(
      reserved
        ? '⚠️ O símbolo "$" é reservado e não pode ser usado como prefixo.\n✅ Prefixo alterado automaticamente para "/" neste grupo!'
        : `✅ Prefixo do bot alterado para "${next}" neste grupo!`,
    );
  } catch (error) {
    console.error('[vnext:admin:setprefix] falha:', error);
    await context.reply('Ocorreu um erro ao alterar o prefixo 💔');
  }
}

async function setExitMessage(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  const q = context.query.trim();
  if (!q) {
    await context.reply(
      `📝 Para configurar a mensagem de saída, use:\n${context.prefix}configsaida <mensagem>\n\nVocê pode usar:\n#numerodele# - Menciona quem saiu\n#nomedogp# - Nome do grupo\n#membros# - Total de membros\n#desc# - Descrição do grupo`,
    );
    return;
  }
  try {
    const store = new JsonGroupStateStore(context.groupFile, context.groupData);
    const state = store.read();
    const exit = isRecord(state.exit) ? { ...state.exit } : {};
    exit.enabled = true;
    exit.text = q;
    state.exit = exit;
    store.write(state);
    Object.assign(context.groupData, state);
    await context.reply(`✅ Mensagem de saída configurada com sucesso!\n\n📝 Mensagem definida como:\n${q}`);
  } catch (error) {
    console.error('[vnext:admin:configsaida] falha:', error);
    await context.reply('❌ Ocorreu um erro interno. Tente novamente em alguns minutos.');
  }
}

async function toggleExit(context: AdminExecutionContext): Promise<void> {
  await withGroupState(
    context,
    (state) => {
      const exit = isRecord(state.exit) ? { ...state.exit } : {};
      const enabled = exit.enabled !== true;
      exit.enabled = enabled;
      state.exit = exit;
      return enabled ? '✅ Mensagens de saída ativadas!' : '❌ Mensagens de saída desativadas!';
    },
    '❌ Ocorreu um erro interno. Tente novamente em alguns minutos.',
  );
}

async function toggleAntiSticker(context: AdminExecutionContext): Promise<void> {
  await withGroupState(
    context,
    (state) => {
      const antifig = isRecord(state.antifig) ? { ...state.antifig } : {};
      const enabled = antifig.enabled !== true;
      antifig.enabled = enabled;
      state.antifig = antifig;
      return `✅ Antifig ${enabled ? 'ativado' : 'desativado'}! Figurinhas ${enabled ? 'serão apagadas e o remetente receberá advertências' : 'agora são permitidas'}.`;
    },
    'Ocorreu um erro ao gerenciar o antifig 💔',
  );
}

async function setWelcomeText(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  const q = context.query.trim();
  if (!q) {
    await context.reply(
      `📝 *Configuração da Mensagem de Boas-Vindas*\n\nPara definir uma mensagem personalizada, digite o comando seguido do texto desejado. Você pode usar as seguintes variáveis:\n\n- *#numerodele#* → Marca o novo membro.\n- *#nomedogp#* → Nome do grupo.\n- *#desc#* → Descrição do grupo.\n- *#membros#* → Número total de membros no grupo.\n\n📌 *Exemplo:*\n${context.groupPrefix}legendabv Bem-vindo(a) #numerodele# ao grupo *#nomedogp#*! Agora somos #membros# membros. Leia a descrição: #desc#`,
    );
    return;
  }
  await withGroupState(
    context,
    (state) => {
      state.textbv = q;
      return `✅ *Mensagem de boas-vindas configurada com sucesso!*\n\n📌 Nova mensagem:\n"${q}"`;
    },
    '❌ Ocorreu um erro interno. Tente novamente em alguns minutos.',
  );
}

async function blockCommand(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  const q = context.query.trim();
  if (!q) {
    await context.reply(`❌ Digite o comando que deseja bloquear. Exemplo: ${context.prefix}blockcmd sticker`);
    return;
  }
  await withGroupState(
    context,
    (state) => {
      const blocked = isRecord(state.blockedCommands) ? { ...state.blockedCommands } : {};
      blocked[normalizeBlockedCommand(q, context.prefix)] = true;
      state.blockedCommands = blocked;
      return `✅ O comando *${q}* foi bloqueado e só pode ser usado por administradores.`;
    },
    'ocorreu um erro 💔',
  );
}

async function unblockCommand(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  const q = context.query.trim();
  if (!q) {
    await context.reply(`❌ Digite o comando que deseja desbloquear. Exemplo: ${context.prefix}unblockcmd sticker`);
    return;
  }
  try {
    const store = new JsonGroupStateStore(context.groupFile, context.groupData);
    const state = store.read();
    const blocked = isRecord(state.blockedCommands) ? { ...state.blockedCommands } : {};
    const key = normalizeBlockedCommand(q, context.prefix);
    if (blocked[key] !== true) {
      await context.reply('❌ Este comando não está bloqueado.');
      return;
    }
    delete blocked[key];
    state.blockedCommands = blocked;
    store.write(state);
    Object.assign(context.groupData, state);
    await context.reply(`✅ O comando *${q}* foi desbloqueado e pode ser usado por todos.`);
  } catch (error) {
    console.error('[vnext:admin:unblockcmd] falha:', error);
    await context.reply('ocorreu um erro 💔');
  }
}

async function addRule(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  const q = context.query.trim();
  if (!q) {
    await context.reply(`📝 Por favor, forneça o texto da regra. Ex: ${context.prefix}addregra Proibido spam.`);
    return;
  }
  await withGroupState(
    context,
    (state) => {
      const rules = Array.isArray(state.rules)
        ? state.rules.filter((item): item is string => typeof item === 'string')
        : [];
      rules.push(q);
      state.rules = rules;
      return `✅ Regra adicionada com sucesso!\n      ${rules.length}. ${q}`;
    },
    'Ocorreu um erro ao adicionar a regra 💔',
  );
}

async function deleteRule(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  const q = context.query.trim();
  const ruleNumber = Number.parseInt(q, 10);
  if (!q || Number.isNaN(ruleNumber)) {
    await context.reply(`🔢 Por favor, forneça o número da regra a ser removida. Ex: ${context.prefix}delregra 3`);
    return;
  }
  try {
    const store = new JsonGroupStateStore(context.groupFile, context.groupData);
    const state = store.read();
    const rules = Array.isArray(state.rules)
      ? state.rules.filter((item): item is string => typeof item === 'string')
      : [];
    if (ruleNumber < 1 || ruleNumber > rules.length) {
      await context.reply(`❌ Número de regra inválido. Use ${context.prefix}regras para ver a lista. Atualmente existem ${rules.length} regras.`);
      return;
    }
    const removed = rules.splice(ruleNumber - 1, 1)[0] ?? '';
    state.rules = rules;
    store.write(state);
    Object.assign(context.groupData, state);
    await context.reply(`🗑️ Regra "${removed}" removida com sucesso!`);
  } catch (error) {
    console.error('[vnext:admin:delregra] falha:', error);
    await context.reply('Ocorreu um erro ao remover a regra 💔');
  }
}

async function setMinimumMessage(context: AdminExecutionContext): Promise<void> {
  if (!(await ensureAdminAccess(context, adminAccess()))) return;
  const args = argsOf(context);
  const first = (args[0] ?? '').toLowerCase();
  if (!first) {
    await context.reply(`Uso: ${context.prefix}minmessage <mínimo de dígitos> <ban/adv> ou ${context.prefix}minmessage off`);
    return;
  }
  try {
    const store = new JsonGroupStateStore(context.groupFile, context.groupData);
    const state = store.read();
    if (first === 'off') {
      delete state.minMessage;
      store.write(state);
      Object.assign(context.groupData, state);
      await context.reply('✅ Sistema de legenda mínima desativado.');
      return;
    }
    const minDigits = Number.parseInt(first, 10);
    const action = (args[1] ?? '').toLowerCase();
    if (!Number.isFinite(minDigits) || minDigits < 1 || (action !== 'ban' && action !== 'adv')) {
      await context.reply(`Formato inválido. Use: ${context.prefix}minmessage <número positivo> <ban/adv>`);
      return;
    }
    state.minMessage = { minDigits, action };
    store.write(state);
    Object.assign(context.groupData, state);
    await context.reply(`✅ Configurado: Mínimo de ${minDigits} caracteres em legendas de fotos/vídeos. Ação em violação: ${action === 'ban' ? 'banir' : 'advertir'}.`);
  } catch (error) {
    console.error('[vnext:admin:minmessage] falha:', error);
    await context.reply('Ocorreu um erro ao configurar 💔');
  }
}

const HANDLERS = new Map<string, AdminSettingsHandler>();

function register(tokens: readonly string[], handler: AdminSettingsHandler): void {
  for (const token of tokens) {
    if (HANDLERS.has(token)) throw new Error(`Token administrativo duplicado: ${token}`);
    HANDLERS.set(token, handler);
  }
}

register(['setbammsg', 'editarbam'], setBamMessage);
register(['limitmessage'], setMessageLimit);
register(['dellimitmessage'], deleteMessageLimit);
register(['setprefix'], setPrefix);
register(['configsaida', 'textsaiu', 'legendasaiu', 'exitmsg'], setExitMessage);
register(['saida', 'exit'], toggleExit);
register(['antifig'], toggleAntiSticker);
register(['legendabv', 'textbv', 'welcomemsg'], setWelcomeText);
register(['blockcmd'], blockCommand);
register(['unblockcmd'], unblockCommand);
register(['addregra', 'addrule'], addRule);
register(['delregra', 'delrule'], deleteRule);
register(['minmessage'], setMinimumMessage);

export const ADMIN_SETTINGS_COMMAND_TOKENS = Object.freeze([...HANDLERS.keys()]);

export class AdminSettingsDispatchTarget
implements VNextCommandDispatchTarget<AdminExecutionContext> {
  public async dispatch(command: string, context: AdminExecutionContext): Promise<boolean> {
    const handler = HANDLERS.get(String(command || '').trim().toLowerCase());
    if (!handler) return false;
    await handler(context);
    return true;
  }
}
