import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "PERFIL & ESTATÍSTICAS", icon: "👤", optionKey: "perfilMenuTitle", entries: [
        {"command":"perfil", "description":"Consultar seu perfil."},
        {"command":"meustatus"},
    ] },
    { title: "BOT & INFORMAÇÕES DO GRUPO", icon: "⚙️", optionKey: "botStatusMenuTitle", entries: [
        {"command":"ping", "description":"Consultar o tempo de resposta do bot."},
        {"command":"statusbot", "description":"Consultar o estado do bot."},
        {"command":"statusgp", "description":"Consultar informações do grupo."},
        {"command":"regras", "description":"Consultar as regras do grupo."},
        {"command":"zipbot"},
        {"command":"gitbot"},
    ] },
    { title: "CONFIGURAÇÕES PESSOAIS", icon: "🪄", optionKey: "personalMenuTitle", entries: [
        {"command":"mention"},
        {"command":"afk", "description":"Registrar sua ausência."},
        {"command":"voltei", "description":"Encerrar o estado de ausência."},
    ] },
    { title: "EVENTOS & CONFIRMAÇÕES", icon: "🫶", entries: [
        {"command":"roles", "description":"Consultar os eventos do grupo."},
        {"command":"role.vou", "description":"Confirmar presença em um evento."},
        {"command":"role.nvou", "description":"Informar que não participará de um evento."},
        {"command":"role.confirmados", "description":"Consultar participantes confirmados."},
    ] },
    { title: "ATIVIDADE & USO DE COMANDOS", icon: "🏆", optionKey: "rankMenuTitle", entries: [
        {"command":"rankativo", "description":"Consultar o ranking de atividade."},
        {"command":"rankinativo"},
        {"command":"rankativos"},
        {"command":"atividade"},
        {"command":"checkativo"},
        {"command":"totalcmd"},
        {"command":"topcmd", "description":"Consultar os comandos mais usados."},
    ] },
    { title: "CONQUISTAS & PRESENTES", icon: "🏆", entries: [
        {"command":"conquistas"},
        {"command":"caixa","arguments":"diaria"},
        {"command":"caixa","arguments":"rara"},
        {"command":"caixa","arguments":"lendaria"},
        {"command":"presente","arguments":"@user <tipo>"},
        {"command":"inv"},
    ] },
    { title: "REPUTAÇÃO & DENÚNCIAS", icon: "✨", entries: [
        {"command":"repbn","arguments":"+ @user"},
        {"command":"repbn","arguments":"- @user"},
        {"command":"repbn","arguments":"@user"},
        {"command":"toprep"},
        {"command":"denunciar","arguments":"@user <motivo>", "description":"Registrar uma denúncia com o motivo."},
        {"command":"denuncias"},
    ] },
    { title: "FREE FIRE", icon: "✨", optionKey: "gamingMenuTitle", entries: [
        {"command":"likeff"},
        {"command":"infoff"},
    ] },
];

export default async function menuMembros(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        intro: "Perfil, atividade, conquistas e participação no grupo.",
        footer: "Consulte seu perfil com #prefix#perfil e sua atividade com #prefix#atividade.",
        options,
        title: "MEMBROS", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
