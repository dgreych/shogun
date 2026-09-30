import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "MÍDIA & CRIAÇÃO", icon: "🎨", entries: [
        {"command": "menudown", "description": "Músicas, vídeos e redes sociais."},
        {"command": "menufig", "description": "Transforme mídia em figurinha."},
        {"command": "menulogos", "description": "Seu nome com outra presença."},
        {"command": "alteradores", "description": "Efeitos para áudio, vídeo e imagem."},
    ] },
    { title: "JOGOS & INTERAÇÕES", icon: "🎲", entries: [
        {"command": "menubn", "description": "Jogos, desafios e interações."},
        {"command": "menumemb", "description": "Seu perfil, conquistas e rankings."},
        {"command": "menurpg", "description": "Aventuras, economia e batalhas."},
    ] },
    { title: "RECURSOS", icon: "💭", entries: [
        {"command": "ferramentas", "description": "Atalhos úteis para o dia a dia."},
        {"command": "menunexo", "description": "Nexo · Crônicas da Ruptura."},
        {"command": "menushogun", "description": "Converse, crie e explore ideias."},
    ] },
    { title: "ADMINISTRAÇÃO & GESTÃO", icon: "🛡️", entries: [
        {"command": "menuadm", "description": "Proteção e cuidado com o grupo."},
        {"command": "menudono", "description": "Ajustes e identidade do seu bot."},
    ] },
];

export default async function menu(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        intro: "Seu atalho para tudo que o Shogun faz.",
        footer: "Escolha sua rota. O resto é comigo.",
        options,
        title: "MENU PRINCIPAL", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
