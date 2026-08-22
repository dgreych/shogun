export class CommandRouter {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    async dispatch(message, context) {
        if (!message.command)
            return false;
        const handler = this.registry.resolve(message.command);
        if (!handler || !handler.canHandle(message))
            return false;
        await handler.handle(message, context);
        return true;
    }
}
//# sourceMappingURL=router.js.map