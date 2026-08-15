export default async function menurpg(prefix, botName = "MeuBot", userName = "Usuário", {
    header = `╭┈⊰ 🫟 『 *${botName}* 』\n┊💭 *Usuário:* #nome#\n┊👑 *Prefixo:* #prefix#\n╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯`,
    menuTopBorder = "╭┈",
    bottomBorder = "╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯",
    menuTitleIcon = "🍧ฺꕸ▸",
    menuItemIcon = "•.̇𖥨֗🫟⭟",
    separatorIcon = "❁",
    middleBorder = "┊", 
    profileMenuTitle = "👤 PERFIL & STATUS",
    economyMenuTitle = "💰 ECONOMIA & FINANÇAS",
    activitiesMenuTitle = "🎯 ATIVIDADES DIÁRIAS",
    adventureMenuTitle = "🗺️ AVENTURA & EXPLORAÇÃO",
    combatMenuTitle = "⚔️ COMBATE & BATALHAS",
    craftingMenuTitle = "🔨 CRAFTING & EQUIPAMENTOS",
    socialMenuTitle = "💝 SOCIAL & INTERAÇÕES",
    familyMenuTitle = "👨‍👩‍👧‍👦 FAMÍLIA & ADOÇÃO",
    guildMenuTitle = "🏰 CLÃ & COMUNIDADE",
    questMenuTitle = "📜 MISSÕES & CONQUISTAS",
    petsMenuTitle = "🐾 PETS & COMPANHEIROS",
    reputationMenuTitle = "⭐ REPUTAÇÃO & FAMA",
    investmentMenuTitle = "📈 INVESTIMENTOS & BOLSA",
    gamblingMenuTitle = "🎰 CASSINO & APOSTAS",
    evolutionMenuTitle = "🌟 EVOLUÇÃO & PRESTIGE",
    eventsMenuTitle = "🎉 EVENTOS",
    premiumMenuTitle = "💎 LOJA PREMIUM",
    adminMenuTitle = "🔧 ADMIN RPG (DONO)"
} = {}) {

  let formattedHeader = header
    .replace(/#nome#/g, userName)
    .replace(/#prefix#/g, prefix);
    
 return `${formattedHeader} 

${menuTopBorder}${separatorIcon} *${profileMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}perfilrpg
${middleBorder}${menuItemIcon}${prefix}carteira
${middleBorder}${menuItemIcon}${prefix}toprpg
${middleBorder}${menuItemIcon}${prefix}rankglobal
${middleBorder}${menuItemIcon}${prefix}ranklvl
${middleBorder}${menuItemIcon}${prefix}inv
${middleBorder}${menuItemIcon}${prefix}equipamentos
${middleBorder}${menuItemIcon}${prefix}conquistas
${bottomBorder}

${menuTopBorder}${separatorIcon} *${evolutionMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}evoluir
${middleBorder}${menuItemIcon}${prefix}prestige
${middleBorder}${menuItemIcon}${prefix}streak
${middleBorder}${menuItemIcon}${prefix}reivindicar
${middleBorder}${menuItemIcon}${prefix}speedup
${bottomBorder}

${menuTopBorder}${separatorIcon} *${economyMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}dep <valor|all>
${middleBorder}${menuItemIcon}${prefix}sacar <valor|all>
${middleBorder}${menuItemIcon}${prefix}pix @user <valor>
${middleBorder}${menuItemIcon}${prefix}loja
${middleBorder}${menuItemIcon}${prefix}comprar <item>
${middleBorder}${menuItemIcon}${prefix}vender <item> <qtd>
${middleBorder}${menuItemIcon}${prefix}vagas
${middleBorder}${menuItemIcon}${prefix}emprego <vaga>
${middleBorder}${menuItemIcon}${prefix}demitir
${middleBorder}${menuItemIcon}${prefix}habilidades
${middleBorder}${menuItemIcon}${prefix}desafiosemanal
${middleBorder}${menuItemIcon}${prefix}desafiomensal
${bottomBorder}

${menuTopBorder}${separatorIcon} *${investmentMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}investir
${middleBorder}${menuItemIcon}${prefix}investir <ação> <qtd>
${middleBorder}${menuItemIcon}${prefix}sell <ação> <qtd>
${bottomBorder}

${menuTopBorder}${separatorIcon} *${gamblingMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}dados <valor>
${middleBorder}${menuItemIcon}${prefix}coinflip <cara|coroa> <valor>
${middleBorder}${menuItemIcon}${prefix}crash <valor>
${middleBorder}${menuItemIcon}${prefix}slots <valor>
${middleBorder}${menuItemIcon}${prefix}apostar <valor>
${middleBorder}${menuItemIcon}${prefix}roleta <valor> <cor>
${middleBorder}${menuItemIcon}${prefix}blackjack <valor>
${middleBorder}${menuItemIcon}${prefix}loteria
${middleBorder}${menuItemIcon}${prefix}loteria comprar <qtd>
${middleBorder}${menuItemIcon}${prefix}corrida <valor> <cavalo>
${middleBorder}${menuItemIcon}${prefix}leilao
${middleBorder}${menuItemIcon}${prefix}topriqueza
${bottomBorder}

${menuTopBorder}${separatorIcon} *${activitiesMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}diario
${middleBorder}${menuItemIcon}${prefix}work
${middleBorder}${menuItemIcon}${prefix}mine
${middleBorder}${menuItemIcon}${prefix}fish
${middleBorder}${menuItemIcon}${prefix}coletar
${middleBorder}${menuItemIcon}${prefix}colher
${middleBorder}${menuItemIcon}${prefix}caçar
${middleBorder}${menuItemIcon}${prefix}plantar <planta>
${middleBorder}${menuItemIcon}${prefix}cultivar <planta>
${middleBorder}${menuItemIcon}${prefix}plantacao
${middleBorder}${menuItemIcon}${prefix}cook <receita>
${middleBorder}${menuItemIcon}${prefix}receitas
${middleBorder}${menuItemIcon}${prefix}ingredientes
${middleBorder}${menuItemIcon}${prefix}eat <comida>
${middleBorder}${menuItemIcon}${prefix}vendercomida <item>
${middleBorder}${menuItemIcon}${prefix}sementes
${bottomBorder}

${menuTopBorder}${separatorIcon} *${adventureMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}explore
${middleBorder}${menuItemIcon}${prefix}masmorra
${middleBorder}${menuItemIcon}${prefix}bossrpg
${middleBorder}${menuItemIcon}${prefix}eventos
${bottomBorder}

${menuTopBorder}${separatorIcon} *🏰 DUNGEONS & RAIDS*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}dungeon - Listar dungeons
${middleBorder}${menuItemIcon}${prefix}dungeon criar <tipo>
${middleBorder}${menuItemIcon}${prefix}dungeon entrar <id>
${middleBorder}${menuItemIcon}${prefix}dungeon iniciar
${middleBorder}${menuItemIcon}${prefix}dungeon sair
${bottomBorder}

${menuTopBorder}${separatorIcon} *⚔️ CLASSES & PROFISSÕES*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}class - Ver classes
${middleBorder}${menuItemIcon}${prefix}class <nome> - Escolher
${bottomBorder}

${menuTopBorder}${separatorIcon} *🏠 HOUSING*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}casa - Ver sua casa
${middleBorder}${menuItemIcon}${prefix}casa comprar <tipo>
${middleBorder}${menuItemIcon}${prefix}casa coletar
${middleBorder}${menuItemIcon}${prefix}casa decorar <item>
${bottomBorder}

${menuTopBorder}${separatorIcon} *🛒 MERCADO DE JOGADORES*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}auction - Ver itens
${middleBorder}${menuItemIcon}${prefix}auction vender <item> <preço>
${middleBorder}${menuItemIcon}${prefix}auction comprar <nº>
${middleBorder}${menuItemIcon}${prefix}auction meus
${middleBorder}${menuItemIcon}${prefix}auction cancelar <nº>
${middleBorder}
${middleBorder}${menuTitleIcon} *MERCADO GERAL* ${menuTitleIcon}
${middleBorder}${menuItemIcon}${prefix}mercado
${middleBorder}${menuItemIcon}${prefix}listar <item> <preço>
${middleBorder}${menuItemIcon}${prefix}cmerc <nº>
${middleBorder}${menuItemIcon}${prefix}meusan
${middleBorder}${menuItemIcon}${prefix}cancelar <nº>
${bottomBorder}

${menuTopBorder}${separatorIcon} *${combatMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}duelrpg @user
${middleBorder}${menuItemIcon}${prefix}arena
${middleBorder}${menuItemIcon}${prefix}torneio
${middleBorder}${menuItemIcon}${prefix}assaltar @user
${middleBorder}${menuItemIcon}${prefix}crime
${middleBorder}${menuItemIcon}${prefix}guerra
${middleBorder}${menuItemIcon}${prefix}desafio
${bottomBorder}

${menuTopBorder}${separatorIcon} *${craftingMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}forge <item>
${middleBorder}${menuItemIcon}${prefix}enchant
${middleBorder}${menuItemIcon}${prefix}dismantle <item>
${middleBorder}${menuItemIcon}${prefix}reparar <item>
${middleBorder}${menuItemIcon}${prefix}materiais
${middleBorder}${menuItemIcon}${prefix}precos
${bottomBorder}

${menuTopBorder}${separatorIcon} *${socialMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}casar @user
${middleBorder}${menuItemIcon}${prefix}divorciar
${middleBorder}${menuItemIcon}${prefix}namorar @user
${middleBorder}${menuItemIcon}${prefix}terminar
${middleBorder}${menuItemIcon}${prefix}relacionamento
${middleBorder}${menuItemIcon}${prefix}casais
${middleBorder}${menuItemIcon}${prefix}abracarrpg @user
${middleBorder}${menuItemIcon}${prefix}beijarrpg @user
${middleBorder}${menuItemIcon}${prefix}baterrpg @user
${middleBorder}${menuItemIcon}${prefix}proteger @user
${bottomBorder}

${menuTopBorder}${separatorIcon} *${familyMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}familia
${middleBorder}${menuItemIcon}${prefix}adotaruser @user
${middleBorder}${menuItemIcon}${prefix}deserdar @user
${middleBorder}${menuItemIcon}${prefix}arvore
${bottomBorder}

${menuTopBorder}${separatorIcon} *${guildMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}criarcla <nome>
${middleBorder}${menuItemIcon}${prefix}cla
${middleBorder}${menuItemIcon}${prefix}convidar @user
${middleBorder}${menuItemIcon}${prefix}sair
${middleBorder}${menuItemIcon}${prefix}aceitarconvite <clanId|nome>
${middleBorder}${menuItemIcon}${prefix}recusarconvite <clanId|nome>
${middleBorder}${menuItemIcon}${prefix}expulsar @user
${middleBorder}${menuItemIcon}${prefix}rmconvite @user
${bottomBorder}

${menuTopBorder}${separatorIcon} *${questMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}missoes
${middleBorder}${menuItemIcon}${prefix}conquistas
${bottomBorder}

${menuTopBorder}${separatorIcon} *${petsMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}pets
${middleBorder}${menuItemIcon}${prefix}adotar <pet>
${middleBorder}${menuItemIcon}${prefix}feed <nº>
${middleBorder}${menuItemIcon}${prefix}train <nº>
${middleBorder}${menuItemIcon}${prefix}evolve <nº>
${middleBorder}${menuItemIcon}${prefix}petbattle <nº>
${middleBorder}${menuItemIcon}${prefix}renamepet <nº> <nome>
${middleBorder}${menuItemIcon}${prefix}petbet <valor> <nº> @user
${middleBorder}${menuItemIcon}${prefix}equippet <nº> <nome do item>
${middleBorder}${menuItemIcon}${prefix}unequippet <nº> <slot?>
${bottomBorder}

${menuTopBorder}${separatorIcon} *${reputationMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}rep
${middleBorder}${menuItemIcon}${prefix}vote @user
${bottomBorder}

${menuTopBorder}${separatorIcon} *${eventsMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}eventos
${bottomBorder}

${menuTopBorder}${separatorIcon} *${premiumMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}lojapremium
${middleBorder}${menuItemIcon}${prefix}comprarpremium <item>
${middleBorder}${menuItemIcon}${prefix}boost
${middleBorder}${menuItemIcon}${prefix}propriedades
${middleBorder}${menuItemIcon}${prefix}cprop <id>
${middleBorder}${menuItemIcon}${prefix}cprops
${middleBorder}${menuItemIcon}${prefix}tributos
${middleBorder}${menuItemIcon}${prefix}meustats
${middleBorder}${menuItemIcon}${prefix}doar <valor>
${middleBorder}${menuItemIcon}${prefix}presente @user <item>
${bottomBorder}

${menuTopBorder}${separatorIcon} *${adminMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}rpgadd @user <valor>
${middleBorder}${menuItemIcon}${prefix}rpgremove @user <valor>
${middleBorder}${menuItemIcon}${prefix}rpgsetlevel @user <nivel>
${middleBorder}${menuItemIcon}${prefix}rpgadditem @user <item> <qtd>
${middleBorder}${menuItemIcon}${prefix}rpgremoveitem @user <item> <qtd>
${middleBorder}${menuItemIcon}${prefix}rpgresetplayer @user
${middleBorder}${menuItemIcon}${prefix}rpgresetglobal confirmar
${middleBorder}${menuItemIcon}${prefix}rpgstats
${bottomBorder}`
}