async function menuTopCmd(prefix, botName = "MeuBot", userName = "Usuário", topCommands = [], {
    header = `╭┈⊰ 🫟 『 *${botName}* 』\n┊💭 *Usuário:* #nome#\n┊👑 *Prefixo:* #prefix#\n╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯`,
    menuTopBorder = "╭┈",
    bottomBorder = "╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯",
    menuTitleIcon = "🍧ฺꕸ▸",
    menuItemIcon = "•.̇𖥨֗🫟⭟",
    separatorIcon = "❁",
    middleBorder = "┊", 
    topCommandsMenuTitle = "MAIS USADOS",
    infoSectionTitle = "Informações"
} = {}) {

    let formattedHeader = header
    .replace(/#nome#/g, userName)
    .replace(/#prefix#/g, prefix);
    
    
    if (!topCommands || topCommands.length === 0) {
return `${formattedHeader}

${menuTopBorder}${separatorIcon} *${topCommandsMenuTitle}*
${middleBorder}
${middleBorder} Nenhum comando foi registrado ainda.
${middleBorder} Use ${prefix}menu para ver a lista
${middleBorder} de comandos disponíveis!
${middleBorder}
${bottomBorder}
`;
    }
    const commandsList = topCommands.map((cmd, index) => {
        const position = index + 1;
        const emoji = position <= 3 ? ['🥇', '🥈', '🥉'][index] : '🏅';
        return `${middleBorder}${emoji} ${position}º: *${prefix}${cmd.name}*\n${middleBorder}   ↳ ${cmd.count} usos por ${cmd.uniqueUsers} usuários`;
    }).join('\n');
    return `
${formattedHeader}

${menuTopBorder}${separatorIcon} *Top ${topCommands.length} Comandos*
${commandsList}
${middleBorder}
${middleBorder}╭─▸ *${infoSectionTitle}:*
${middleBorder}
${middleBorder}🔍 Use ${prefix}cmdinfo [comando]
${middleBorder}   ↳ Para ver estatísticas detalhadas
${middleBorder}   ↳ Ex: ${prefix}cmdinfo menu
${middleBorder}
${bottomBorder}
`;
}
export default menuTopCmd;