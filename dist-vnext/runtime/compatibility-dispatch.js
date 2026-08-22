/**
 * Seam original de envelope mantido para os gates R0–R5.
 */
export class CompatibilityDispatch {
    vnext;
    legacy;
    constructor(vnext, legacy) {
        this.vnext = vnext;
        this.legacy = legacy;
    }
    async dispatch(message, legacyInput) {
        const handledByVNext = await this.vnext.dispatch(message);
        if (handledByVNext)
            return 'vnext';
        await this.legacy.execute(legacyInput);
        return 'legacy';
    }
}
export class CommandCompatibilityDispatch {
    vnext;
    legacy;
    constructor(vnext, legacy) {
        this.vnext = vnext;
        this.legacy = legacy;
    }
    async dispatch(command, context) {
        const handledByVNext = await this.vnext.dispatch(command, context);
        if (handledByVNext)
            return 'vnext';
        await this.legacy.execute(context);
        return 'legacy';
    }
}
//# sourceMappingURL=compatibility-dispatch.js.map