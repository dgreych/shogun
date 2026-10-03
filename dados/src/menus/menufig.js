import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "CRIAÇÃO DE FIGURINHAS", icon: "🪄", optionKey: "createStickerMenuTitle", entries: [
        {"command": "emojimix", "description":"Combinar dois emojis em uma figurinha."},
        {"command": "ttp", "description":"Criar uma figurinha de texto."},
        {"command": "attp", "description":"Criar uma figurinha de texto animado."},
        {"command": "sticker", "description":"Converter uma imagem ou um vídeo em figurinha."},
        {"command": "sticker2", "description":"Converter imagem ou vídeo de até 9,9 segundos em figurinha."},
        {"command": "sbg", "description":"Remover o fundo da imagem e enviar como figurinha."},
        {"command": "sfundo", "description":"Remover o fundo da imagem e enviar como figurinha."},
        {"command": "qc", "description":"Criar uma figurinha de mensagem."},
        {"command": "brat", "description":"Criar uma figurinha de texto no estilo brat."},
        {"command": "bratvid", "description":"Criar uma figurinha animada de texto no estilo brat."},
    ] },
    { title: "ACERVO, CRÉDITOS & CONVERSÃO", icon: "⚙️", optionKey: "managementMenuTitle", entries: [
        {"command": "figualeatoria", "description":"Enviar uma figurinha aleatória do acervo."},
        {"command": "figurinhas", "description":"Enviar de 1 a 15 figurinhas; em grupos, a entrega é no privado."},
        {"command": "rename", "description":"Alterar autor e pacote da figurinha respondida."},
        {"command": "rgtake", "description":"Salvar autor e pacote no formato Autor/Pack."},
        {"command": "take", "description":"Aplicar os créditos salvos à figurinha respondida."},
        {"command": "toimg", "description":"Converter uma figurinha em imagem."},
    ] },
];

export default async function menuSticker(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        intro: "Criação de figurinhas a partir de texto, imagem ou vídeo.",
        footer: "Responda à foto ou ao vídeo com #prefix#sticker; para texto, use #prefix#ttp seu texto.",
        options,
        title: "FIGURINHAS", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
