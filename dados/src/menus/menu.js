import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "FIGURINHAS & EDIÇÃO", icon: "🎨", entries: [
        {"command": "menufig", "description": "Criar figurinhas, remover fundos e editar créditos."},
        {"command": "menulogos", "description": "Gerar logos com um ou dois textos."},
        {"command": "alteradores", "description": "Cortar mídia e aplicar efeitos de áudio, vídeo e imagem."},
    ] },
    { title: "DOWNLOADS", icon: "📥", entries: [
        {"command": "menudown", "description": "Buscar músicas e baixar mídia ou arquivos por link."},
    ] },
    { title: "JOGOS & RPG", icon: "🎲", entries: [
        {"command": "menubn", "description": "Jogos, brincadeiras e interações entre membros."},
        {"command": "menurpg", "description": "Personagens, economia, equipamentos e batalhas."},
        {"command": "menunexo", "description": "Ativar o Nexo, criar personagem e jogar o tutorial."},
        {"command": "menumemb", "description": "Perfil, atividade, conquistas e rankings dos membros."},
    ] },
    { title: "IA & FERRAMENTAS", icon: "💭", entries: [
        {"command": "menushogun", "description": "Resumir, explicar, revisar textos e escolher o modelo de IA."},
        {"command": "ferramentas", "description": "Calculadora, tradução, notas, QR codes e lembretes."},
    ] },
    { title: "ADMINISTRAÇÃO", icon: "🛡️", entries: [
        {"command": "menuadm", "description": "Moderação, proteções e configurações do grupo."},
        {"command": "menudono", "description": "Configuração do bot, automações e controle da instância."},
    ] },
];

export default async function menu(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        intro: "Abra uma categoria para consultar os comandos e seus usos.",
        footer: "Digite o comando com o prefixo mostrado neste menu.",
        options,
        title: "MENU PRINCIPAL", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
