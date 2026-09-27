import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "LOGOTIPOS 1TXT", entries: [
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
    ] },
    { title: "LOGOTIPOS 2TXT", entries: [
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
    ] },
];

export default async function menuLogos(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        title: "LOGOS", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
