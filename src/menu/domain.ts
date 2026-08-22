import type { LegacyCommandExecutionInput } from '../adapters/legacy-command-executor.js';
import type { VNextCommandDispatchTarget } from '../runtime/compatibility-dispatch.js';
import { findMenuCommandDescriptor, type MenuCommandDescriptor } from './catalog.js';

export interface MenuExecutionContext extends LegacyCommandExecutionInput {
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

    if (descriptor.ownerOnly && !context.isOwner) {
      await this.presentation.replyText(context, OWNER_ONLY_MENU_MESSAGE);
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
