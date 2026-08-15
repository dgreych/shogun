export default async function menuadm(prefix, botName = "MeuBot", userName = "Usuário", {
    header = `╭┈⊰ 🫟 『 *${botName}* 』\n┊💭 *Usuário:* #nome#\n┊👑 *Prefixo:* #prefix#\n╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯`,
    menuTopBorder = "╭┈",
    bottomBorder = "╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯",
    menuTitleIcon = "🍧ฺꕸ▸",
    menuItemIcon = "•.̇𖥨֗🫟⭟",
    separatorIcon = "❁",
    middleBorder = "┊", 
    adminMenuTitle = "🛡️ GESTÃO DE USUÁRIOS",
    managementMenuTitle = "💬 GESTÃO DO GRUPO",
    securityMenuTitle = "🔒 SEGURANÇA",
    moderatorsMenuTitle = "👥 MODERADORES",
    partnershipsMenuTitle = "🤝 PARCERIAS",
    activationsMenuTitle = "⚡ ATIVAÇÕES",
    settingsMenuTitle = "🎨 CONFIGURAÇÕES"
} = {}) {

    let formattedHeader = header
    .replace(/#nome#/g, userName)
    .replace(/#prefix#/g, prefix);
    
    return `${formattedHeader}

${menuTopBorder}${separatorIcon} *${adminMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}ban
${middleBorder}${menuItemIcon}${prefix}ban2
${middleBorder}${menuItemIcon}${prefix}bam (ban fake)
${middleBorder}${menuItemIcon}${prefix}setbammsg
${middleBorder}${menuItemIcon}${prefix}promover
${middleBorder}${menuItemIcon}${prefix}rebaixar
${middleBorder}${menuItemIcon}${prefix}mute
${middleBorder}${menuItemIcon}${prefix}desmute
${middleBorder}${menuItemIcon}${prefix}mute2
${middleBorder}${menuItemIcon}${prefix}desmute2
${middleBorder}${menuItemIcon}${prefix}adv
${middleBorder}${menuItemIcon}${prefix}rmadv
${middleBorder}${menuItemIcon}${prefix}listadv
${middleBorder}${menuItemIcon}${prefix}limparrank
${middleBorder}${menuItemIcon}${prefix}resetrank
${middleBorder}${menuItemIcon}${prefix}mantercontador
${middleBorder}${menuItemIcon}${prefix}atividade
${middleBorder}${menuItemIcon}${prefix}checkativo
${bottomBorder}

${menuTopBorder}${separatorIcon} *🔒 CONTROLE DE ACESSO*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}blockuser
${middleBorder}${menuItemIcon}${prefix}unblockuser
${middleBorder}${menuItemIcon}${prefix}listblocksgp
${middleBorder}${menuItemIcon}${prefix}addblacklist
${middleBorder}${menuItemIcon}${prefix}delblacklist
${middleBorder}${menuItemIcon}${prefix}listblacklist
${middleBorder}${menuItemIcon}${prefix}blockcmd
${middleBorder}${menuItemIcon}${prefix}unblockcmd
${bottomBorder}

${menuTopBorder}${separatorIcon} *${managementMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}del
${middleBorder}${menuItemIcon}${prefix}limpar
${middleBorder}${menuItemIcon}${prefix}marcar
${middleBorder}${menuItemIcon}${prefix}hidetag
${middleBorder}${menuItemIcon}${prefix}sorteio
${middleBorder}${menuItemIcon}${prefix}nomegp
${middleBorder}${menuItemIcon}${prefix}descgrupo
${middleBorder}${menuItemIcon}${prefix}fotogrupo
${middleBorder}${menuItemIcon}${prefix}addregra
${middleBorder}${menuItemIcon}${prefix}delregra
${middleBorder}${menuItemIcon}${prefix}role.criar
${middleBorder}${menuItemIcon}${prefix}role.alterar
${middleBorder}${menuItemIcon}${prefix}role.excluir
${bottomBorder}

${menuTopBorder}${separatorIcon} *⚙️ GRUPO & PERMISSÕES*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}linkgp
${middleBorder}${menuItemIcon}${prefix}grupo A/F
${middleBorder}${menuItemIcon}${prefix}opengp HH:MM|off
${middleBorder}${menuItemIcon}${prefix}closegp HH:MM|off
${middleBorder}${menuItemIcon}${prefix}automsg
${middleBorder}${menuItemIcon}${prefix}banghost
${middleBorder}${menuItemIcon}${prefix}limitmessage
${middleBorder}${menuItemIcon}${prefix}dellimitmessage
${middleBorder}
${middleBorder}${menuTitleIcon} *SOLICITAÇÕES* ${menuTitleIcon}
${middleBorder}${menuItemIcon}${prefix}solicitacoes
${middleBorder}${menuItemIcon}${prefix}aprovar
${middleBorder}${menuItemIcon}${prefix}aprovar all
${middleBorder}${menuItemIcon}${prefix}recusarsolic
${bottomBorder}

${menuTopBorder}${separatorIcon} *${moderatorsMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}addmod
${middleBorder}${menuItemIcon}${prefix}delmod
${middleBorder}${menuItemIcon}${prefix}listmods
${middleBorder}${menuItemIcon}${prefix}grantmodcmd
${middleBorder}${menuItemIcon}${prefix}revokemodcmd
${middleBorder}${menuItemIcon}${prefix}listmodcmds
${bottomBorder}

${menuTopBorder}${separatorIcon} *🛡️ WHITELIST DE ANTIS*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}wladd
${middleBorder}${menuItemIcon}${prefix}wl.remove
${middleBorder}${menuItemIcon}${prefix}wl.lista
${bottomBorder}

${menuTopBorder}${separatorIcon} *${partnershipsMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}parcerias
${middleBorder}${menuItemIcon}${prefix}addparceria
${middleBorder}${menuItemIcon}${prefix}delparceria
${bottomBorder}

${menuTopBorder}${separatorIcon} *🔒 SEGURANÇA & PROTEÇÃO*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}antiflood
${middleBorder}${menuItemIcon}${prefix}antidoc
${middleBorder}${menuItemIcon}${prefix}antiloc
${middleBorder}${menuItemIcon}${prefix}antifig
${middleBorder}${menuItemIcon}${prefix}antibtn
${middleBorder}${menuItemIcon}${prefix}antilinkgp
${middleBorder}${menuItemIcon}${prefix}antilinkcanal
${middleBorder}${menuItemIcon}${prefix}antilinkhard
${middleBorder}${menuItemIcon}${prefix}antilinksoft
${middleBorder}${menuItemIcon}${prefix}antiporn
${middleBorder}${menuItemIcon}${prefix}antistatus
${middleBorder}${menuItemIcon}${prefix}x9
${middleBorder}${menuItemIcon}${prefix}captcha
${middleBorder}${menuItemIcon}${prefix}antitoxic <on/off>
${middleBorder}${menuItemIcon}${prefix}antitoxic config <ação>
${middleBorder}${menuItemIcon}${prefix}antitoxic sensibilidade <0-100>
${middleBorder}${menuItemIcon}${prefix}antipalavra <on/off/add/del/list>
${bottomBorder}

${menuTopBorder}${separatorIcon} *${settingsMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}legendasaiu
${middleBorder}${menuItemIcon}${prefix}legendabv
${middleBorder}${menuItemIcon}${prefix}fotobv
${middleBorder}${menuItemIcon}${prefix}bannerbv
${middleBorder}${menuItemIcon}${prefix}rmfotobv
${middleBorder}${menuItemIcon}${prefix}fotosaiu
${middleBorder}${menuItemIcon}${prefix}bannersaiu
${middleBorder}${menuItemIcon}${prefix}rmfotosaiu
${middleBorder}${menuItemIcon}${prefix}setprefix
${bottomBorder}

${menuTopBorder}${separatorIcon} *💬 AUTO-RESPOSTAS*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}addautoadm
${middleBorder}${menuItemIcon}${prefix}addautoadmidia
${middleBorder}${menuItemIcon}${prefix}listautoadm
${middleBorder}${menuItemIcon}${prefix}delautoadm
${middleBorder}${menuItemIcon}${prefix}autorespostas
${middleBorder}${menuItemIcon}${prefix}autorepo
${bottomBorder}

${menuTopBorder}${separatorIcon} *⚡ MODO & ATIVAÇÕES*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}autodl
${middleBorder}${menuItemIcon}${prefix}minmessage
${middleBorder}${menuItemIcon}${prefix}assistente
${middleBorder}${menuItemIcon}${prefix}modobn
${middleBorder}${menuItemIcon}${prefix}modoparceria
${middleBorder}${menuItemIcon}${prefix}modorpg
${middleBorder}${menuItemIcon}${prefix}modolite
${middleBorder}${menuItemIcon}${prefix}bemvindo
${middleBorder}${menuItemIcon}${prefix}saida
${middleBorder}${menuItemIcon}${prefix}autosticker
${middleBorder}${menuItemIcon}${prefix}soadm
${middleBorder}${menuItemIcon}${prefix}cmdlimit
${middleBorder}${menuItemIcon}${prefix}fotomenugrupo
${middleBorder}${menuItemIcon}${prefix}nomegp
${middleBorder}${menuItemIcon}${prefix}infoperso
${bottomBorder}
`;
}
