export const UNRESOLVED_COMMAND_ACCESS = Object.freeze({
    resolved: false, isGroup: false, isOwner: false, isSubOwner: false,
    isGroupAdmin: false, isRealGroupAdmin: false, isBotAdmin: false,
});
const deny = (reason) => Object.freeze({ visible: false, executable: false, reason });
export function evaluateCommandAccess(policy, context) {
    if (!policy)
        return deny('unknown');
    const restricted = policy.groupOnly || policy.privateOnly || policy.ownerOnly || policy.ownerOrSub || policy.admin || policy.realAdmin || policy.botAdmin ||
        policy.primaryOwnerOnly || policy.ownerWithoutSub || policy.ownerOrRealAdmin || policy.ownerOrAdmin || policy.ownerOrAdminOrSub || policy.nonAdmin;
    if (restricted && context?.resolved !== true)
        return deny('unresolved');
    if (policy.groupOnly && context.isGroup !== true)
        return deny('group');
    if (policy.privateOnly && context.isGroup !== false)
        return deny('private');
    if (policy.ownerOnly && context.isOwner !== true)
        return deny('owner');
    if (policy.primaryOwnerOnly && context.isPrimaryOwner !== true)
        return deny('primary-owner');
    if (policy.ownerWithoutSub && (context.isOwner !== true || context.isSubOwner === true))
        return deny('owner');
    if (policy.ownerOrSub && context.isOwner !== true && context.isSubOwner !== true)
        return deny('owner-or-sub');
    if (policy.realAdmin && context.isRealGroupAdmin !== true)
        return deny('real-admin');
    const grantedModerator = policy.moderatorGrantable === true && context.isGroup === true &&
        Array.isArray(context.moderatorCommands) && policy.tokens.some(token => context.moderatorCommands?.includes(token));
    const effectiveAdmin = context.isGroupAdmin === true || grantedModerator ||
        (policy.adminOverview === true && context.isGroup === true && (context.moderatorCommands?.length || 0) > 0);
    if (policy.ownerOrRealAdmin && context.isOwner !== true && !(context.isGroup === true && context.isRealGroupAdmin === true))
        return deny('real-admin');
    if (policy.ownerOrAdmin && context.isOwner !== true && !effectiveAdmin)
        return deny('admin');
    if (policy.ownerOrAdminOrSub && context.isOwner !== true && context.isSubOwner !== true && !effectiveAdmin)
        return deny('owner-or-sub');
    if (policy.nonAdmin && effectiveAdmin)
        return deny('admin');
    if (policy.admin && !effectiveAdmin)
        return deny('admin');
    if (policy.botAdmin && context.isBotAdmin !== true) {
        return Object.freeze({ visible: true, executable: false, reason: 'bot-admin' });
    }
    return Object.freeze({ visible: true, executable: true, reason: 'allowed' });
}
export function commandAccessMessage(decision) {
    const messages = {
        allowed: '', unknown: 'Comando não encontrado.', unresolved: 'Não consegui conferir as permissões. Tente novamente.',
        group: 'Use este comando em um grupo.', private: 'Use este comando no meu privado.',
        owner: 'Este comando é reservado ao dono do bot.', 'primary-owner': 'Este comando é reservado ao dono original.',
        'owner-or-sub': 'Este comando é reservado aos donos e subdonos.', admin: 'Este comando exige administração do grupo.',
        'real-admin': 'Comando restrito a administradores reais do grupo.', 'bot-admin': 'O Shogun precisa ser administrador do grupo para executar isso.',
    };
    return messages[decision.reason];
}
//# sourceMappingURL=access-policy.js.map