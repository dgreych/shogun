import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "GERADOR DE NICKS", icon: "👤", optionKey: "nicknameMenuTitle", entries: [
        {"command":"gerarnick", "description":"Gerar um nick estilizado."},
    ] },
    { title: "CAPTURA DE PÁGINAS & QR CODES", icon: "✨", optionKey: "captureMenuTitle", entries: [
        {"command":"ssweb", "description":"Capturar uma página a partir do link."},
        {"command":"qrcode","arguments":"<texto>", "description":"Gerar um QR code com o texto informado."},
        {"command":"lerqr","description":"Ler o QR code da imagem respondida."},
    ] },
    { title: "CALCULADORA", icon: "✨", entries: [
        {"command":"calc","arguments":"<expressão>", "description":"Calcular o resultado da expressão."},
        {"command":"calc","arguments":"converter <valor> <de> <para>", "description":"Converter um valor entre unidades."},
    ] },
    { title: "HORÓSCOPO & SIGNOS", icon: "✨", entries: [
        {"command":"horoscopo","arguments":"<signo>"},
        {"command":"signos"},
    ] },
    { title: "NOTAS PESSOAIS", icon: "👤", entries: [
        {"command":"nota","arguments":"add <texto>"},
        {"command":"notas", "description":"Listar suas notas pessoais."},
        {"command":"nota","arguments":"ver <id>"},
        {"command":"nota","arguments":"del <id>"},
        {"command":"nota","arguments":"fixar <id>"},
        {"command":"nota","arguments":"buscar <termo>"},
    ] },
    { title: "LINKS & UPLOADS", icon: "📥", optionKey: "linkMenuTitle", entries: [
        {"command":"encurtalink"},
        {"command":"upload"},
    ] },
    { title: "VERIFICAÇÃO DE LINKS", icon: "🛡️", optionKey: "securityMenuTitle", entries: [
        {"command":"verificar","arguments":"<link>", "description":"Consultar informações de segurança do link."},
    ] },
    { title: "TEMPO & CLIMA", icon: "🌤️", optionKey: "timeMenuTitle", entries: [
        {"command":"hora","arguments":"<cidade/país>", "description":"Consultar o horário da cidade ou país."},
        {"command":"clima","arguments":"<cidade>", "description":"Consultar o clima da cidade."},
    ] },
    { title: "DICIONÁRIO & TRADUÇÃO", icon: "✨", optionKey: "languageMenuTitle", entries: [
        {"command":"dicionario", "description":"Consultar o significado de uma palavra."},
        {"command":"tradutor", "description":"Traduzir o texto informado."},
    ] },
    { title: "LEMBRETES", icon: "📝", optionKey: "reminderMenuTitle", entries: [
        {"command":"lembrete"},
        {"command":"meuslembretes", "description":"Consultar seus lembretes."},
        {"command":"apagalembrete"},
    ] },
    { title: "ANIVERSÁRIOS & ESTATÍSTICAS", icon: "✨", entries: [
        {"command":"aniversario"},
        {"command":"estatisticas"},
    ] },
];

export default async function menuFerramentas(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        intro: "Consultas, cálculos, tradução, notas e lembretes.",
        footer: "Informe os dados indicados após o comando; para ler um QR code, responda à imagem com #prefix#lerqr.",
        options,
        title: "FERRAMENTAS", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
