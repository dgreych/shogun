import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "GERADOR DE NOMES & IDENTIDADE", optionKey: "nicknameMenuTitle", entries: [
        {"command":"gerarnick"},
    ] },
    { title: "CAPTURAS & VISUALIZAÇÃO", optionKey: "captureMenuTitle", entries: [
        {"command":"ssweb"},
        {"command":"qrcode","arguments":"<texto>"},
        {"command":"lerqr","arguments":"(responda imagem)"},
    ] },
    { title: "CALCULADORA", entries: [
        {"command":"calc","arguments":"<expressão>"},
        {"command":"calc","arguments":"converter <valor> <de> <para>"},
    ] },
    { title: "HORÓSCOPO & MISTICISMO", entries: [
        {"command":"horoscopo","arguments":"<signo>"},
        {"command":"signos"},
    ] },
    { title: "NOTAS PESSOAIS", entries: [
        {"command":"nota","arguments":"add <texto>"},
        {"command":"notas"},
        {"command":"nota","arguments":"ver <id>"},
        {"command":"nota","arguments":"del <id>"},
        {"command":"nota","arguments":"fixar <id>"},
        {"command":"nota","arguments":"buscar <termo>"},
    ] },
    { title: "LINKS & UPLOADS", optionKey: "linkMenuTitle", entries: [
        {"command":"encurtalink"},
        {"command":"upload"},
    ] },
    { title: "SEGURANÇA", optionKey: "securityMenuTitle", entries: [
        {"command":"verificar","arguments":"<link>"},
    ] },
    { title: "TEMPO & CLIMA", optionKey: "timeMenuTitle", entries: [
        {"command":"hora","arguments":"<cidade/país>"},
        {"command":"clima","arguments":"<cidade>"},
    ] },
    { title: "DICIONÁRIO & TRADUÇÃO", optionKey: "languageMenuTitle", entries: [
        {"command":"dicionario"},
        {"command":"tradutor"},
    ] },
    { title: "LEMBRETES & LISTAS", optionKey: "reminderMenuTitle", entries: [
        {"command":"lembrete"},
        {"command":"meuslembretes"},
        {"command":"apagalembrete"},
    ] },
    { title: "OUTROS", entries: [
        {"command":"aniversario"},
        {"command":"estatisticas"},
    ] },
];

export default async function menuFerramentas(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        title: "FERRAMENTAS", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
