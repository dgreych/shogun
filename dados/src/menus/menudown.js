import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "PESQUISAS & CONSULTAS", icon: "💭", optionKey: "searchMenuTitle", entries: [
        {"command": "google", "arguments": "<pesquisa>", "description":"Pesquisar na web."},
        {"command": "noticias", "arguments": "[assunto]", "description":"Consultar notícias gerais ou sobre um assunto."},
        {"command": "apps", "arguments": "<nome>", "description":"Pesquisar aplicativos pelo nome."},
        {"command": "dicionario", "arguments": "<palavra>", "description":"Consultar o significado da palavra."},
        {"command": "wikipedia", "arguments": "<assunto>", "description":"Consultar um artigo sobre o assunto."},
    ] },
    { title: "MÚSICA & ÁUDIO", icon: "🎧", optionKey: "audioMenuTitle", entries: [
        {"command": "letra", "arguments": "<música>", "description":"Consultar a letra da música."},
        {"command": "play", "arguments": "<nome ou link>", "description":"Buscar uma música e enviar o áudio."},
        {"command": "play2", "arguments": "<nome ou link>", "description":"Buscar uma música e enviar o áudio por outro comando."},
        {"command": "spotify", "arguments": "<link>", "description":"Baixar o áudio de uma faixa pelo link do Spotify."},
        {"command": "soundcloud", "arguments": "<link>", "description":"Baixar o áudio pelo link do SoundCloud."},
    ] },
    { title: "BUSCA DE VÍDEOS", icon: "🎬", optionKey: "videoMenuTitle", entries: [
        {"command": "playvid", "arguments": "<nome ou link>", "description":"Buscar e enviar um vídeo."},
    ] },
    { title: "DOWNLOADS POR LINK", icon: "📥", optionKey: "downloadMenuTitle", entries: [
        {"command": "tiktok", "arguments": "<link>", "description":"Baixar o vídeo pelo link do TikTok."},
        {"command":"instagram","arguments":"<link>","description":"Baixar fotos, Reels ou carrosséis pelo link."},
        {"command": "kwai", "arguments": "<link>", "description":"Baixar o vídeo pelo link do Kwai."},
        {"command":"igstory","arguments":"<link>","description":"Solicitar o download de um story disponível pelo link."},
        {"command": "facebook", "arguments": "<link>", "description":"Baixar o vídeo pelo link do Facebook."},
        {"command": "gdrive", "arguments": "<link>", "description":"Baixar um arquivo público pelo link do Drive."},
        {"command": "mediafire", "arguments": "<link>", "description":"Baixar um arquivo pelo link do MediaFire."},
        {"command": "twitter", "arguments": "<link>", "description":"Baixar a mídia de uma publicação pelo link."},
    ] },
    { title: "BUSCA DE IMAGENS", icon: "🎨", optionKey: "mediaMenuTitle", entries: [
        {"command": "pinterest", "arguments": "<pesquisa>", "description":"Pesquisar imagens no Pinterest."},
    ] },
    { title: "PLUGINS DE MINECRAFT", icon: "✨", optionKey: "gamesMenuTitle", entries: [
        {"command": "mcplugin", "arguments": "<nome>", "description":"Pesquisar plugins de Minecraft."},
    ] },
];

export default async function menudown(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        intro: "Pesquisas e downloads de música, vídeo, imagens e arquivos.",
        footer: "Informe um nome para pesquisar ou um link para baixar, conforme o comando.",
        options,
        title: "DOWNLOADS", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
