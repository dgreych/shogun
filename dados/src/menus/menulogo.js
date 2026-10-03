import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "LOGOS COM UM TEXTO", icon: "🎨", entries: [
        {"command":"darkgreen"},
        {"command":"glitch"},
        {"command":"write"},
        {"command":"advanced"},
        {"command":"typography"},
        {"command":"pixel"},
        {"command":"neon"},
        {"command":"flag"},
        {"command":"americanflag"},
        {"command":"deleting"},
    ], notes: ["Envie o texto depois do nome do efeito."] },
    { title: "LOGOS COM DOIS TEXTOS", icon: "🎨", entries: [
        {"command":"pornhub"},
        {"command":"avengers"},
        {"command":"graffiti"},
        {"command":"captainamerica"},
        {"command":"stone3d"},
        {"command":"neon2"},
        {"command":"thor"},
        {"command":"amongus"},
        {"command":"deadpool"},
        {"command":"blackpink"},
    ], notes: ["Separe as duas partes com /: texto 1/texto 2."] },
];

export default async function menuLogos(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        intro: "Efeitos de texto para logos com uma ou duas partes.",
        footer: "Use #prefix#neon seu texto ou #prefix#avengers texto 1/texto 2.",
        options,
        title: "LOGOS", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
