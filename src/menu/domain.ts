import type { LegacyCommandExecutionInput } from '../adapters/legacy-command-executor.js';
import type { VNextCommandDispatchTarget } from '../runtime/compatibility-dispatch.js';
import { findMenuCommandDescriptor, type MenuCommandDescriptor } from './catalog.js';
import { evaluateCommandAccess, commandAccessMessage, UNRESOLVED_COMMAND_ACCESS, type CommandAccessContext } from '../commands/access-policy.js';
import { findCommandAccessPolicy } from '../commands/access-catalog.js';

export interface MenuExecutionContext extends LegacyCommandExecutionInput {
  readonly access: CommandAccessContext;
  readonly rawAliases?: unknown;
  readonly prefix: string;
  readonly botName: string;
  readonly pushName: string;
  readonly isOwner: boolean;
  readonly isLiteMode: boolean;
}

export interface MenuPresentationRequest {
  readonly descriptor: MenuCommandDescriptor;
  readonly context: MenuExecutionContext;
}

export interface MenuPresentationPort {
  present(request: MenuPresentationRequest): Promise<void>;
  replyText(context: MenuExecutionContext, text: string): Promise<void>;
  reportError(error: unknown, request: MenuPresentationRequest): Promise<void> | void;
}

const OWNER_ONLY_MENU_MESSAGE = '⚠️ Este menu é exclusivo para o dono do bot.';

export class MenuDomainDispatchTarget implements VNextCommandDispatchTarget<MenuExecutionContext> {
  constructor(private readonly presentation: MenuPresentationPort) {}

  async dispatch(command: string, context: MenuExecutionContext): Promise<boolean> {
    const descriptor = findMenuCommandDescriptor(command);
    if (!descriptor) return false;

    const decision = evaluateCommandAccess(findCommandAccessPolicy(command), context.access || UNRESOLVED_COMMAND_ACCESS);
    if (!decision.executable) {
      await this.presentation.replyText(context, descriptor.ownerOnly ? OWNER_ONLY_MENU_MESSAGE : commandAccessMessage(decision));
      return true;
    }

    const request: MenuPresentationRequest = Object.freeze({ descriptor, context });
    try {
      await this.presentation.present(request);
    } catch (error) {
      await this.presentation.reportError(error, request);
      await this.presentation.replyText(context, descriptor.failureMessage);
    }
    return true;
  }
}
