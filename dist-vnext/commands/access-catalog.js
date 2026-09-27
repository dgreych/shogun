import { MENU_COMMAND_DESCRIPTORS } from '../menu/catalog.js';
import { MODERATION_COMMAND_DESCRIPTORS } from '../moderation/catalog.js';
import { ADMIN_BOOLEAN_SETTINGS } from '../admin/toggle-catalog.js';
import { LEGACY_COMMAND_ACCESS_POLICIES } from './legacy-access-catalog.js';
import { resolveCommandInput } from './input-resolver.js';
function policy(tokens, flags = {}) {
    return Object.freeze({
        tokens: Object.freeze([...tokens]), groupOnly: false, ownerOnly: false,
        ownerOrSub: false, admin: false, realAdmin: false, botAdmin: false, ...flags,
    });
}
export const COMMAND_ACCESS_POLICIES = Object.freeze([
    ...MENU_COMMAND_DESCRIPTORS.map(item => policy(item.tokens, {
        ownerOnly: item.ownerOnly, groupOnly: item.id === 'admin', admin: item.id === 'admin', adminOverview: item.id === 'admin',
    })),
    ...MODERATION_COMMAND_DESCRIPTORS.map(item => policy(item.tokens, {
        groupOnly: true, admin: true, realAdmin: item.requiresRealAdmin, botAdmin: item.requiresBotAdmin,
        moderatorGrantable: !item.requiresRealAdmin,
    })),
    ...ADMIN_BOOLEAN_SETTINGS.map(item => policy(item.tokens, {
        groupOnly: item.access.group, admin: item.access.admin,
        realAdmin: item.access.realAdmin, botAdmin: item.access.botAdmin,
    })),
    policy(['resetrpg'], { groupOnly: true, primaryOwnerOnly: true, ownerWithoutSub: true }),
    ...LEGACY_COMMAND_ACCESS_POLICIES.map(({ tokens, ...flags }) => policy(tokens, flags)),
]);
const byToken = new Map();
for (const item of COMMAND_ACCESS_POLICIES) {
    for (const token of item.tokens) {
        if (!byToken.has(token))
            byToken.set(token, item);
    }
}
const nexoPlayers = policy(['entrar', 'continuar', 'painel', 'ficha', 'privado', 'tutorial', 'cancelar', 'combate'], { groupOnly: true });
const nexoPublic = policy(['nexo'], { groupOnly: true });
const nexoManagement = policy(['nexo'], { groupOnly: true, ownerOrRealAdmin: true });
const supportManagement = policy(['suporte', 'ticketsuporte', 'suporteticket', 'ticket'], { groupOnly: true, admin: true });
export function findCommandAccessPolicy(token, options = {}) {
    const normalized = resolveCommandInput(token).command;
    const action = options.arguments?.trim().split(/\s+/u)[0]?.toLowerCase();
    if (supportManagement.tokens.includes(normalized) && ['on', 'ativar', 'ligar', 'enable', 'off', 'desativar', 'desligar', 'disable'].includes(action || ''))
        return supportManagement;
    if (normalized === 'nexo') {
        return ['ativar', 'confirmar', 'desativar'].includes(action || '') ? nexoManagement : nexoPublic;
    }
    if (options.domain === 'nexo' && nexoPlayers.tokens.includes(normalized))
        return nexoPlayers;
    return byToken.get(normalized) || (nexoPlayers.tokens.includes(normalized) ? nexoPlayers : undefined);
}
//# sourceMappingURL=access-catalog.js.map