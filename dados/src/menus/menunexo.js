import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "GESTÃO DO CÍRCULO", icon: "🌀", entries: [
        {"command":"nexo","arguments":"ativar [casual|campanha|evento]","description":"Ativar o Círculo neste grupo."},
        {"command":"nexo","arguments":"confirmar <token>","description":"Confirmar a ativação."},
        {"command":"nexo","arguments":"desativar","description":"Pausar sem apagar os dados."},
    ] },
    { title: "CONSULTAS & AJUDA", icon: "💭", entries: [
        {"command":"nexo","arguments":"status","description":"Consultar o estado do Círculo."},
        {"command":"nexo","arguments":"versão","description":"Consultar a versão instalada."},
        {"command":"nexo","arguments":"ajuda [jogador|tutorial|combate|admin]","description":"Consultar a ajuda por categoria."},
    ] },
    { title: "PERSONAGEM & JOGO", icon: "🎲", entries: [
        {"command":"entrar","arguments":"[rápido]","description":"Criar personagem com Impulso e Cicatriz; origem automática."},
        {"command":"continuar","description":"Retomar uma escolha pendente."},
        {"command":"painel","description":"Ver o estado do Círculo com imagem."},
        {"command":"ficha","description":"Ver sua ficha com imagem."},
        {"command":"privado","arguments":"on|off","description":"Escolher respostas no privado ou no grupo."},
        {"command":"cancelar","description":"Cancelar uma escolha pendente."},
    ] },
    { title: "TUTORIAL · A PORTA NO RUÍDO", icon: "🌀", entries: [
        {"command":"tutorial","description":"Ver a etapa atual."},
        {"command":"tutorial","arguments":"<número>","description":"Escolher uma postura."},
        {"command":"tutorial","arguments":"analisar","description":"Analisar a situação."},
        {"command":"tutorial","arguments":"agir <número>","description":"Usar uma técnica."},
    ] },
    { title: "COMBATE · ESTAÇÃO ZERO", icon: "⚔️", entries: [
        {"command":"combate","arguments":"<inimigoId> <técnicaId> [postura]","description":"Atacar um inimigo do combate."},
    ], notes: ["Posturas: cautela, pulso ou ruptura."] },
];

export default async function menuNexo(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        intro: "Algo rompeu o silêncio. Seu círculo decide o que vem depois.",
        footer: "Comece por #prefix#nexo ajuda. A história espera vocês.",
        options,
        title: "NEXO · CRÔNICAS DA RUPTURA", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
