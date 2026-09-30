import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "PESQUISAS & CONSULTAS", optionKey: "searchMenuTitle", entries: [
        {"command":"google"},
        {"command":"noticias"},
        {"command":"apps"},
        {"command":"dicionario"},
        {"command":"wikipedia"},
    ] },
    { title: "MÚSICA & ÁUDIO", optionKey: "audioMenuTitle", entries: [
        {"command":"letra"},
        {"command":"play"},
        {"command":"play2"},
        {"command":"spotify"},
        {"command":"soundcloud"},
    ] },
    { title: "VÍDEOS & STREAMING", optionKey: "videoMenuTitle", entries: [
        {"command":"playvid"},
    ] },
    { title: "DOWNLOADS", optionKey: "downloadMenuTitle", entries: [
        {"command":"tiktok"},
        {"command":"instagram","arguments":"<link>","description":"Fotos, Reels e carrosséis."},
        {"command":"kwai"},
        {"command":"igstory","arguments":"<link>","description":"Stories disponíveis no Instagram."},
        {"command":"facebook"},
        {"command":"gdrive"},
        {"command":"mediafire"},
        {"command":"twitter"},
    ] },
    { title: "MÍDIAS SOCIAIS", optionKey: "mediaMenuTitle", entries: [
        {"command":"pinterest"},
    ] },
    { title: "GAMING & APPS", optionKey: "gamesMenuTitle", entries: [
        {"command":"mcplugin"},
    ] },
];

export default async function menudown(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        options,
        title: "DOWNLOADS", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
