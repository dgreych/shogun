import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "Administração (admin/moderador)", entries: [
        {"command":"nexo","arguments":"ativar [casual|campanha|evento]","description":"ativa o Círculo neste grupo"},
        {"command":"nexo","arguments":"confirmar <token>","description":"confirma a ativação"},
        {"command":"nexo","arguments":"status","description":"estado atual do Círculo"},
        {"command":"nexo","arguments":"desativar","description":"pausa sem apagar dados"},
        {"command":"nexo","arguments":"versão","description":"versão instalada"},
        {"command":"nexo","arguments":"ajuda [jogador|tutorial|combate|admin]","description":"menu detalhado por categoria"},
    ] },
    { title: "Jogador", entries: [
        {"command":"entrar","arguments":"[rápido]","description":"cria seu personagem (Impulso + Cicatriz, Origem automática)"},
        {"command":"continuar","description":"retoma uma escolha pendente"},
        {"command":"painel","description":"mostra o estado do Círculo (com imagem)"},
        {"command":"ficha","description":"sua ficha (com imagem)"},
        {"command":"privado","arguments":"on|off","description":"respostas em DM ou no grupo"},
        {"command":"cancelar","description":"cancela uma escolha pendente"},
    ] },
    { title: "Tutorial -- \"A Porta no Ruído\"", entries: [
        {"command":"tutorial","description":"mostra a etapa atual"},
        {"command":"tutorial","arguments":"<número>","description":"escolhe a postura"},
        {"command":"tutorial","arguments":"analisar","description":"tenta ler o que não foi dito"},
        {"command":"tutorial","arguments":"agir <número>","description":"responde com uma técnica"},
    ] },
    { title: "Combate -- Estação Zero", entries: [
        {"command":"combate","arguments":"<inimigoId> <técnicaId> [postura]","description":"ataca um inimigo real"},
    ], notes: ["postura: cautela, pulso ou ruptura"] },
];

export default async function menuNexo(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        title: "NEXO · CRÔNICAS DA RUPTURA", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
