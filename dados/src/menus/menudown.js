import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "PESQUISAS & CONSULTAS", icon: "💭", optionKey: "searchMenuTitle", entries: [
        {"command": "google", "arguments": "<pesquisa>", "description": "Encontre o que você procura na web."},
        {"command": "noticias", "arguments": "[assunto]", "description": "As notícias do tema que você escolher."},
        {"command": "apps", "arguments": "<nome>", "description": "Busque um aplicativo."},
        {"command": "dicionario", "arguments": "<palavra>", "description": "Uma palavra, seus significados."},
        {"command": "wikipedia", "arguments": "<assunto>", "description": "Conheça o assunto sem sair do chat."},
    ] },
    { title: "MÚSICA & ÁUDIO", icon: "🎧", optionKey: "audioMenuTitle", entries: [
        {"command": "letra", "arguments": "<música>", "description": "A letra para acompanhar o som."},
        {"command": "play", "arguments": "<nome ou link>", "description": "Sua música em áudio."},
        {"command": "play2", "arguments": "<nome ou link>", "description": "Outra opção para buscar sua música."},
        {"command": "spotify", "arguments": "<link>", "description": "Traga uma faixa do Spotify."},
        {"command": "soundcloud", "arguments": "<link>", "description": "Sua faixa do SoundCloud no chat."},
    ] },
    { title: "VÍDEOS & STREAMING", icon: "🎬", optionKey: "videoMenuTitle", entries: [
        {"command": "playvid", "arguments": "<nome ou link>", "description": "O vídeo da sua busca."},
    ] },
    { title: "DOWNLOADS", icon: "📥", optionKey: "downloadMenuTitle", entries: [
        {"command": "tiktok", "arguments": "<link>", "description": "Traga o vídeo para a conversa."},
        {"command":"instagram","arguments":"<link>","description":"Fotos, Reels e carrosséis."},
        {"command": "kwai", "arguments": "<link>", "description": "Baixe o vídeo que você encontrou."},
        {"command":"igstory","arguments":"<link>","description":"Stories disponíveis no Instagram."},
        {"command": "facebook", "arguments": "<link>", "description": "Um vídeo do Facebook, aqui no chat."},
        {"command": "gdrive", "arguments": "<link>", "description": "Receba um arquivo público do Drive."},
        {"command": "mediafire", "arguments": "<link>", "description": "Receba um arquivo do MediaFire."},
        {"command": "twitter", "arguments": "<link>", "description": "Traga a mídia de uma publicação."},
    ] },
    { title: "MÍDIAS SOCIAIS", icon: "🎨", optionKey: "mediaMenuTitle", entries: [
        {"command": "pinterest", "arguments": "<pesquisa>", "description": "Ideias visuais para sua busca."},
    ] },
    { title: "GAMING & APPS", icon: "✨", optionKey: "gamesMenuTitle", entries: [
        {"command": "mcplugin", "arguments": "<nome>", "description": "Encontre plugins de Minecraft."},
    ] },
];

export default async function menudown(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        intro: "Busque pelo nome ou mande o link. Eu trago a mídia.",
        footer: "Achou algo bom? Mande o link e deixe comigo.",
        options,
        title: "DOWNLOADS", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
