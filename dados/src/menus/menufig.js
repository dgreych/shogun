import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "CRIAÇÃO DE FIGURINHAS", optionKey: "createStickerMenuTitle", entries: [
        {"command":"emojimix"},
        {"command":"ttp"},
        {"command":"attp"},
        {"command":"sticker"},
        {"command":"sticker2"},
        {"command":"sbg"},
        {"command":"sfundo"},
        {"command":"qc"},
        {"command":"brat"},
        {"command":"bratvid"},
    ] },
    { title: "GERENCIAMENTO", optionKey: "managementMenuTitle", entries: [
        {"command":"figualeatoria"},
        {"command":"figurinhas"},
        {"command":"rename"},
        {"command":"rgtake"},
        {"command":"take"},
        {"command":"toimg"},
    ] },
];

export default async function menuSticker(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        title: "FIGURINHAS", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
