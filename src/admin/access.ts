import type { AdminCommandAccess, AdminExecutionContext } from './contracts.js';
import { evaluateCommandAccess, commandAccessMessage, UNRESOLVED_COMMAND_ACCESS } from '../commands/access-policy.js';

export async function ensureAdminAccess(
  context: AdminExecutionContext,
  access: AdminCommandAccess,
): Promise<boolean> {
  const decision = evaluateCommandAccess({ tokens: [], groupOnly: access.group, admin: access.admin,
    realAdmin: access.realAdmin, botAdmin: access.botAdmin, ownerOnly: false, ownerOrSub: false }, context.access || UNRESOLVED_COMMAND_ACCESS);
  if (!decision.executable) await context.reply(commandAccessMessage(decision));
  return decision.executable;
}
