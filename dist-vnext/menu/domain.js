import { findMenuCommandDescriptor } from './catalog.js';
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
        if (descriptor.ownerOnly && !context.isOwner) {
            await this.presentation.replyText(context, OWNER_ONLY_MENU_MESSAGE);
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