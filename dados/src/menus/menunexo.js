export default async function menunexo(prefix, botName = "MeuBot", userName = "Usuário", {
    header = `╭┈⊰ 🫟 『 *${botName}* 』\n┊💭 *Usuário:* #nome#\n┊👑 *Prefixo:* #prefix#\n╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯`,
    menuTopBorder = "╭┈",
    bottomBorder = "╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯",
    menuTitleIcon = "🍧ฺꕸ▸",
    menuItemIcon = "•.̇𖥨֗🫟⭟",
    separatorIcon = "❁",
    middleBorder = "┊"
} = {}) {

    let formattedHeader = header
        .replace(/#nome#/g, userName)
        .replace(/#prefix#/g, prefix);

    return `${formattedHeader}

${menuTopBorder}${separatorIcon} ${menuTitleIcon} *NEXO: CRÔNICAS DA RUPTURA*
${middleBorder}
${middleBorder}🔰 *Administração (admin/moderador)*
${middleBorder}${menuItemIcon}${prefix}nexo ativar [casual|campanha|evento] -> ativa o Círculo neste grupo
${middleBorder}${menuItemIcon}${prefix}nexo confirmar <token> -> confirma a ativação
${middleBorder}${menuItemIcon}${prefix}nexo status -> estado atual do Círculo
${middleBorder}${menuItemIcon}${prefix}nexo desativar -> pausa sem apagar dados
${middleBorder}${menuItemIcon}${prefix}nexo versão -> versão instalada
${middleBorder}${menuItemIcon}${prefix}nexo ajuda [jogador|tutorial|combate|admin] -> menu detalhado por categoria
${middleBorder}
${middleBorder}🎭 *Jogador*
${middleBorder}${menuItemIcon}${prefix}entrar [rápido] -> cria seu personagem (Impulso + Cicatriz, Origem automática)
${middleBorder}${menuItemIcon}${prefix}continuar -> retoma uma escolha pendente
${middleBorder}${menuItemIcon}${prefix}painel -> mostra o estado do Círculo (com imagem)
${middleBorder}${menuItemIcon}${prefix}ficha -> sua ficha (com imagem)
${middleBorder}${menuItemIcon}${prefix}privado on|off -> respostas em DM ou no grupo
${middleBorder}${menuItemIcon}${prefix}cancelar -> cancela uma escolha pendente
${middleBorder}
${middleBorder}📖 *Tutorial -- "A Porta no Ruído"*
${middleBorder}${menuItemIcon}${prefix}tutorial -> mostra a etapa atual
${middleBorder}${menuItemIcon}${prefix}tutorial <número> -> escolhe a postura
${middleBorder}${menuItemIcon}${prefix}tutorial analisar -> tenta ler o que não foi dito
${middleBorder}${menuItemIcon}${prefix}tutorial agir <número> -> responde com uma técnica
${middleBorder}
${middleBorder}⚔️ *Combate -- Estação Zero*
${middleBorder}${menuItemIcon}${prefix}combate <inimigoId> <técnicaId> [postura] -> ataca um inimigo real
${middleBorder}${menuItemIcon}postura: cautela, pulso ou ruptura
${bottomBorder}`;
}
