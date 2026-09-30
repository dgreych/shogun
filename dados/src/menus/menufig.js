import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "CRIAÇÃO DE FIGURINHAS", icon: "🪄", optionKey: "createStickerMenuTitle", entries: [
        {"command": "emojimix", "description": "Dois emojis, uma combinação."},
        {"command": "ttp", "description": "Seu texto vira figurinha."},
        {"command": "attp", "description": "Texto com movimento."},
        {"command": "sticker", "description": "Foto ou vídeo viram figurinha."},
        {"command": "sticker2", "description": "Outra opção para criar sua figurinha."},
        {"command": "sbg", "description": "Uma figurinha sem fundo."},
        {"command": "sfundo", "description": "Remova o fundo da sua mídia."},
        {"command": "qc", "description": "Uma mensagem com cara de figurinha."},
        {"command": "brat", "description": "Seu texto no estilo brat."},
        {"command": "bratvid", "description": "Seu texto brat em movimento."},
    ] },
    { title: "GERENCIAMENTO", icon: "⚙️", optionKey: "managementMenuTitle", entries: [
        {"command": "figualeatoria", "description": "Uma surpresa do acervo."},
        {"command": "figurinhas", "description": "Explore seu acervo."},
        {"command": "rename", "description": "Troque os créditos da figurinha."},
        {"command": "rgtake", "description": "Defina seus créditos preferidos."},
        {"command": "take", "description": "Assine uma figurinha."},
        {"command": "toimg", "description": "Volte da figurinha para a imagem."},
    ] },
];

export default async function menuSticker(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        intro: "Sua próxima figurinha começa aqui.",
        footer: "Responda uma foto ou um vídeo com #prefix#sticker.",
        options,
        title: "FIGURINHAS", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
