import type { AdminCommandAccess, AdminExecutionContext } from './contracts.js';

export async function ensureAdminAccess(
  context: AdminExecutionContext,
  access: AdminCommandAccess,
): Promise<boolean> {
  if (access.group && !context.isGroup) {
    await context.reply('Isso só pode ser usado em grupo 💔');
    return false;
  }

  if (access.realAdmin) {
    if (!context.isRealGroupAdmin) {
      await context.reply('Comando restrito a administradores do grupo. 💔');
      return false;
    }
  } else if (access.admin && !context.isGroupAdmin) {
    await context.reply('Você precisa ser adm 💔');
    return false;
  }

  if (access.botAdmin && !context.isBotAdmin) {
    await context.reply('Eu preciso ser adm para isso 💔');
    return false;
  }

  return true;
}
