import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { BaileysAdminGroupPort } from '../admin/group-port.js';
import { isRecord } from '../admin/state.js';
import type { MacrotrancheExecutionContext } from '../macrotranche/domain.js';
import type { VNextCommandDispatchTarget } from '../runtime/compatibility-dispatch.js';

type ToolReply = { readonly message: string };

interface NotesPort {
  addNote(sender: string, text: string, parent: null, prefix: string): ToolReply;
  getNote(sender: string, id: number, prefix: string): ToolReply;
  deleteNote(sender: string, id: number): ToolReply;
  togglePin(sender: string, id: number): ToolReply;
  searchNotes(sender: string, query: string): ToolReply;
  listNotes(sender: string, page: number, pageSize: number, prefix: string): ToolReply;
}

interface CalculatorPort {
  calculate(expression: string, prefix: string): ToolReply;
  convert(value: number, from: string, to: string): ToolReply;
}

interface ReminderRecord {
  readonly id: string;
  readonly userId: string;
  readonly chatId?: string;
  readonly createdByName?: string;
  readonly createdAt?: string;
  readonly at: number;
  readonly message: string;
  readonly status: string;
}

interface ReminderInput {
  readonly at: number;
  readonly message: string;
}

interface OptimizerPort {
  memoize<T>(key: string, loader: () => Promise<T> | T, ttlMs: number): Promise<T>;
  clearStatic(key: string): void;
}

export interface ToolsExecutionContext extends MacrotrancheExecutionContext {
  readonly notes?: NotesPort | null;
  readonly calculator?: CalculatorPort | null;
  readonly loadReminders?: (() => ReminderRecord[]) | null;
  readonly saveReminders?: ((items: ReminderRecord[]) => void) | null;
  readonly optimizer?: OptimizerPort | null;
  readonly parseReminderInput?: ((query: string) => ReminderInput | null) | null;
  readonly tzFormat?: ((timestamp: number) => string) | null;
}

type Handler = (context: ToolsExecutionContext) => Promise<void>;

type BirthdayRecord = {
  readonly dia: number;
  readonly mes: number;
  readonly nome: string;
};

const TIMEZONES = Object.freeze<Record<string, string>>({
  brasil: 'America/Sao_Paulo', br: 'America/Sao_Paulo', saopaulo: 'America/Sao_Paulo',
  sp: 'America/Sao_Paulo', rio: 'America/Sao_Paulo', brasilia: 'America/Sao_Paulo',
  manaus: 'America/Manaus', am: 'America/Manaus', acre: 'America/Rio_Branco',
  fernando: 'America/Noronha', eua: 'America/New_York', usa: 'America/New_York',
  newyork: 'America/New_York', ny: 'America/New_York', losangeles: 'America/Los_Angeles',
  la: 'America/Los_Angeles', california: 'America/Los_Angeles', japao: 'Asia/Tokyo',
  japan: 'Asia/Tokyo', tokyo: 'Asia/Tokyo', china: 'Asia/Shanghai', pequim: 'Asia/Shanghai',
  coreia: 'Asia/Seoul', korea: 'Asia/Seoul', seul: 'Asia/Seoul', londres: 'Europe/London',
  london: 'Europe/London', uk: 'Europe/London', paris: 'Europe/Paris', franca: 'Europe/Paris',
  berlin: 'Europe/Berlin', alemanha: 'Europe/Berlin', portugal: 'Europe/Lisbon',
  lisboa: 'Europe/Lisbon', moscow: 'Europe/Moscow', russia: 'Europe/Moscow', dubai: 'Asia/Dubai',
  india: 'Asia/Kolkata', australia: 'Australia/Sydney', sydney: 'Australia/Sydney',
  argentina: 'America/Argentina/Buenos_Aires', buenosaires: 'America/Argentina/Buenos_Aires',
});

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/\s+/gu, '');
}

function argsOf(context: ToolsExecutionContext): string[] {
  return context.query.trim().split(/\s+/u).filter(Boolean);
}

function requiredService<T>(value: T | null | undefined, label: string): T {
  if (value == null) throw new Error(`Serviço legado indisponível: ${label}`);
  return value;
}

async function timeCommand(context: ToolsExecutionContext): Promise<void> {
  const query = context.query.trim();
  const now = new Date();
  if (!query) {
    const time = now.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const date = now.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
    await context.reply(`🕐 *Horário Atual*\n\n🇧🇷 *Brasil (Brasília):*\n⏰ ${time}\n📅 ${date}\n\n💡 *Ver outro fuso:*\n${context.prefix}hora <local>\n\n📍 *Locais disponíveis:*\nbrasil, eua, japao, china, coreia, londres, paris, portugal, dubai, australia, argentina...`);
    return;
  }
  const timezone = TIMEZONES[normalize(query)];
  if (!timezone) {
    await context.reply(`❌ Fuso horário "${query}" não encontrado!\n\n📍 *Locais disponíveis:*\nbrasil, eua, newyork, losangeles, japao, china, coreia, londres, paris, alemanha, portugal, russia, dubai, india, australia, argentina`);
    return;
  }
  try {
    const time = now.toLocaleString('pt-BR', {
      timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const date = now.toLocaleDateString('pt-BR', {
      timeZone: timezone, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
    const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const diffHours = Math.round((localTime.getTime() - brTime.getTime()) / 3_600_000);
    const diff = diffHours >= 0 ? `+${diffHours}h` : `${diffHours}h`;
    await context.reply(`🕐 *Horário em ${query}*\n\n⏰ *Hora:* ${time}\n📅 *Data:* ${date}\n\n🇧🇷 *Diferença do Brasil:* ${diff}`);
  } catch (error) {
    console.error('[vnext:tools:hora] falha:', error);
    await context.reply('❌ Erro ao obter o horário. Tente novamente!');
  }
}

async function groupStats(context: ToolsExecutionContext): Promise<void> {
  if (!context.isGroup) {
    await context.reply('⚠️ Este comando só funciona em grupos!');
    return;
  }
  await context.reply('📊 Calculando estatísticas do grupo... ⏳');
  try {
    const metadata = await new BaileysAdminGroupPort(context.socket).metadata(context.groupId);
    const members = metadata.participants.length;
    const admins = metadata.participants.filter((participant) => Boolean(participant.admin)).length;
    const rawCreation = (metadata as unknown as Record<string, unknown>).creation;
    const creation = typeof rawCreation === 'number'
      ? new Date(rawCreation * 1000).toLocaleDateString('pt-BR')
      : 'Desconhecido';
    const description = metadata.desc || 'Sem descrição';

    let activityStats = '';
    if (isRecord(context.groupData.activity)) {
      const activity = context.groupData.activity;
      const total = typeof activity.totalMessages === 'number' ? activity.totalMessages : 0;
      const today = new Date().toISOString().split('T')[0] ?? '';
      const daily = isRecord(activity.daily) ? activity.daily : {};
      const todayMessages = typeof daily[today] === 'number' ? daily[today] : 0;
      activityStats = `\n\n📈 *Atividade:*\n• Total de mensagens: ${total.toLocaleString()}\n• Mensagens hoje: ${todayMessages}`;
    }

    const resources: string[] = [];
    if (context.groupData.modorpg) resources.push('⚔️ Modo RPG');
    if (context.groupData.welcome) resources.push('👋 Boas-vindas');
    if (context.groupData.antifake) resources.push('🛡️ Anti-fake');
    if (context.groupData.antilink) resources.push('🔗 Anti-link');
    if (context.groupData.antilinksoft) resources.push('🔗 Anti-link Soft');
    if (context.groupData.antiflood) resources.push('🌊 Anti-flood');
    const resourceText = resources.length > 0 ? `\n\n✨ *Recursos ativos:*\n${resources.join('\n')}` : '';

    await context.reply(`📊 *Estatísticas do Grupo*\n\n📛 *Nome:* ${metadata.subject || 'Grupo'}\n📅 *Criado em:* ${creation}\n\n👥 *Membros:* ${members}\n👑 *Admins:* ${admins}\n👤 *Membros comuns:* ${members - admins}${activityStats}${resourceText}\n\n📝 *Descrição:*\n${description.substring(0, 200)}${description.length > 200 ? '...' : ''}`);
  } catch (error) {
    console.error('[vnext:tools:groupstats] falha:', error);
    await context.reply('❌ Erro ao obter estatísticas do grupo.');
  }
}

async function noteCommand(context: ToolsExecutionContext): Promise<void> {
  const notes = context.notes;
  if (!notes) {
    await context.reply('Sistema de notas temporariamente indisponível.');
    return;
  }

  const args = argsOf(context);
  const subCommand = args[0]?.toLowerCase();
  if (!subCommand) {
    await context.reply(`📝 *Sistema de Notas*\n\n${context.prefix}nota add <texto> - Adiciona uma nota\n${context.prefix}notas - Lista suas notas\n${context.prefix}nota ver <id> - Ver nota específica\n${context.prefix}nota del <id> - Deleta uma nota\n${context.prefix}nota fixar <id> - Fixa/desfixa nota\n${context.prefix}nota buscar <termo> - Busca nas notas`);
    return;
  }

  if (subCommand === 'add' || subCommand === 'criar') {
    const text = args.slice(1).join(' ');
    if (!text) {
      await context.reply('❌ Digite o texto da nota!');
      return;
    }
    await context.reply(notes.addNote(context.sender, text, null, context.prefix).message);
    return;
  }

  if (subCommand === 'ver' || subCommand === 'view') {
    const id = Number.parseInt(args[1] ?? '', 10);
    if (Number.isNaN(id)) {
      await context.reply('❌ Informe o ID da nota!');
      return;
    }
    await context.reply(notes.getNote(context.sender, id, context.prefix).message);
    return;
  }

  if (subCommand === 'del' || subCommand === 'deletar' || subCommand === 'delete') {
    const id = Number.parseInt(args[1] ?? '', 10);
    if (Number.isNaN(id)) {
      await context.reply('❌ Informe o ID da nota!');
      return;
    }
    await context.reply(notes.deleteNote(context.sender, id).message);
    return;
  }

  if (subCommand === 'fixar' || subCommand === 'pin') {
    const id = Number.parseInt(args[1] ?? '', 10);
    if (Number.isNaN(id)) {
      await context.reply('❌ Informe o ID da nota!');
      return;
    }
    await context.reply(notes.togglePin(context.sender, id).message);
    return;
  }

  if (subCommand === 'buscar' || subCommand === 'search') {
    const term = args.slice(1).join(' ');
    if (!term) {
      await context.reply('❌ Digite o termo de busca!');
      return;
    }
    await context.reply(notes.searchNotes(context.sender, term).message);
    return;
  }

  await context.reply(`❌ Subcomando desconhecido. Use ${context.prefix}nota para ver ajuda.`);
}

async function notesCommand(context: ToolsExecutionContext): Promise<void> {
  const notes = context.notes;
  if (!notes) {
    await context.reply('Sistema de notas temporariamente indisponível.');
    return;
  }
  const page = Number.parseInt(argsOf(context)[0] ?? '', 10) || 1;
  await context.reply(notes.listNotes(context.sender, page, 10, context.prefix).message);
}

async function calculatorCommand(context: ToolsExecutionContext): Promise<void> {
  const calculator = context.calculator;
  if (!calculator) {
    await context.reply('Sistema de calculadora temporariamente indisponível.');
    return;
  }

  const query = context.query.trim();
  const args = argsOf(context);
  if (!query) {
    await context.reply(`🧮 *Calculadora Científica*\n\n${context.prefix}calc <expressão> - Calcula expressão\n${context.prefix}calc converter <valor> <de> <para>\n\n*Operadores:* + - * / ^ % !\n*Funções:* sin, cos, tan, sqrt, log, abs, ceil, floor\n*Constantes:* pi, e, phi\n\n*Exemplos:*\n${context.prefix}calc 2+2*3\n${context.prefix}calc sqrt(144)\n${context.prefix}calc sin(45)\n${context.prefix}calc 5!\n${context.prefix}calc converter 100 km mi`);
    return;
  }

  if (args[0]?.toLowerCase() === 'converter' || args[0]?.toLowerCase() === 'convert') {
    const value = Number.parseFloat(args[1] ?? '');
    const from = args[2]?.toLowerCase();
    const to = args[3]?.toLowerCase();
    if (Number.isNaN(value) || !from || !to) {
      await context.reply(`❌ Uso: ${context.prefix}calc converter <valor> <de> <para>\nExemplo: ${context.prefix}calc converter 100 km mi`);
      return;
    }
    await context.reply(calculator.convert(value, from, to).message);
    return;
  }

  await context.reply(calculator.calculate(query, context.prefix).message);
}

async function reminderCommand(context: ToolsExecutionContext): Promise<void> {
  try {
    const query = context.query.trim();
    if (!query) {
      await context.reply(`📅 *Como usar o comando lembrete:*\n\n💡 *Exemplos:*\n• ${context.prefix}lembrete em 30m beber água\n• ${context.prefix}lembrete 15/09 18:30 reunião\n• ${context.prefix}lembrete amanhã 08:00 acordar`);
      return;
    }

    const parseReminderInput = requiredService(context.parseReminderInput, 'parseReminderInput');
    const parsed = parseReminderInput(query);
    if (!parsed) {
      await context.reply('❌ Não consegui entender a data/hora. Exemplos:\n- em 10m tomar remédio\n- 25/12 09:00 ligar para a família\n- hoje 21:15 estudar');
      return;
    }
    if (parsed.at - Date.now() < 10_000) {
      await context.reply('⏳ Escolha um horário pelo menos 10 segundos à frente.');
      return;
    }

    const loadReminders = requiredService(context.loadReminders, 'loadReminders');
    const saveReminders = requiredService(context.saveReminders, 'saveReminders');
    const optimizer = requiredService(context.optimizer, 'optimizer');
    const tzFormat = requiredService(context.tzFormat, 'tzFormat');
    const id = (() => {
      try {
        return crypto.randomBytes(6).toString('hex');
      } catch {
        return Math.random().toString(16).substring(2, 14);
      }
    })();
    const reminder: ReminderRecord = {
      id,
      userId: context.sender,
      chatId: context.groupId,
      createdByName: context.pushName || '',
      createdAt: new Date().toISOString(),
      at: parsed.at,
      message: parsed.message,
      status: 'pending',
    };
    const list = await optimizer.memoize('reminders:all', () => Promise.resolve(loadReminders()), 5000);
    list.push(reminder);
    saveReminders(list);
    optimizer.clearStatic('reminders:all');
    optimizer.clearStatic('reminders:all');
    await context.reply(`✅ Lembrete agendado para ${tzFormat(parsed.at)}.\n📝 Mensagem: ${parsed.message}`);
  } catch (error) {
    console.error('[vnext:tools:lembrete] falha:', error);
    await context.reply('❌ Ocorreu um erro ao agendar seu lembrete.');
  }
}

async function reminderListCommand(context: ToolsExecutionContext): Promise<void> {
  try {
    const loadReminders = requiredService(context.loadReminders, 'loadReminders');
    const optimizer = requiredService(context.optimizer, 'optimizer');
    const tzFormat = requiredService(context.tzFormat, 'tzFormat');
    const allReminders = await optimizer.memoize('reminders:all', () => Promise.resolve(loadReminders()), 5000);
    const list = allReminders.filter((reminder) => reminder.userId === context.sender && reminder.status !== 'sent');
    if (!list.length) {
      await context.reply('📭 Você não tem lembretes pendentes.');
      return;
    }
    const lines = list
      .sort((first, second) => first.at - second.at)
      .map((reminder, index) => `${index + 1}. [${reminder.id.slice(0, 6)}] ${tzFormat(reminder.at)} — ${reminder.message}`);
    await context.reply(`🗓️ Seus lembretes pendentes:\n\n${lines.join('\n')}`);
  } catch (error) {
    console.error('[vnext:tools:meuslembretes] falha:', error);
    await context.reply('❌ Ocorreu um erro ao listar seus lembretes.');
  }
}

async function reminderDeleteCommand(context: ToolsExecutionContext): Promise<void> {
  try {
    const idArg = context.query.trim();
    if (!idArg) {
      await context.reply(`🗑️ *Uso do comando apagalembrete:*\n\n📝 *Formato:* ${context.prefix}apagalembrete <id|tudo>\n\n💡 *Exemplos:*\n• ${context.prefix}apagalembrete 123456\n• ${context.prefix}apagalembrete tudo`);
      return;
    }
    const loadReminders = requiredService(context.loadReminders, 'loadReminders');
    const saveReminders = requiredService(context.saveReminders, 'saveReminders');
    const optimizer = requiredService(context.optimizer, 'optimizer');
    let list = await optimizer.memoize('reminders:all', () => Promise.resolve(loadReminders()), 5000);
    if (['tudo', 'todos', 'all'].includes(idArg.toLowerCase())) {
      const before = list.length;
      list = list.filter((reminder) => !(reminder.userId === context.sender && reminder.status !== 'sent'));
      const removed = before - list.length;
      saveReminders(list);
      optimizer.clearStatic('reminders:all');
      await context.reply(`🗑️ Removidos ${removed} lembrete(s) pendente(s).`);
      return;
    }
    const index = list.findIndex((reminder) => reminder.id.startsWith(idArg)
      && reminder.userId === context.sender
      && reminder.status !== 'sent');
    if (index === -1) {
      await context.reply('❌ Lembrete não encontrado ou já enviado. Dica: use o ID mostrado em "meuslembretes".');
      return;
    }
    const [removed] = list.splice(index, 1);
    if (!removed) throw new Error('Lembrete localizado desapareceu antes da remoção.');
    saveReminders(list);
    optimizer.clearStatic('reminders:all');
    await context.reply(`🗑️ Lembrete removido: ${removed.message}`);
  } catch (error) {
    console.error('[vnext:tools:apagalembrete] falha:', error);
    await context.reply('❌ Ocorreu um erro ao remover seu lembrete.');
  }
}

function birthdayFile(context: ToolsExecutionContext): string {
  const groupFile = context.buildGroupFilePath(context.groupId);
  return path.join(path.dirname(groupFile), `${context.groupId}_aniversarios.json`);
}

function readBirthdays(file: string): Record<string, BirthdayRecord> {
  try {
    if (!fs.existsSync(file)) return {};
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, BirthdayRecord>;
  } catch {
    return {};
  }
}

async function birthdayCommand(context: ToolsExecutionContext): Promise<void> {
  if (!context.isGroup) {
    await context.reply('⚠️ Este comando só funciona em grupos!');
    return;
  }

  const args = argsOf(context);
  const subCommand = args[0]?.toLowerCase();
  const file = birthdayFile(context);
  const birthdays = readBirthdays(file);

  if (subCommand === 'definir' || subCommand === 'set') {
    const value = args[1];
    if (!value || !/^\d{1,2}\/\d{1,2}$/u.test(value)) {
      await context.reply(`🎂 *Definir Aniversário*\n\n💡 Use: ${context.prefix}aniversario definir DD/MM\n\n📌 Exemplo: ${context.prefix}aniversario definir 25/12`);
      return;
    }
    const [dayRaw, monthRaw] = value.split('/');
    const day = Number(dayRaw);
    const month = Number(monthRaw);
    if (day < 1 || day > 31 || month < 1 || month > 12) {
      await context.reply('❌ Data inválida! Use o formato DD/MM');
      return;
    }
    birthdays[context.sender] = { dia: day, mes: month, nome: context.pushName };
    fs.writeFileSync(file, JSON.stringify(birthdays, null, 2));
    await context.reply(`🎂 Aniversário definido!\n\n📅 *Data:* ${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}\n👤 *Nome:* ${context.pushName}`);
    return;
  }

  if (subCommand === 'mes' || subCommand === 'month') {
    const currentMonth = new Date().getMonth() + 1;
    const entries = Object.entries(birthdays)
      .filter(([, data]) => data.mes === currentMonth)
      .sort((first, second) => first[1].dia - second[1].dia);
    if (!entries.length) {
      await context.reply('📅 Nenhum aniversariante registrado para este mês!');
      return;
    }
    let text = `🎂 *Aniversariantes de ${new Date().toLocaleDateString('pt-BR', { month: 'long' })}*\n\n`;
    for (const [, data] of entries) {
      text += `• ${data.dia.toString().padStart(2, '0')}/${data.mes.toString().padStart(2, '0')} - ${data.nome}\n`;
    }
    await context.reply(text);
    return;
  }

  if (subCommand === 'proximos' || subCommand === 'next' || !subCommand) {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const entries = Object.entries(birthdays)
      .map(([id, data]) => {
        const daysUntil = data.mes > currentMonth || (data.mes === currentMonth && data.dia >= currentDay)
          ? (data.mes - currentMonth) * 30 + (data.dia - currentDay)
          : (12 - currentMonth + data.mes) * 30 + (data.dia - currentDay);
        return { ...data, id, daysUntil };
      })
      .sort((first, second) => first.daysUntil - second.daysUntil)
      .slice(0, 10);

    if (!entries.length) {
      await context.reply(`🎂 *Sistema de Aniversários*\n\nNenhum aniversário registrado!\n\n💡 *Comandos:*\n• ${context.prefix}aniversario definir DD/MM\n• ${context.prefix}aniversario mes\n• ${context.prefix}aniversario proximos`);
      return;
    }

    let text = '🎂 *Próximos Aniversários*\n\n';
    for (const data of entries) {
      const emoji = data.daysUntil === 0 ? '🎉' : data.daysUntil <= 7 ? '🔔' : '📅';
      const status = data.daysUntil === 0 ? '(HOJE!)' : `(em ${data.daysUntil} dias)`;
      text += `${emoji} ${data.dia.toString().padStart(2, '0')}/${data.mes.toString().padStart(2, '0')} - ${data.nome} ${status}\n`;
    }
    text += `\n💡 *Comandos:*\n• ${context.prefix}aniversario definir DD/MM\n• ${context.prefix}aniversario mes`;
    await context.reply(text);
    return;
  }

  await context.reply(`🎂 *Sistema de Aniversários*\n\n💡 *Comandos:*\n• ${context.prefix}aniversario - Ver próximos\n• ${context.prefix}aniversario definir DD/MM\n• ${context.prefix}aniversario mes\n• ${context.prefix}aniversario proximos`);
}

const HANDLERS = new Map<string, Handler>();
function register(tokens: readonly string[], handler: Handler): void {
  for (const token of tokens) HANDLERS.set(token, handler);
}
register(['hora', 'fuso', 'horario', 'timezone'], timeCommand);
register(['groupstats', 'estatisticas', 'statsgrupo'], groupStats);
register(['nota', 'note'], noteCommand);
register(['notas', 'notes'], notesCommand);
register(['calc', 'calcular', 'calculadora'], calculatorCommand);
register(['lembrete', 'lembrar'], reminderCommand);
register(['meuslembretes', 'listalembretes'], reminderListCommand);
register(['apagalembrete', 'removerlembrete'], reminderDeleteCommand);
register(['aniversario', 'niver', 'birthday'], birthdayCommand);

export const TOOLS_NATIVE_COMMAND_TOKENS = Object.freeze([...HANDLERS.keys()]);

export class ToolsDomainDispatchTarget
implements VNextCommandDispatchTarget<ToolsExecutionContext> {
  public async dispatch(command: string, context: ToolsExecutionContext): Promise<boolean> {
    const handler = HANDLERS.get(String(command || '').trim().toLowerCase());
    if (!handler) return false;
    await handler(context);
    return true;
  }
}
