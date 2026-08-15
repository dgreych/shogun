async function menuDono(prefix, botName = "MeuBot", userName = "Usuário", {
    header = `╭┈⊰ 🫟 『 *${botName}* 』\n┊💭 *Usuário:* #nome#\n┊👑 *Prefixo:* #prefix#\n╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯`,
    menuTopBorder = "╭┈",
    bottomBorder = "╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯",
    menuTitleIcon = "🍧ฺꕸ▸",
    menuItemIcon = "•.̇𖥨֗🫟⭟",
    separatorIcon = "❁",
    middleBorder = "┊", 
    botConfigMenuTitle = "🤖 CONFIGURAÇÕES DO BOT",
    menuDesignMenuTitle = "🎨 DESIGN & APARÊNCIA",
    automationMenuTitle = "⚙️ SISTEMA & AUTOMAÇÃO",
    commandCustomMenuTitle = "🛠️ PERSONALIZAÇÃO DE COMANDOS",
    commandLimitingMenuTitle = "🚫 LIMITAÇÃO DE COMANDOS",
    userManagementMenuTitle = "👥 GERENCIAMENTO DE USUÁRIOS",
    rentalSystemMenuTitle = "💰 SISTEMA DE ALUGUEL",
    subBotsMenuTitle = "🤖 GERENCIAMENTO DE SUB-BOTS",
    vipSystemMenuTitle = "💎 SISTEMA VIP/PREMIUM",
    botControlMenuTitle = "⚡ CONTROLE & MANUTENÇÃO",
    monitoringMenuTitle = "📊 MONITORAMENTO & ANÁLISE",
    broadcastMenuTitle = "📡 TRANSMISSÕES"
} = {}) {

    let formattedHeader = header
    .replace(/#nome#/g, userName)
    .replace(/#prefix#/g, prefix);
    
    return `${formattedHeader}

${menuTopBorder}${separatorIcon} *📚 INÍCIO*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}tutorial
${bottomBorder}

${menuTopBorder}${separatorIcon} *${botConfigMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}prefixo
${middleBorder}${menuItemIcon}${prefix}numerodono
${middleBorder}${menuItemIcon}${prefix}nomedono
${middleBorder}${menuItemIcon}${prefix}nomebot

${middleBorder}${menuItemIcon}${prefix}configcmdnotfound
${middleBorder}${menuItemIcon}${prefix}setcmdmsg
${middleBorder}${menuItemIcon}${prefix}fotobot
${middleBorder}${menuItemIcon}${prefix}fotomenu
${middleBorder}${menuItemIcon}${prefix}videomenu
${middleBorder}${menuItemIcon}${prefix}audiomenu
${middleBorder}${menuItemIcon}${prefix}lermais
${middleBorder}${menuItemIcon}${prefix}personalizargrupo
${bottomBorder}

${menuTopBorder}${separatorIcon} *${menuDesignMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}designmenu
${middleBorder}${menuItemIcon}${prefix}setborda
${middleBorder}${menuItemIcon}${prefix}setbordafim
${middleBorder}${menuItemIcon}${prefix}setbordameio
${middleBorder}${menuItemIcon}${prefix}setitem
${middleBorder}${menuItemIcon}${prefix}setseparador
${middleBorder}${menuItemIcon}${prefix}settitulo
${middleBorder}${menuItemIcon}${prefix}setheader
${middleBorder}${menuItemIcon}${prefix}resetdesign
${bottomBorder}

${menuTopBorder}${separatorIcon} *${automationMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}addauto
${middleBorder}${menuItemIcon}${prefix}addautomidia
${middleBorder}${menuItemIcon}${prefix}listauto
${middleBorder}${menuItemIcon}${prefix}delauto
${middleBorder}${menuItemIcon}${prefix}addreact
${middleBorder}${menuItemIcon}${prefix}listreact
${middleBorder}${menuItemIcon}${prefix}delreact
${middleBorder}${menuItemIcon}${prefix}addnopref
${middleBorder}${menuItemIcon}${prefix}listnopref
${middleBorder}${menuItemIcon}${prefix}delnopref
${bottomBorder}

${menuTopBorder}${separatorIcon} *${commandCustomMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}addcmd
${middleBorder}${menuItemIcon}${prefix}addcmdmidia
${middleBorder}${menuItemIcon}${prefix}listcmd
${middleBorder}${menuItemIcon}${prefix}delcmd
${middleBorder}${menuItemIcon}${prefix}testcmd
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}addalias
${middleBorder}${menuItemIcon}${prefix}listalias
${middleBorder}${menuItemIcon}${prefix}delalias
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}addblackglobal
${middleBorder}${menuItemIcon}${prefix}listblackglobal
${middleBorder}${menuItemIcon}${prefix}rmblackglobal
${bottomBorder}

${menuTopBorder}${separatorIcon} *${commandLimitingMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}cmdlimitar
${middleBorder}${menuItemIcon}${prefix}cmddeslimitar
${middleBorder}${menuItemIcon}${prefix}cmdlimites
${bottomBorder}

${menuTopBorder}${separatorIcon} *${userManagementMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}addsubdono
${middleBorder}${menuItemIcon}${prefix}delsubdono
${middleBorder}${menuItemIcon}${prefix}listasubdonos
${middleBorder}${menuItemIcon}${prefix}addpremium
${middleBorder}${menuItemIcon}${prefix}delpremium
${middleBorder}${menuItemIcon}${prefix}listprem
${middleBorder}${menuItemIcon}${prefix}resetgold
${middleBorder}
${middleBorder}${menuTitleIcon} *INDICAÇÕES* ${menuTitleIcon}
${middleBorder}${menuItemIcon}${prefix}addindicacao
${middleBorder}${menuItemIcon}${prefix}topindica
${middleBorder}${menuItemIcon}${prefix}delindicacao
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}bangp
${middleBorder}${menuItemIcon}${prefix}unbangp
${middleBorder}${menuItemIcon}${prefix}listbangp
${bottomBorder}

${menuTopBorder}${separatorIcon} *${rentalSystemMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}modoaluguel
${middleBorder}${menuItemIcon}${prefix}addaluguel
${middleBorder}${menuItemIcon}${prefix}gerarcod
${middleBorder}${menuItemIcon}${prefix}listaraluguel
${middleBorder}${menuItemIcon}${prefix}infoaluguel
${middleBorder}${menuItemIcon}${prefix}estenderaluguel
${middleBorder}${menuItemIcon}${prefix}removeraluguel
${middleBorder}${menuItemIcon}${prefix}listaluguel
${middleBorder}${menuItemIcon}${prefix}limparaluguel
${middleBorder}${menuItemIcon}${prefix}dayfree
${middleBorder}${menuItemIcon}${prefix}setdiv
${middleBorder}${menuItemIcon}${prefix}divulgar
${bottomBorder}

${menuTopBorder}${separatorIcon} *${subBotsMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}addsubbot
${middleBorder}${menuItemIcon}${prefix}removesubbot
${middleBorder}${menuItemIcon}${prefix}listarsubbots
${middleBorder}${menuItemIcon}${prefix}conectarsubbot
${middleBorder}
${middleBorder}🔑 Sub-bot use: ${prefix}gerarcodigo
${bottomBorder}

${menuTopBorder}${separatorIcon} *${vipSystemMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}addcmdvip
${middleBorder}${menuItemIcon}${prefix}removecmdvip
${middleBorder}${menuItemIcon}${prefix}listcmdvip
${middleBorder}${menuItemIcon}${prefix}togglecmdvip
${middleBorder}${menuItemIcon}${prefix}statsvip
${middleBorder}${menuItemIcon}${prefix}menuvip
${middleBorder}${menuItemIcon}${prefix}infovip
${bottomBorder}

${menuTopBorder}${separatorIcon} *${botControlMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}atualizar
${middleBorder}${menuItemIcon}${prefix}reiniciar
${middleBorder}${menuItemIcon}${prefix}entrar
${middleBorder}${menuItemIcon}${prefix}sairgp
${middleBorder}${menuItemIcon}${prefix}seradm
${middleBorder}${menuItemIcon}${prefix}sermembro
${middleBorder}${menuItemIcon}${prefix}blockcmdg
${middleBorder}${menuItemIcon}${prefix}unblockcmdg
${middleBorder}${menuItemIcon}${prefix}blockuserg
${middleBorder}${menuItemIcon}${prefix}unblockuserg
${middleBorder}${menuItemIcon}${prefix}listblocks
${middleBorder}${menuItemIcon}${prefix}antibanmarcar
${middleBorder}${menuItemIcon}${prefix}imagem
${bottomBorder}

${menuTopBorder}${separatorIcon} *${monitoringMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}listagp
${middleBorder}${menuItemIcon}${prefix}antipv
${middleBorder}${menuItemIcon}${prefix}antipv2
${middleBorder}${menuItemIcon}${prefix}antipv3
${middleBorder}${menuItemIcon}${prefix}antipv4
${middleBorder}${menuItemIcon}${prefix}antipvmsg
${middleBorder}${menuItemIcon}${prefix}antispamcmd
${middleBorder}${menuItemIcon}${prefix}viewmsg
${middleBorder}${menuItemIcon}${prefix}cases
${middleBorder}${menuItemIcon}${prefix}getcase
${middleBorder}${menuItemIcon}${prefix}modoliteglobal
${middleBorder}${menuItemIcon}${prefix}iaclear
${middleBorder}${menuItemIcon}${prefix}limpardb
${middleBorder}${menuItemIcon}${prefix}limparrankg
${middleBorder}${menuItemIcon}${prefix}reviverqr
${middleBorder}${menuItemIcon}${prefix}nuke
${middleBorder}${menuItemIcon}${prefix}msgprefix
${bottomBorder}

${menuTopBorder}${separatorIcon} *${broadcastMenuTitle}*
${middleBorder}
${middleBorder}${menuTitleIcon} *Transmissão em Grupos:*
${middleBorder}${menuItemIcon}${prefix}tm
${middleBorder}
${middleBorder}${menuTitleIcon} *Transmissão Privada:*
${middleBorder}${menuItemIcon}${prefix}tm2
${middleBorder}${menuItemIcon}${prefix}statustm
${middleBorder}
${middleBorder}📝 Usuários inscrevem com:
${middleBorder}   ${prefix}inscrevertm (no PV)
${middleBorder}
${middleBorder}${menuTitleIcon} *Divulgação do Dono (novo):*
${middleBorder}${menuItemIcon}${prefix}divdono add
${middleBorder}${menuItemIcon}${prefix}divdono rem
${middleBorder}${menuItemIcon}${prefix}divdono list
${middleBorder}${menuItemIcon}${prefix}divdono msg
${middleBorder}${menuItemIcon}${prefix}divdono send
${middleBorder}${menuItemIcon}${prefix}divdono time
${middleBorder}${menuItemIcon}${prefix}divdono status
${bottomBorder}
`;
}
export default menuDono;