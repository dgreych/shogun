export default async function menu(prefix, botName = "MeuBot", userName, {
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

${menuTopBorder}${separatorIcon} ${menuTitleIcon} *MENU PRINCIPAL*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}menuia -> Inteligencias IAs
${middleBorder}${menuItemIcon}${prefix}menudown -> Downloads
${middleBorder}${menuItemIcon}${prefix}menulogos -> Logos
${middleBorder}${menuItemIcon}${prefix}menuadm -> Administração
${middleBorder}${menuItemIcon}${prefix}menubn -> Brincadeiras
${middleBorder}${menuItemIcon}${prefix}menudono -> Dono
${middleBorder}${menuItemIcon}${prefix}menumemb -> Membros
${middleBorder}${menuItemIcon}${prefix}ferramentas -> Ferramentas
${middleBorder}${menuItemIcon}${prefix}menufig -> Figurinhas
${middleBorder}${menuItemIcon}${prefix}alteradores -> Alteradores
${middleBorder}${menuItemIcon}${prefix}menurpg -> RPG
${middleBorder}${menuItemIcon}${prefix}menuvip -> VIP
${bottomBorder}`;
}