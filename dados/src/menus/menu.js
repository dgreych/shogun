import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "MÍDIA & CRIAÇÃO", entries: [
        {"command":"menudown"},
        {"command":"menufig"},
        {"command":"menulogos"},
        {"command":"alteradores"},
    ] },
    { title: "JOGOS & INTERAÇÕES", entries: [
        {"command":"menubn"},
        {"command":"menumemb"},
        {"command":"menurpg"},
    ] },
    { title: "RECURSOS", entries: [
        {"command":"ferramentas"},
        {"command":"menunexo"},
        {"command":"menushogun"},
    ] },
    { title: "ADMINISTRAÇÃO & GESTÃO", entries: [
        {"command":"menuadm"},
        {"command":"menudono"},
    ] },
];

export default async function menu(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        title: "MENU PRINCIPAL", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
