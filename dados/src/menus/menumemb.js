import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "PERFIL & ESTATÍSTICAS", icon: "👤", optionKey: "perfilMenuTitle", entries: [
        {"command":"perfil"},
        {"command":"meustatus"},
    ] },
    { title: "STATUS DO BOT", icon: "⚙️", optionKey: "botStatusMenuTitle", entries: [
        {"command":"ping"},
        {"command":"statusbot"},
        {"command":"statusgp"},
        {"command":"regras"},
        {"command":"zipbot"},
        {"command":"gitbot"},
    ] },
    { title: "CONFIGURAÇÕES PESSOAIS", icon: "🪄", optionKey: "personalMenuTitle", entries: [
        {"command":"mention"},
        {"command":"afk"},
        {"command":"voltei"},
    ] },
    { title: "INTERAÇÃO SOCIAL", icon: "🫶", entries: [
        {"command":"roles"},
        {"command":"role.vou"},
        {"command":"role.nvou"},
        {"command":"role.confirmados"},
    ] },
    { title: "RANKINGS & GAMIFICAÇÃO", icon: "🏆", optionKey: "rankMenuTitle", entries: [
        {"command":"rankativo"},
        {"command":"rankinativo"},
        {"command":"rankativos"},
        {"command":"atividade"},
        {"command":"checkativo"},
        {"command":"totalcmd"},
        {"command":"topcmd"},
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
        {"command":"denunciar","arguments":"@user <motivo>"},
        {"command":"denuncias"},
    ] },
    { title: "CONTEÚDO GAMER", icon: "✨", optionKey: "gamingMenuTitle", entries: [
        {"command":"likeff"},
        {"command":"infoff"},
    ] },
];

export default async function menuMembros(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        intro: "Seu espaço no grupo: presença, conquistas e histórias.",
        footer: "Veja seu perfil com #prefix#perfil.",
        options,
        title: "MEMBROS", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
