import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "PERFIL & ESTATÍSTICAS", optionKey: "perfilMenuTitle", entries: [
        {"command":"perfil"},
        {"command":"meustatus"},
    ] },
    { title: "STATUS DO BOT", optionKey: "botStatusMenuTitle", entries: [
        {"command":"ping"},
        {"command":"statusbot"},
        {"command":"statusgp"},
        {"command":"regras"},
        {"command":"zipbot"},
        {"command":"gitbot"},
    ] },
    { title: "CONFIGURAÇÕES PESSOAIS", optionKey: "personalMenuTitle", entries: [
        {"command":"mention"},
        {"command":"afk"},
        {"command":"voltei"},
    ] },
    { title: "INTERAÇÃO SOCIAL", entries: [
        {"command":"roles"},
        {"command":"role.vou"},
        {"command":"role.nvou"},
        {"command":"role.confirmados"},
    ] },
    { title: "RANKINGS & GAMIFICAÇÃO", optionKey: "rankMenuTitle", entries: [
        {"command":"rankativo"},
        {"command":"rankinativo"},
        {"command":"rankativos"},
        {"command":"atividade"},
        {"command":"checkativo"},
        {"command":"totalcmd"},
        {"command":"topcmd"},
    ] },
    { title: "CONQUISTAS & PRESENTES", entries: [
        {"command":"conquistas"},
        {"command":"caixa","arguments":"diaria"},
        {"command":"caixa","arguments":"rara"},
        {"command":"caixa","arguments":"lendaria"},
        {"command":"presente","arguments":"@user <tipo>"},
        {"command":"inv"},
    ] },
    { title: "REPUTAÇÃO & DENÚNCIAS", entries: [
        {"command":"rep","arguments":"+ @user"},
        {"command":"rep","description":"@user"},
        {"command":"rep","arguments":"@user"},
        {"command":"toprep"},
        {"command":"denunciar","arguments":"@user <motivo>"},
        {"command":"denuncias"},
    ] },
    { title: "CONTEÚDO GAMER", optionKey: "gamingMenuTitle", entries: [
        {"command":"likeff"},
        {"command":"infoff"},
    ] },
];

export default async function menuMembros(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        title: "MEMBROS", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
