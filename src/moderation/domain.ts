import fs from 'node:fs';

import type { VNextCommandDispatchTarget } from '../runtime/compatibility-dispatch.js';
import type { FunExecutionContext } from '../fun/domain.js';
import {
  findModerationCommandDescriptor,
  type ModerationCommandDescriptor,
} from './catalog.js';

type JsonRecord = Record<string, unknown>;

type ModerationTargetDecision = {
  readonly allowed: boolean;
  readonly message?: string | null;
  readonly targetId?: string | null;
};

type ModerationTargetValidator = (
  action: string,
  target?: string | null,
  options?: { readonly refresh?: boolean },
) => Promise<ModerationTargetDecision> | ModerationTargetDecision;

type QuotedContextInfo = {
  readonly stanzaId?: string | null;
  readonly participant?: string | null;
};

interface LegacyModerationSocket {
  readonly user?: { readonly id?: string | null; readonly lid?: string | null };
  sendMessage(jid: string, content: unknown, options?: unknown): Promise<unknown>;
  groupParticipantsUpdate(
    jid: string,
    participants: readonly string[],
    action: 'remove' | 'promote' | 'demote',
  ): Promise<unknown>;
}

export interface ModerationExecutionContext extends FunExecutionContext {
  readonly isGroupAdmin: boolean;
  readonly isRealGroupAdmin: boolean;
  readonly isBotAdmin: boolean;
  readonly query: string;
  readonly groupName: string;
  readonly groupFile: string;
  readonly groupData: JsonRecord;
  readonly quotedContextInfo?: QuotedContextInfo | null;
  readonly quotedParticipant?: string | null;
  readonly botIds: readonly string[];
  readonly identitiesMatch: (first: string, second: string) => boolean;
  readonly validateModerationTarget: ModerationTargetValidator;
  readonly removeUserFromMap: (map: Record<string, unknown>, userId: string) => boolean;
}

function socketOf(context: ModerationExecutionContext): LegacyModerationSocket {
  const socket = context.socket as Partial<LegacyModerationSocket>;
  if (!socket || typeof socket.sendMessage !== 'function') {
    throw new Error('Socket legado não expõe sendMessage no domínio de moderação.');
  }
  if (typeof socket.groupParticipantsUpdate !== 'function') {
    throw new Error('Socket legado não expõe groupParticipantsUpdate no domínio de moderação.');
  }
  return socket as LegacyModerationSocket;
}

function readGroupState(context: ModerationExecutionContext): JsonRecord {
  try {
    if (context.groupFile && fs.existsSync(context.groupFile)) {
      const parsed = JSON.parse(fs.readFileSync(context.groupFile, 'utf8')) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as JsonRecord;
    }
  } catch {
    // Mantém o mesmo fallback operacional do legado: usa o estado já carregado.
  }
  return { ...context.groupData };
}

function writeGroupState(context: ModerationExecutionContext, state: JsonRecord, pretty = false): void {
  fs.writeFileSync(context.groupFile, JSON.stringify(state, null, pretty ? 2 : undefined));
}

async function ensureAccess(
  context: ModerationExecutionContext,
  descriptor: ModerationCommandDescriptor,
): Promise<boolean> {
  if (!context.isGroup) {
    await context.reply('isso so pode ser usado em grupo 💔');
    return false;
  }

  if (descriptor.requiresRealAdmin) {
    if (!context.isRealGroupAdmin) {
      await context.reply('Comando restrito a administradores do grupo. 💔');
      return false;
    }
  } else if (!context.isGroupAdmin) {
    await context.reply(
      descriptor.kind === 'delete-message'
        ? '🚫 Comando restrito a administradores ou moderadores autorizados.'
        : 'você precisa ser adm 💔',
    );
    return false;
  }

  if (descriptor.requiresBotAdmin && !context.isBotAdmin) {
    await context.reply('Eu preciso ser adm 💔');
    return false;
  }

  return true;
}

async function requireTarget(
  context: ModerationExecutionContext,
  action: string,
): Promise<string | null> {
  if (!context.mentionedUser) {
    await context.reply('Marque alguém 🙄');
    return null;
  }
  const decision = await context.validateModerationTarget(action);
  if (!decision.allowed || !decision.targetId) {
    await context.reply(`❌ ${decision.message || 'Alvo de moderação inválido.'}`);
    return null;
  }
  return decision.targetId;
}

async function dispatchDelete(context: ModerationExecutionContext): Promise<void> {
  const socket = socketOf(context);
  const quoted = context.quotedContextInfo;
  const stanzaId = quoted?.stanzaId || null;
  const participant = quoted?.participant || context.quotedParticipant || null;

  if (!stanzaId) {
    await context.reply(`↩️ Responda à mensagem que deseja apagar e use *${context.prefix}d*.`);
    return;
  }

  const participantIsBot = participant
    ? context.botIds.filter(Boolean).some((botId) => context.identitiesMatch(botId, participant))
    : false;

  const deleteKey: Record<string, unknown> = {
    remoteJid: context.groupId,
    fromMe: participantIsBot,
    id: stanzaId,
  };
  if (participant && !participantIsBot) deleteKey.participant = participant;

  try {
    await socket.sendMessage(context.groupId, { delete: deleteKey });
  } catch (error) {
    console.error('[vnext:moderation:delete] falha ao apagar mensagem:', error);
    await context.reply('❌ Não consegui apagar essa mensagem. Verifique se ainda sou administrador e tente novamente.');
  }
}

async function sendX9(
  context: ModerationExecutionContext,
  text: string,
  mentions: readonly string[],
): Promise<void> {
  if (!context.groupData.x9) return;
  try {
    await socketOf(context).sendMessage(context.groupId, { text, mentions: [...mentions] });
  } catch (error) {
    console.error('[vnext:moderation:x9] falha ao enviar relatório:', error);
  }
}

async function dispatchBan(context: ModerationExecutionContext): Promise<void> {
  const targetId = await requireTarget(context, 'ban');
  if (!targetId) return;

  await socketOf(context).groupParticipantsUpdate(context.groupId, [targetId], 'remove');
  const reason = context.query ? `\n📝 Motivo: ${context.query}` : '';
  await sendX9(
    context,
    `🚪 *X9 Report:* @${targetId.split('@')[0]} foi removido(a) do grupo por @${context.sender.split('@')[0]}.${reason}`,
    [targetId, context.sender],
  );
}

async function dispatchRoleChange(
  context: ModerationExecutionContext,
  action: 'promote' | 'demote',
): Promise<void> {
  const targetId = await requireTarget(context, action);
  if (!targetId) return;

  await socketOf(context).groupParticipantsUpdate(context.groupId, [targetId], action);
  if (action === 'promote') {
    await sendX9(
      context,
      `⬆️ *X9 Report:* @${targetId.split('@')[0]} foi promovido(a) a ADM por @${context.sender.split('@')[0]}.`,
      [targetId, context.sender],
    );
    return;
  }
  await sendX9(
    context,
    `⬇️ *X9 Report:* @${targetId.split('@')[0]} foi rebaixado(a) de ADM por @${context.sender.split('@')[0]}.`,
    [targetId, context.sender],
  );
}

async function dispatchMute(
  context: ModerationExecutionContext,
  bucket: 'mutedUsers' | 'mutedUsers2',
  action: 'mute' | 'mute-delete',
): Promise<void> {
  const targetId = await requireTarget(context, action);
  if (!targetId) return;

  const state = readGroupState(context);
  const current = state[bucket];
  const map = current && typeof current === 'object' && !Array.isArray(current)
    ? current as Record<string, unknown>
    : {};
  map[targetId] = true;
  state[bucket] = map;
  writeGroupState(context, state);

  const text = bucket === 'mutedUsers'
    ? `✅ @${context.getUserName(context.mentionedUser || targetId)} foi mutado. Se enviar mensagens, será banido.`
    : `✅ @${context.getUserName(context.mentionedUser || targetId)} foi mutado. Suas mensagens serão apagadas automaticamente.`;
  await socketOf(context).sendMessage(
    context.groupId,
    { text, mentions: [context.mentionedUser || targetId] },
    { quoted: context.message },
  );
}

async function dispatchUnmute(
  context: ModerationExecutionContext,
  bucket: 'mutedUsers' | 'mutedUsers2',
): Promise<void> {
  const targetId = await requireTarget(context, 'unmute');
  if (!targetId) return;

  const state = readGroupState(context);
  const current = state[bucket];
  const map = current && typeof current === 'object' && !Array.isArray(current)
    ? current as Record<string, unknown>
    : {};
  const original = context.mentionedUser || targetId;
  const removed = context.removeUserFromMap(map, targetId)
    || context.removeUserFromMap(map, original);

  if (!removed) {
    await context.reply(`❌ @${context.getUserName(original)} não está mutado.`, { mentions: [original] });
    return;
  }

  state[bucket] = map;
  writeGroupState(context, state);
  await socketOf(context).sendMessage(
    context.groupId,
    {
      text: `✅ @${context.getUserName(original)} foi desmutado e pode enviar mensagens novamente.`,
      mentions: [original],
    },
    { quoted: context.message },
  );
}

function blockReason(context: ModerationExecutionContext): string {
  const q = context.query || '';
  if (!q) return 'Não informado';
  if (q.includes('@') || !context.mentionedUser) {
    return q.includes(' ') ? q.split(' ').slice(1).join(' ') : 'Não informado';
  }
  return q.trim();
}

async function dispatchBlock(context: ModerationExecutionContext): Promise<void> {
  const targetId = await requireTarget(context, 'block');
  if (!targetId) return;

  const state = readGroupState(context);
  const current = state.blockedUsers;
  const blocked = current && typeof current === 'object' && !Array.isArray(current)
    ? current as Record<string, unknown>
    : {};
  blocked[targetId] = { reason: blockReason(context), timestamp: Date.now() };
  state.blockedUsers = blocked;
  writeGroupState(context, state, true);
  await context.reply(`✅ Usuário @${context.getUserName(targetId)} bloqueado no grupo!`, {
    mentions: [targetId],
  });
}

async function dispatchUnblock(context: ModerationExecutionContext): Promise<void> {
  const targetId = await requireTarget(context, 'unblock');
  if (!targetId) return;

  const state = readGroupState(context);
  const current = state.blockedUsers;
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    await context.reply('ℹ️ Não há usuários bloqueados neste grupo.');
    return;
  }

  const blocked = current as Record<string, unknown>;
  const original = context.mentionedUser || targetId;
  const removed = context.removeUserFromMap(blocked, targetId)
    || context.removeUserFromMap(blocked, original);
  if (!removed) {
    await context.reply(`❌ O usuário @${context.getUserName(targetId)} não está bloqueado no grupo!`, {
      mentions: [targetId],
    });
    return;
  }

  state.blockedUsers = blocked;
  writeGroupState(context, state, true);
  await context.reply(`✅ Usuário @${context.getUserName(targetId)} desbloqueado no grupo!`, {
    mentions: [targetId],
  });
}

async function dispatchBlockList(context: ModerationExecutionContext): Promise<void> {
  const state = readGroupState(context);
  const current = state.blockedUsers;
  const blocked = current && typeof current === 'object' && !Array.isArray(current)
    ? Object.entries(current as Record<string, { reason?: unknown }>).map(
      ([user, data]) => `👤 *${context.getUserName(user)}* - Motivo: ${String(data?.reason || 'Não informado')}`,
    ).join('\n')
    : 'Nenhum usuário bloqueado no grupo.';
  await context.reply(`🔒 *Usuários Bloqueados no Grupo - ${context.groupName}* 🔒\n\n${blocked}`);
}

export class ModerationDomainDispatchTarget
implements VNextCommandDispatchTarget<ModerationExecutionContext> {
  async dispatch(command: string, context: ModerationExecutionContext): Promise<boolean> {
    const descriptor = findModerationCommandDescriptor(command);
    if (!descriptor) return false;

    if (!(await ensureAccess(context, descriptor))) return true;

    try {
      switch (descriptor.kind) {
        case 'delete-message':
          await dispatchDelete(context);
          break;
        case 'ban':
          await dispatchBan(context);
          break;
        case 'promote':
          await dispatchRoleChange(context, 'promote');
          break;
        case 'demote':
          await dispatchRoleChange(context, 'demote');
          break;
        case 'mute':
          await dispatchMute(context, 'mutedUsers', 'mute');
          break;
        case 'unmute':
          await dispatchUnmute(context, 'mutedUsers');
          break;
        case 'mute-delete':
          await dispatchMute(context, 'mutedUsers2', 'mute-delete');
          break;
        case 'unmute-delete':
          await dispatchUnmute(context, 'mutedUsers2');
          break;
        case 'block':
          await dispatchBlock(context);
          break;
        case 'unblock':
          await dispatchUnblock(context);
          break;
        case 'block-list':
          await dispatchBlockList(context);
          break;
      }
    } catch (error) {
      console.error('[vnext:moderation] falha no domínio de moderação:', error);
      await context.reply('❌ Ocorreu um erro interno. Tente novamente em alguns minutos.');
    }
    return true;
  }
}
