import { findMenuCommandDescriptor } from './catalog.js';
import { evaluateCommandAccess, commandAccessMessage, UNRESOLVED_COMMAND_ACCESS } from '../commands/access-policy.js';
import { findCommandAccessPolicy } from '../commands/access-catalog.js';
const OWNER_ONLY_MENU_MESSAGE = '⚠️ Este menu é exclusivo para o dono do bot.';
export class MenuDomainDispatchTarget {
    presentation;
    constructor(presentation) {
        this.presentation = presentation;
    }
    async dispatch(command, context) {
        const descriptor = findMenuCommandDescriptor(command);
        if (!descriptor)
            return false;
        const decision = evaluateCommandAccess(findCommandAccessPolicy(command), context.access || UNRESOLVED_COMMAND_ACCESS);
        if (!decision.executable) {
            await this.presentation.replyText(context, descriptor.ownerOnly ? OWNER_ONLY_MENU_MESSAGE : commandAccessMessage(decision));
            return true;
        }
        const request = Object.freeze({ descriptor, context });
        try {
            await this.presentation.present(request);
        }
        catch (error) {
            await this.presentation.reportError(error, request);
            await this.presentation.replyText(context, descriptor.failureMessage);
        }
        return true;
    }
}
//# sourceMappingURL=domain.js.map