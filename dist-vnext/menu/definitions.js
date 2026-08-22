const stickerCreationEntries = Object.freeze([
    { command: 'emojimix' },
    { command: 'ttp' },
    { command: 'attp' },
    { command: 'sticker' },
    { command: 'sticker2' },
    { command: 'sbg' },
    { command: 'sfundo' },
    { command: 'qc' },
    { command: 'brat' },
    { command: 'bratvid' },
]);
const stickerManagementEntries = Object.freeze([
    { command: 'figualeatoria' },
    { command: 'figurinhas' },
    { command: 'rename' },
    { command: 'rgtake' },
    { command: 'take' },
    { command: 'toimg' },
]);
export const STICKER_MENU_DEFINITION = Object.freeze({
    id: 'menuSticker',
    sections: Object.freeze([
        Object.freeze({
            id: 'create',
            title: '🎨 CRIAÇÃO DE FIGURINHAS',
            entries: stickerCreationEntries,
        }),
        Object.freeze({
            id: 'management',
            title: '⚙️ GERENCIAMENTO',
            entries: stickerManagementEntries,
        }),
    ]),
});
const downloadSearchEntries = Object.freeze([
    { command: 'google' },
    { command: 'noticias' },
    { command: 'apps' },
    { command: 'dicionario' },
    { command: 'wikipedia' },
]);
const downloadAudioEntries = Object.freeze([
    { command: 'letra' },
    { command: 'play' },
    { command: 'play2', blankLineAfter: true },
    { command: 'spotify' },
    { command: 'soundcloud' },
]);
const downloadVideoEntries = Object.freeze([
    { command: 'playvid' },
]);
const downloadEntries = Object.freeze([
    { command: 'tiktok' },
    { command: 'instagram' },
    { command: 'kwai' },
    { command: 'igstory' },
    { command: 'facebook' },
    { command: 'gdrive' },
    { command: 'mediafire' },
    { command: 'twitter' },
]);
const downloadMediaEntries = Object.freeze([
    { command: 'pinterest' },
]);
const downloadGamesEntries = Object.freeze([
    { command: 'mcplugin' },
]);
export const DOWNLOAD_MENU_DEFINITION = Object.freeze({
    id: 'menudown',
    sections: Object.freeze([
        Object.freeze({ id: 'search', title: '🔍 PESQUISAS & CONSULTAS', entries: downloadSearchEntries }),
        Object.freeze({ id: 'audio', title: '🎵 MÚSICA & ÁUDIO', entries: downloadAudioEntries }),
        Object.freeze({ id: 'video', title: '🎬 VÍDEOS & STREAMING', entries: downloadVideoEntries }),
        Object.freeze({ id: 'downloads', title: '📥 DOWNLOADS', entries: downloadEntries }),
        Object.freeze({ id: 'media', title: '📱 MÍDIAS SOCIAIS', entries: downloadMediaEntries }),
        Object.freeze({ id: 'games', title: '🎮 GAMING & APPS', entries: downloadGamesEntries }),
    ]),
});
/**
 * Famílias só entram aqui quando têm inventário e teste de paridade próprios.
 */
export const MENU_DEFINITIONS = Object.freeze([
    STICKER_MENU_DEFINITION,
    DOWNLOAD_MENU_DEFINITION,
]);
//# sourceMappingURL=definitions.js.map