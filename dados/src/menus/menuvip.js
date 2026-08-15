import { groupVipCommandsByCategory, getVipStats } from '../utils/vipCommandsManager.js';

/**
 * Gera o menu VIP dinamicamente baseado nos comandos cadastrados
 */
async function menuVIP(prefix, botName = "MeuBot", userName = "Usuário", {
    header = `╭┈⊰ 🫟 『 *${botName}* 』\n┊💭 *Usuário:* #nome#\n┊👑 *Prefixo:* #prefix#\n╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯`,
    menuTopBorder = "╭┈",
    bottomBorder = "╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯",
    menuTitleIcon = "🍧ฺꕸ▸",
    menuItemIcon = "•.̇𖥨֗🫟⭟",
    separatorIcon = "❁",
    middleBorder = "┊"
} = {}) {
  try {
    const grouped = groupVipCommandsByCategory();
    const stats = getVipStats();
    
    let formattedHeader = header
    .replace(/#nome#/g, userName)
    .replace(/#prefix#/g, prefix);
    
    let menu = `${formattedHeader}

`;

    if (stats.active === 0) {
      menu += `${menuTopBorder}${separatorIcon} *👑 COMANDOS VIP*
${middleBorder}
${middleBorder}📭 Nenhum comando cadastrado
${middleBorder}
${middleBorder}💡 Dono pode adicionar com:
${middleBorder}${menuItemIcon}${prefix}addcmdvip
${bottomBorder}
`;
      return menu;
    }

    Object.entries(grouped).forEach(([categoryKey, categoryData]) => {
      menu += `${menuTopBorder}${separatorIcon} *${categoryData.label}*\n${middleBorder}\n`;
      categoryData.commands.forEach((cmd) => {
        menu += `${middleBorder}${menuItemIcon}${prefix}${cmd.command}\n`;
      });
      menu += `${bottomBorder}\n\n`;
    });

    menu += `${menuTopBorder}${separatorIcon} *ℹ️ INFORMAÇÕES VIP*
${middleBorder}
${middleBorder}• Comandos: ${stats.active}
${middleBorder}• Categorias: ${stats.categories}
${middleBorder}• ${prefix}infovip
${middleBorder}• ${prefix}dono
${bottomBorder}
`;

    return menu;
  } catch (error) {
    console.error('Erro ao gerar menu VIP:', error);
    return `❌ Erro ao carregar menu VIP.`;
  }
}

async function menuVIPInfo(prefix, botName = "MeuBot", userName = "Usuário", {
  header = `╭┈⊰ 🫟 『 *${botName}* 』\n┊Olá, #user#!\n╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯`,
  menuTopBorder = "╭┈",
  bottomBorder = "╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯",
  separatorIcon = "❁",
  middleBorder = "┊"
} = {}) {
  const stats = getVipStats();
  const formattedHeader = header.replace(/#user#/g, userName);
  
  let info = `${formattedHeader}

${menuTopBorder}${separatorIcon} *📊 ESTATÍSTICAS*
${middleBorder}
${middleBorder}• Ativos: ${stats.active}
${middleBorder}• Inativos: ${stats.inactive}
${middleBorder}• Total: ${stats.total}
${middleBorder}• Categorias: ${stats.categories}
${bottomBorder}

${menuTopBorder}${separatorIcon} *💎 COMO SER VIP*
${middleBorder}
${middleBorder}1. Contate o dono
${middleBorder}2. ${prefix}dono
${middleBorder}3. Solicite acesso VIP
${bottomBorder}

${menuTopBorder}${separatorIcon} *✨ BENEFÍCIOS*
${middleBorder}
${middleBorder}✅ Comandos exclusivos
${middleBorder}✅ Sem limites
${middleBorder}✅ Prioridade
${middleBorder}✅ Suporte dedicado
${bottomBorder}
`;

  return info;
}

async function listVIPCommands(prefix, botName = "MeuBot", userName = "Usuário", {
  header = `╭┈⊰ 🫟 『 *${botName}* 』\n┊Olá, #user#!\n╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯`,
  menuTopBorder = "╭┈",
  bottomBorder = "╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯",
  menuItemIcon = "•.̇𖥨֗🫟⭟",
  separatorIcon = "❁",
  middleBorder = "┊"
} = {}) {
  const grouped = groupVipCommandsByCategory();
  const stats = getVipStats();
  const formattedHeader = header.replace(/#user#/g, userName);
  
  if (stats.active === 0) {
    return `📭 Nenhum comando VIP cadastrado.

${prefix}addcmdvip <cmd> | <desc> | <cat>

Categorias: download, diversao, utilidade, ia, editor, info, outros`;
  }
  
  let list = `${formattedHeader}

${menuTopBorder}${separatorIcon} *👑 COMANDOS VIP*
${middleBorder}
${middleBorder}Total: ${stats.active}
${middleBorder}Categorias: ${stats.categories}
${bottomBorder}

`;

  Object.entries(grouped).forEach(([categoryKey, categoryData]) => {
    list += `${menuTopBorder}${separatorIcon} *${categoryData.label}*\n${middleBorder}\n`;
    categoryData.commands.forEach((cmd) => {
      list += `${middleBorder}${menuItemIcon}${cmd.command}\n`;
      list += `${middleBorder}   └─ ${cmd.description}\n`;
    });
    list += `${bottomBorder}\n\n`;
  });

  return list;
}

export {
  menuVIP,
  menuVIPInfo,
  listVIPCommands
};
