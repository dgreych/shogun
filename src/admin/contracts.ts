import type { ModerationExecutionContext } from '../moderation/domain.js';

export type AdminCommandAccess = Readonly<{
  group: boolean;
  admin: boolean;
  realAdmin: boolean;
  botAdmin: boolean;
}>;

export interface AdminExecutionContext extends ModerationExecutionContext {
  readonly groupPrefix?: string;
  readonly args?: readonly string[];
  readonly rawArgs?: string;
}

export interface AdminCommandDescriptorBase {
  readonly id: string;
  readonly tokens: readonly string[];
  readonly access: AdminCommandAccess;
}

export type AdminReply = (text: string, options?: unknown) => Promise<unknown> | unknown;

export function adminAccess(
  input: Partial<AdminCommandAccess> = {},
): AdminCommandAccess {
  return Object.freeze({
    group: input.group ?? true,
    admin: input.admin ?? true,
    realAdmin: input.realAdmin ?? false,
    botAdmin: input.botAdmin ?? false,
  });
}
