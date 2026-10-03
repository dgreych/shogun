export interface MenuEntry {
  readonly command: string;
  readonly aliases?: readonly string[];
  readonly arguments?: string;
  readonly description?: string;
  readonly ownerOnly?: boolean;
  readonly adminOnly?: boolean;
  readonly blankLineAfter?: boolean;
}

export interface MenuSection {
  readonly id: string;
  readonly title: string;
  readonly icon?: string;
  readonly entries: readonly MenuEntry[];
}

export interface MenuDefinition {
  readonly id: string;
  readonly title?: string;
  readonly entries?: readonly MenuEntry[];
  readonly sections?: readonly MenuSection[];
}

const stickerCreationEntries: readonly MenuEntry[] = Object.freeze([
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

const stickerManagementEntries: readonly MenuEntry[] = Object.freeze([
  { command: 'figualeatoria' },
  { command: 'figurinhas' },
  { command: 'rename' },
  { command: 'rgtake' },
  { command: 'take' },
  { command: 'toimg' },
]);

export const STICKER_MENU_DEFINITION: MenuDefinition = Object.freeze({
  "id": "menuSticker",
  "sections": [
    {
      "id": "create",
      "title": "CRIAÇÃO DE FIGURINHAS",
      "icon": "🪄",
      "entries": [
        {
          "command": "emojimix",
          "description": "Combinar dois emojis em uma figurinha."
        },
        {
          "command": "ttp",
          "description": "Criar uma figurinha de texto."
        },
        {
          "command": "attp",
          "description": "Criar uma figurinha de texto animado."
        },
        {
          "command": "sticker",
          "description": "Converter uma imagem ou um vídeo em figurinha."
        },
        {
          "command": "sticker2",
          "description": "Converter imagem ou vídeo de até 9,9 segundos em figurinha."
        },
        {
          "command": "sbg",
          "description": "Remover o fundo da imagem e enviar como figurinha."
        },
        {
          "command": "sfundo",
          "description": "Remover o fundo da imagem e enviar como figurinha."
        },
        {
          "command": "qc",
          "description": "Criar uma figurinha de mensagem."
        },
        {
          "command": "brat",
          "description": "Criar uma figurinha de texto no estilo brat."
        },
        {
          "command": "bratvid",
          "description": "Criar uma figurinha animada de texto no estilo brat."
        }
      ]
    },
    {
      "id": "management",
      "title": "ACERVO, CRÉDITOS & CONVERSÃO",
      "icon": "⚙️",
      "entries": [
        {
          "command": "figualeatoria",
          "description": "Enviar uma figurinha aleatória do acervo."
        },
        {
          "command": "figurinhas",
          "description": "Enviar de 1 a 15 figurinhas; em grupos, a entrega é no privado."
        },
        {
          "command": "rename",
          "description": "Alterar autor e pacote da figurinha respondida."
        },
        {
          "command": "rgtake",
          "description": "Salvar autor e pacote no formato Autor/Pack."
        },
        {
          "command": "take",
          "description": "Aplicar os créditos salvos à figurinha respondida."
        },
        {
          "command": "toimg",
          "description": "Converter uma figurinha em imagem."
        }
      ]
    }
  ]
});

const downloadSearchEntries: readonly MenuEntry[] = Object.freeze([
  { command: 'google' },
  { command: 'noticias' },
  { command: 'apps' },
  { command: 'dicionario' },
  { command: 'wikipedia' },
]);

const downloadAudioEntries: readonly MenuEntry[] = Object.freeze([
  { command: 'letra' },
  { command: 'play' },
  { command: 'play2', blankLineAfter: true },
  { command: 'spotify' },
  { command: 'soundcloud' },
]);

const downloadVideoEntries: readonly MenuEntry[] = Object.freeze([
  { command: 'playvid' },
]);

const downloadEntries: readonly MenuEntry[] = Object.freeze([
  { command: 'tiktok' },
  { command: 'instagram', arguments: '<link>', description: 'Fotos, Reels e carrosséis.' },
  { command: 'kwai' },
  { command: 'igstory', arguments: '<link>', description: 'Stories disponíveis no Instagram.' },
  { command: 'facebook' },
  { command: 'gdrive' },
  { command: 'mediafire' },
  { command: 'twitter' },
]);

const downloadMediaEntries: readonly MenuEntry[] = Object.freeze([
  { command: 'pinterest' },
]);

const downloadGamesEntries: readonly MenuEntry[] = Object.freeze([
  { command: 'mcplugin' },
]);

export const DOWNLOAD_MENU_DEFINITION: MenuDefinition = Object.freeze({
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
          "description": "Pesquisar na web."
        },
        {
          "command": "noticias",
          "arguments": "[assunto]",
          "description": "Consultar notícias gerais ou sobre um assunto."
        },
        {
          "command": "apps",
          "arguments": "<nome>",
          "description": "Pesquisar aplicativos pelo nome."
        },
        {
          "command": "dicionario",
          "arguments": "<palavra>",
          "description": "Consultar o significado da palavra."
        },
        {
          "command": "wikipedia",
          "arguments": "<assunto>",
          "description": "Consultar um artigo sobre o assunto."
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
          "description": "Consultar a letra da música."
        },
        {
          "command": "play",
          "arguments": "<nome ou link>",
          "description": "Buscar uma música e enviar o áudio."
        },
        {
          "command": "play2",
          "arguments": "<nome ou link>",
          "description": "Buscar uma música e enviar o áudio por outro comando."
        },
        {
          "command": "spotify",
          "arguments": "<link>",
          "description": "Baixar o áudio de uma faixa pelo link do Spotify."
        },
        {
          "command": "soundcloud",
          "arguments": "<link>",
          "description": "Baixar o áudio pelo link do SoundCloud."
        }
      ]
    },
    {
      "id": "video",
      "title": "BUSCA DE VÍDEOS",
      "icon": "🎬",
      "entries": [
        {
          "command": "playvid",
          "arguments": "<nome ou link>",
          "description": "Buscar e enviar um vídeo."
        }
      ]
    },
    {
      "id": "downloads",
      "title": "DOWNLOADS POR LINK",
      "icon": "📥",
      "entries": [
        {
          "command": "tiktok",
          "arguments": "<link>",
          "description": "Baixar o vídeo pelo link do TikTok."
        },
        {
          "command": "instagram",
          "arguments": "<link>",
          "description": "Baixar fotos, Reels ou carrosséis pelo link."
        },
        {
          "command": "kwai",
          "arguments": "<link>",
          "description": "Baixar o vídeo pelo link do Kwai."
        },
        {
          "command": "igstory",
          "arguments": "<link>",
          "description": "Solicitar o download de um story disponível pelo link."
        },
        {
          "command": "facebook",
          "arguments": "<link>",
          "description": "Baixar o vídeo pelo link do Facebook."
        },
        {
          "command": "gdrive",
          "arguments": "<link>",
          "description": "Baixar um arquivo público pelo link do Drive."
        },
        {
          "command": "mediafire",
          "arguments": "<link>",
          "description": "Baixar um arquivo pelo link do MediaFire."
        },
        {
          "command": "twitter",
          "arguments": "<link>",
          "description": "Baixar a mídia de uma publicação pelo link."
        }
      ]
    },
    {
      "id": "media",
      "title": "BUSCA DE IMAGENS",
      "icon": "🎨",
      "entries": [
        {
          "command": "pinterest",
          "arguments": "<pesquisa>",
          "description": "Pesquisar imagens no Pinterest."
        }
      ]
    },
    {
      "id": "games",
      "title": "PLUGINS DE MINECRAFT",
      "icon": "✨",
      "entries": [
        {
          "command": "mcplugin",
          "arguments": "<nome>",
          "description": "Pesquisar plugins de Minecraft."
        }
      ]
    }
  ]
});

/**
 * Famílias só entram aqui quando têm inventário e teste de paridade próprios.
 */
export const MENU_DEFINITIONS: readonly MenuDefinition[] = Object.freeze([
  STICKER_MENU_DEFINITION,
  DOWNLOAD_MENU_DEFINITION,
]);
