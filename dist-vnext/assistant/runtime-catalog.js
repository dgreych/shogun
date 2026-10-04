import { ASSISTANT_COMMAND_DESCRIPTIONS, ASSISTANT_COMMAND_FAMILIES } from './command-catalog.js';
import { MODERATION_COMMAND_DESCRIPTORS } from '../moderation/catalog.js';
const routed = ['nexo', 'entrar', 'continuar', 'painel', 'ficha', 'privado', 'tutorial', 'cancelar', 'combate'];
const builtins = ['d', 'del', 'deletar', 'modelos'];
const normalize = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const valid = (value) => typeof value === 'string' && /^[\p{L}\p{N}_.-]{1,64}$/u.test(value);
// Famílias cujo handler consome a menção/citação autenticada pelo transporte.
// A lista é por família para fechar aliases junto com o comando principal.
const transportTargetFamilyPrimaries = new Set([
    'digitar', 'batalhanaval', 'dueloquiz', 'addxp', 'delxp', 'testcmd',
    'addblackglobal', 'rmblackglobal', 'blockuserg', 'unblockuserg', 'resetgold',
    'addindicacao', 'delindicacao', 'blockuser', 'unblockuser', 'banir', 'ban2', 'bam',
    'promover', 'rebaixar', 'addparceria', 'delparceria', 'addblacklist', 'delblacklist',
    'adv', 'removeradv', 'mute', 'desmute', 'mute2', 'desmute2', 'ttt', 'connect4',
    'presentebn', 'repbn', 'denunciar', 'brincadeira', 'namoro', 'casamento',
    'relacionamento', 'divorciar', 'trair', 'historicotraicao', 'shipo', 'sorte',
    'perfil', 'gay', 'lesbica', 'chute', 'addmod', 'delmod', 'wl.add', 'wl.remove',
    'perfilrpg', 'presente',
]);
const transportTargetTokens = ASSISTANT_COMMAND_FAMILIES
    .filter(family => transportTargetFamilyPrimaries.has(normalize(family[0] || '')))
    .flatMap(family => family.map(normalize).filter(valid));
export const ASSISTANT_TRANSPORT_TARGET_COMMANDS = Object.freeze([...new Set([
        ...transportTargetTokens,
        ...MODERATION_COMMAND_DESCRIPTORS.filter(descriptor => !['delete-message', 'block-list'].includes(descriptor.kind))
            .flatMap(descriptor => descriptor.tokens.map(normalize)),
    ])]);
// Algumas consultas de relacionamento aceitam exatamente duas pessoas. As
// demais operações de alvo recusam ambiguidade em vez de escolher a primeira.
const multipleTargetCommands = new Set([
    'relacionamento', 'divorciar', 'divorcio', 'terminar', 'termino', 'terminarelacionamento',
    'historicotraicao', 'historicotraicoes', 'historicodetraicao',
]);
export const ASSISTANT_SINGLE_TARGET_COMMANDS = Object.freeze(ASSISTANT_TRANSPORT_TARGET_COMMANDS.filter(command => !multipleTargetCommands.has(command)));
// Famílias são apenas a fonte de tokens top-level. Compartilhar um bloco de
// implementação não declara equivalência de operações nem concede autoridade.
export function buildAssistantCommandCatalog(input = {}) {
    const tokens = new Set([...ASSISTANT_COMMAND_FAMILIES.flat(), ...routed, ...builtins].map(normalize).filter(valid));
    for (const command of input.customCommands || [])
        if (valid(command.trigger))
            tokens.add(normalize(command.trigger));
    for (const alias of input.aliases || []) {
        if (valid(alias.alias) && valid(alias.command) && tokens.has(normalize(alias.command)))
            tokens.add(normalize(alias.alias));
    }
    return [...tokens];
}
export function buildAssistantCommandDescriptions(catalog) {
    const allowed = new Set(catalog.map(normalize));
    return Object.freeze(Object.fromEntries(Object.entries(ASSISTANT_COMMAND_DESCRIPTIONS)
        .map(([token, description]) => [normalize(token), description])
        .filter(([token]) => allowed.has(token))));
}
//# sourceMappingURL=runtime-catalog.js.map