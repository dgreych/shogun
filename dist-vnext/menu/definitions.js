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
    "id": "menuSticker",
    "sections": [
        {
            "id": "create",
            "title": "CRIAÇÃO DE FIGURINHAS",
            "icon": "🪄",
            "entries": [
                {
                    "command": "emojimix",
                    "description": "Dois emojis, uma combinação."
                },
                {
                    "command": "ttp",
                    "description": "Seu texto vira figurinha."
                },
                {
                    "command": "attp",
                    "description": "Texto com movimento."
                },
                {
                    "command": "sticker",
                    "description": "Foto ou vídeo viram figurinha."
                },
                {
                    "command": "sticker2",
                    "description": "Outra opção para criar sua figurinha."
                },
                {
                    "command": "sbg",
                    "description": "Uma figurinha sem fundo."
                },
                {
                    "command": "sfundo",
                    "description": "Remova o fundo da sua mídia."
                },
                {
                    "command": "qc",
                    "description": "Uma mensagem com cara de figurinha."
                },
                {
                    "command": "brat",
                    "description": "Seu texto no estilo brat."
                },
                {
                    "command": "bratvid",
                    "description": "Seu texto brat em movimento."
                }
            ]
        },
        {
            "id": "management",
            "title": "GERENCIAMENTO",
            "icon": "⚙️",
            "entries": [
                {
                    "command": "figualeatoria",
                    "description": "Uma surpresa do acervo."
                },
                {
                    "command": "figurinhas",
                    "description": "Explore seu acervo."
                },
                {
                    "command": "rename",
                    "description": "Troque os créditos da figurinha."
                },
                {
                    "command": "rgtake",
                    "description": "Defina seus créditos preferidos."
                },
                {
                    "command": "take",
                    "description": "Assine uma figurinha."
                },
                {
                    "command": "toimg",
                    "description": "Volte da figurinha para a imagem."
                }
            ]
        }
    ]
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
    { command: 'instagram', arguments: '<link>', description: 'Fotos, Reels e carrosséis.' },
    { command: 'kwai' },
    { command: 'igstory', arguments: '<link>', description: 'Stories disponíveis no Instagram.' },
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
    "id": "menudown",
    "sections": [
        {
            "id": "search",
            "title": "PESQUISAS & CONSULTAS",
            "icon": "💭",
            "entries": [
                {
                    "command": "google",
                    "arguments": "<pesquisa>",
                    "description": "Encontre o que você procura na web."
                },
                {
                    "command": "noticias",
                    "arguments": "[assunto]",
                    "description": "As notícias do tema que você escolher."
                },
                {
                    "command": "apps",
                    "arguments": "<nome>",
                    "description": "Busque um aplicativo."
                },
                {
                    "command": "dicionario",
                    "arguments": "<palavra>",
                    "description": "Uma palavra, seus significados."
                },
                {
                    "command": "wikipedia",
                    "arguments": "<assunto>",
                    "description": "Conheça o assunto sem sair do chat."
                }
            ]
        },
        {
            "id": "audio",
            "title": "MÚSICA & ÁUDIO",
            "icon": "🎧",
            "entries": [
                {
                    "command": "letra",
                    "arguments": "<música>",
                    "description": "A letra para acompanhar o som."
                },
                {
                    "command": "play",
                    "arguments": "<nome ou link>",
                    "description": "Sua música em áudio."
                },
                {
                    "command": "play2",
                    "arguments": "<nome ou link>",
                    "description": "Outra opção para buscar sua música."
                },
                {
                    "command": "spotify",
                    "arguments": "<link>",
                    "description": "Traga uma faixa do Spotify."
                },
                {
                    "command": "soundcloud",
                    "arguments": "<link>",
                    "description": "Sua faixa do SoundCloud no chat."
                }
            ]
        },
        {
            "id": "video",
            "title": "VÍDEOS & STREAMING",
            "icon": "🎬",
            "entries": [
                {
                    "command": "playvid",
                    "arguments": "<nome ou link>",
                    "description": "O vídeo da sua busca."
                }
            ]
        },
        {
            "id": "downloads",
            "title": "DOWNLOADS",
            "icon": "📥",
            "entries": [
                {
                    "command": "tiktok",
                    "arguments": "<link>",
                    "description": "Traga o vídeo para a conversa."
                },
                {
                    "command": "instagram",
                    "arguments": "<link>",
                    "description": "Fotos, Reels e carrosséis."
                },
                {
                    "command": "kwai",
                    "arguments": "<link>",
                    "description": "Baixe o vídeo que você encontrou."
                },
                {
                    "command": "igstory",
                    "arguments": "<link>",
                    "description": "Stories disponíveis no Instagram."
                },
                {
                    "command": "facebook",
                    "arguments": "<link>",
                    "description": "Um vídeo do Facebook, aqui no chat."
                },
                {
                    "command": "gdrive",
                    "arguments": "<link>",
                    "description": "Receba um arquivo público do Drive."
                },
                {
                    "command": "mediafire",
                    "arguments": "<link>",
                    "description": "Receba um arquivo do MediaFire."
                },
                {
                    "command": "twitter",
                    "arguments": "<link>",
                    "description": "Traga a mídia de uma publicação."
                }
            ]
        },
        {
            "id": "media",
            "title": "MÍDIAS SOCIAIS",
            "icon": "🎨",
            "entries": [
                {
                    "command": "pinterest",
                    "arguments": "<pesquisa>",
                    "description": "Ideias visuais para sua busca."
                }
            ]
        },
        {
            "id": "games",
            "title": "GAMING & APPS",
            "icon": "✨",
            "entries": [
                {
                    "command": "mcplugin",
                    "arguments": "<nome>",
                    "description": "Encontre plugins de Minecraft."
                }
            ]
        }
    ]
});
/**
 * Famílias só entram aqui quando têm inventário e teste de paridade próprios.
 */
export const MENU_DEFINITIONS = Object.freeze([
    STICKER_MENU_DEFINITION,
    DOWNLOAD_MENU_DEFINITION,
]);
//# sourceMappingURL=definitions.js.map