export function adminAccess(input = {}) {
    return Object.freeze({
        group: input.group ?? true,
        admin: input.admin ?? true,
        realAdmin: input.realAdmin ?? false,
        botAdmin: input.botAdmin ?? false,
    });
}
//# sourceMappingURL=contracts.js.map