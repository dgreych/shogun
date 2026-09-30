import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "GERADOR DE NOMES & IDENTIDADE", icon: "👤", optionKey: "nicknameMenuTitle", entries: [
        {"command":"gerarnick"},
    ] },
    { title: "CAPTURAS & VISUALIZAÇÃO", icon: "✨", optionKey: "captureMenuTitle", entries: [
        {"command":"ssweb"},
        {"command":"qrcode","arguments":"<texto>"},
        {"command":"lerqr","description":"Responda à imagem com o código."},
    ] },
    { title: "CALCULADORA", icon: "✨", entries: [
        {"command":"calc","arguments":"<expressão>"},
        {"command":"calc","arguments":"converter <valor> <de> <para>"},
    ] },
    { title: "HORÓSCOPO & MISTICISMO", icon: "✨", entries: [
        {"command":"horoscopo","arguments":"<signo>"},
        {"command":"signos"},
    ] },
    { title: "NOTAS PESSOAIS", icon: "👤", entries: [
        {"command":"nota","arguments":"add <texto>"},
        {"command":"notas"},
        {"command":"nota","arguments":"ver <id>"},
        {"command":"nota","arguments":"del <id>"},
        {"command":"nota","arguments":"fixar <id>"},
        {"command":"nota","arguments":"buscar <termo>"},
    ] },
    { title: "LINKS & UPLOADS", icon: "📥", optionKey: "linkMenuTitle", entries: [
        {"command":"encurtalink"},
        {"command":"upload"},
    ] },
    { title: "SEGURANÇA", icon: "🛡️", optionKey: "securityMenuTitle", entries: [
        {"command":"verificar","arguments":"<link>"},
    ] },
    { title: "TEMPO & CLIMA", icon: "🌤️", optionKey: "timeMenuTitle", entries: [
        {"command":"hora","arguments":"<cidade/país>"},
        {"command":"clima","arguments":"<cidade>"},
    ] },
    { title: "DICIONÁRIO & TRADUÇÃO", icon: "✨", optionKey: "languageMenuTitle", entries: [
        {"command":"dicionario"},
        {"command":"tradutor"},
    ] },
    { title: "LEMBRETES & LISTAS", icon: "📝", optionKey: "reminderMenuTitle", entries: [
        {"command":"lembrete"},
        {"command":"meuslembretes"},
        {"command":"apagalembrete"},
    ] },
    { title: "OUTROS", icon: "✨", entries: [
        {"command":"aniversario"},
        {"command":"estatisticas"},
    ] },
];

export default async function menuFerramentas(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        intro: "As pequenas soluções que salvam o dia.",
        footer: "Escolha uma ferramenta e me passe o que você precisa.",
        options,
        title: "FERRAMENTAS", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
