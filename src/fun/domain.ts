import fs from 'node:fs';
import path from 'node:path';

import type { VNextCommandDispatchTarget } from '../runtime/compatibility-dispatch.js';
import type { MenuExecutionContext } from '../menu/domain.js';
import { findFunCommandDescriptor, type FunCommandDescriptor } from './catalog.js';

interface LegacySocket {
  sendMessage(jid: string, content: unknown): Promise<unknown>;
}

export interface FunExecutionContext extends MenuExecutionContext {
  readonly reply: (text: string, options?: unknown) => Promise<unknown> | unknown;
  readonly rejectInLiteMode: () => Promise<unknown> | unknown;
  readonly isGroup: boolean;
  readonly isModoBn: boolean;
  readonly sender: string;
  readonly mentionedUser?: string | null;
  readonly groupId: string;
  readonly groupMembers: readonly string[];
  readonly getUserName: (id: string) => string;
  readonly buildGroupFilePath: (groupId: string) => string;
}

type JsonRecord = Record<string, unknown>;
type MediaDescriptor = { image?: unknown; video?: unknown };

const JSON_ROOT = path.resolve(process.cwd(), 'dados/src/funcs/json');
const LITE_MALE = new Set(['pirocudo', 'pirokudo', 'gostoso', 'machista', 'homofobico', 'racista']);
const LITE_FEMALE = new Set(['bucetuda', 'cachorra', 'vagabunda', 'racista', 'gostosa', 'machista', 'homofobica']);
const LITE_RANK_MALE = new Set(['rankgostoso', 'rankgostosos']);
const LITE_RANK_FEMALE = new Set(['rankgostosa', 'rankgostosas']);
const LITE_INTERACTIONS = new Set(['sexo', 'surubao', 'goza', 'gozar', 'mamar', 'mamada', 'beijob', 'beijarb', 'tapar']);

function readJson(filename: string, fallback: JsonRecord = {}): JsonRecord {
  try {
    return JSON.parse(fs.readFileSync(path.join(JSON_ROOT, filename), 'utf8')) as JsonRecord;
  } catch {
    return fallback;
  }
}

function socketOf(context: FunExecutionContext): LegacySocket {
  const socket = context.socket as Partial<LegacySocket>;
  if (!socket || typeof socket.sendMessage !== 'function') {
    throw new Error('Socket legado não expõe sendMessage no domínio de brincadeiras.');
  }
  return socket as LegacySocket;
}

async function rejectLite(context: FunExecutionContext): Promise<void> {
  await context.rejectInLiteMode();
}

async function ensureFunGroup(context: FunExecutionContext): Promise<boolean> {
  if (!context.isGroup) {
    await context.reply('isso so pode ser usado em grupo 💔');
    return false;
  }
  if (!context.isModoBn) {
    await context.reply('❌ O modo brincadeira não esta ativo nesse grupo');
    return false;
  }
  return true;
}

async function sendMediaOrText(
  context: FunExecutionContext,
  media: MediaDescriptor | undefined,
  text: string,
  mentions: readonly string[],
): Promise<void> {
  const socket = socketOf(context);
  if (media?.image) {
    await socket.sendMessage(context.groupId, { image: media.image, caption: text, mentions: [...mentions] });
    return;
  }
  if (media?.video) {
    await socket.sendMessage(context.groupId, {
      video: media.video,
      caption: text,
      mentions: [...mentions],
      gifPlayback: true,
    });
    return;
  }
  await socket.sendMessage(context.groupId, { text, mentions: [...mentions] });
}

function mediaFor(root: JsonRecord, bucket: 'games' | 'games2' | 'ranks', command: string): MediaDescriptor | undefined {
  const collection = root[bucket];
  if (!collection || typeof collection !== 'object') return undefined;
  const media = (collection as Record<string, unknown>)[command];
  return media && typeof media === 'object' ? media as MediaDescriptor : undefined;
}

function requiredTextTemplate(root: JsonRecord, command: string, source: string): string {
  const value = root[command];
  if (typeof value !== 'string') {
    throw new Error(`Template legado ausente em ${source} para ${command}.`);
  }
  return value;
}

function optionalTextTemplate(root: JsonRecord, command: string): string | undefined {
  const value = root[command];
  return typeof value === 'string' ? value : undefined;
}

async function dispatchProfile(
  command: string,
  context: FunExecutionContext,
  female: boolean,
): Promise<void> {
  const liteBlocked = female ? LITE_FEMALE : LITE_MALE;
  if (context.isLiteMode && liteBlocked.has(command)) return rejectLite(context);
  if (!(await ensureFunGroup(context))) return;

  const target = context.mentionedUser || context.sender;
  const targetName = `@${context.getUserName(target)}`;
  const level = Math.floor(Math.random() * 101);
  const source = female ? 'gamestext2.json' : 'gamestext.json';
  const responses = readJson(source);
  const template = requiredTextTemplate(responses, command, source);
  const responseText = template.replaceAll('#nome#', targetName).replaceAll('#level#', String(level));
  const games = readJson('games.json', { games: {} });
  await sendMediaOrText(context, mediaFor(games, 'games', command), responseText, [target]);
}

function readGroupMarks(context: FunExecutionContext): Record<string, unknown> {
  try {
    const pathToGroup = context.buildGroupFilePath(context.groupId);
    if (!fs.existsSync(pathToGroup)) return {};
    const parsed = JSON.parse(fs.readFileSync(pathToGroup, 'utf8')) as JsonRecord;
    return parsed.mark && typeof parsed.mark === 'object'
      ? parsed.mark as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

async function dispatchRank(
  command: string,
  context: FunExecutionContext,
  female: boolean,
): Promise<void> {
  const liteBlocked = female ? LITE_RANK_FEMALE : LITE_RANK_MALE;
  if (context.isLiteMode && liteBlocked.has(command)) return rejectLite(context);
  if (!(await ensureFunGroup(context))) return;

  const marks = readGroupMarks(context);
  const members = context.groupMembers.filter((member) => !['0', 'marca'].includes(String(marks[member])));
  if (members.length < 5) {
    await context.reply('❌ Membros insuficientes para formar um ranking.');
    return;
  }

  const top5 = [...members].sort(() => Math.random() - 0.5).slice(0, 5);
  const cleanedCommand = command.endsWith('s') ? command.slice(0, -1) : command;
  const ranks = readJson('ranks.json', { ranks: {} });
  const base = optionalTextTemplate(ranks, cleanedCommand);
  let responseText = base
    ? `${base}${female ? '\n\n' : ''}`
    : `📊 *Ranking de ${cleanedCommand.replace('rank', '')}:*\n\n`;

  top5.forEach((member, index) => {
    responseText += `🏅 *#${index + 1}* - @${context.getUserName(member)}\n`;
  });

  const games = readJson('games.json', { ranks: {} });
  await sendMediaOrText(context, mediaFor(games, 'ranks', cleanedCommand), responseText, top5);
}

async function dispatchInteraction(command: string, context: FunExecutionContext): Promise<void> {
  if (context.isLiteMode && LITE_INTERACTIONS.has(command)) return rejectLite(context);
  if (!(await ensureFunGroup(context))) return;
  if (!context.mentionedUser) {
    await context.reply('Marque um usuário.');
    return;
  }

  const target = context.mentionedUser;
  const markGame = readJson('markgame.json');
  const template = requiredTextTemplate(markGame, command, 'markgame.json');
  const targetName = `@${context.getUserName(target)}`;
  const responseText = template.replaceAll('#nome#', targetName);
  const games = readJson('games.json', { games2: {} });
  await sendMediaOrText(context, mediaFor(games, 'games2', command), responseText, [target]);
}

export class FunDomainDispatchTarget implements VNextCommandDispatchTarget<FunExecutionContext> {
  async dispatch(command: string, context: FunExecutionContext): Promise<boolean> {
    const normalized = String(command || '').trim().toLowerCase();
    const descriptor: FunCommandDescriptor | undefined = findFunCommandDescriptor(normalized);
    if (!descriptor) return false;

    try {
      switch (descriptor.kind) {
        case 'profile-male':
          await dispatchProfile(normalized, context, false);
          break;
        case 'profile-female':
          await dispatchProfile(normalized, context, true);
          break;
        case 'rank-male':
          await dispatchRank(normalized, context, false);
          break;
        case 'rank-female':
          await dispatchRank(normalized, context, true);
          break;
        case 'interaction':
          await dispatchInteraction(normalized, context);
          break;
      }
    } catch (error) {
      console.error('[vnext:fun] falha no domínio de brincadeiras:', error);
      await context.reply('❌ Ocorreu um erro interno. Tente novamente em alguns minutos.');
    }
    return true;
  }
}
