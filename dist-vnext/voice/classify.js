/**
 * Classificador de intenção por nome de comando.
 *
 * O sistema anterior mapeava emoji por nome exato: 44 overrides e 13 regex para
 * 545 famílias — 8% de cobertura. Os outros 92% caíam no mesmo ⚙️, e era por
 * isso que parecia repetitivo.
 *
 * Aqui a superfície inteira é classificada. Medido sobre os 1661 tokens reais:
 * 19 intenções em uso e maior balde em 26%, contra 92% antes.
 *
 * O padrão é `brincar` porque o maior bloco não classificável é a família de
 * medidores e interações — centenas de adjetivos (gay, burro, gostoso, corno...)
 * que nenhuma regex sã enumera, e que de fato são brincadeira. Errar para
 * "brincadeira" num comando de brincadeira é diferente de errar para
 * "engrenagem" em tudo.
 */
// Ordem importa: a primeira regra que casar vence.
const REGRAS = [
    // Downloads e mídia externa
    [/^(play|ytmp|yt$|ytv|video$|musica|música|audio$|baixar|download|dl$|autodl|autodown)/, 'baixar'],
    [/(tiktok|kwai|insta|^ig|face$|^fb|twitter|^twt|^x$|xdl|pinterest|^pin$|spotify|soundcloud|mediafire|^mf$|apk|terabox|gdrive|drive|^gd$|zipbot|zip-bot|botzip)/, 'baixar'],
    // Conversão de mídia e efeitos
    [/(sticker|figu|^fig|attp|^ttp|emojimix|brat|^qc$|^st|^stk|^s2?$|rename|renomear|take|rgtake)/, 'converter'],
    [/^(toimg|toaudio|tovideo|togif|tomp3|tomp4|converter|rmbg|sbg|sfundo|upscale|^hd$)/, 'converter'],
    [/(voice|voz|bass|reverb|overdrive|equaliz|reverse|pitch|flanger|chorus|phaser|tremolo|lowpass|grave|slowvid|fastvid|velocidade|speed|cortaraudio|cutaudio|cortarvideo|cutvideo|normaliz|volumeboost|aumentarvolume|^eco$)/, 'converter'],
    [/(pretoebranco|sepia|espelhar|rotacionar|mirror|rotate|qrcode|lerqr|readqr|scanqr)/, 'converter'],
    [/^(audio|video|vid)(lento|rapido|reverso|slow|fast|reverse)/, 'converter'],
    // Geração por IA
    [/^(ia$|gpt|imagine|desenh|logo|canvas|banner|perfilcanvas|historia|story|aventura)/, 'gerar'],
    [/^(gemma|phi|qwen|llama|baichuan|marin|kimi|mistral|magistral|rakutenai|rocket|^yi$|swallow|falcon|codegemma)/, 'conversar'],
    [/^(resumir|ideias?|explic|corrigir|correcao|recomend|debater|debate|testia|testpersonalidade)/, 'conversar'],
    // Busca e consulta externa
    [/^(pesquis|busca|search|letra|lyrics|google|wiki|imdb|clima|weather|tempo|previsao|cep|cnpj|cpf|placa|ddd|tabela|noticias?|news|tradutor|translator|dicionario|dictionary|checkurl|urlsafe|linkseguro|checklink|scanlink|urlscan|printsite|ssweb|horamundial|worldtime|fusohorario|horariomundial|hora$|fuso|horario|timezone)/, 'buscar'],
    // Economia e comércio
    [/^(depositar|dep$|sacar|saque|transferir|pix|loja|comprar|buy|vender|sell|mercado|cmerc|propriedades?|cprops?|precos|preços|leilao|leiloar|auction|doar|donate|doacao|presente|gift|tributos|impostos|taxes|caixa|box|carteira|saldo|banco|lojapremium|premiumshop|lojadeluxo|comprarpremium|buypremium|coinflip|crash|slots|slotmachine|cacaniquel|loteria|lottery|mega|roulette|blackjack|^bj$|^21$|aposta|bet|cassino|corrida|horserace|cavalos|rifa)/, 'negociar'],
    // RPG: progressão, trabalho, coleta, combate
    [/^(mine|minerar|fish|pescar|hunt|cacar|caçar|explorar|explore|trabalhar|work|emprego|vagas|demitir|plantar|cultivar|plant|farm|colher|coletar|harvest|plantacao|plantação|horta|cozinhar|cook|receitas|comer|eat|vendercomida|ingredientes|sementes|forjar|forge|reparar|materiais|desmontar|dismantle|encantar|enchant|crime|assaltar|roubar)/, 'progredir'],
    [/^(pets?|adotar|adopt|alimentar|feed|treinar|train|evoluirpet|evolve|renomearpet|renamepet|petbattle|equippet|equiparpet|unequippet|desequiparpet|equipar|desequipar|unequip|equipamentos|gear|equip|habilidades|classe|class|profissao|casa|house|lar)/, 'progredir'],
    [/^(missoes|quests|missao|desafio|conquistas?|achievements?|medalhas?|diario|daily|evoluir|evolucao|prestige|boost|buff|impulsionar|speedup|reivindicar|claim|streak|serie|arena|torneio|tournament|dungeon|masmorra|raid|bossfight|dg$|guerra|war|guerracla|^cla|claninfo)/, 'progredir'],
    // Jogos
    [/(tavern|nexo|^rpg|menurpg|jogo|game|jogar|quiz|forca|hangman|velha|ttt|tictactoe|akinator|batalha|duelo|uno|memoria|memory|connect4|^c4$|ligue4|wordle|palavra|trivia|adedonha|anagrama|cacapalavras?|naval|digitar|typing|digitacao|^ppt$|chance|brincadeira|eununca|charada|enigma|campo|render|partida|mulligan|atacar|poder|desistir)/, 'jogar'],
    // Sufixo rpg marca o domínio inteiro; sem isto chefe, duelo e eventos do RPG
    // caíam em brincadeira.
    [/rpg$/, 'jogar'],
    [/^(criarcla|criarclã|convidar|convite|rmconvite|aceitarconvite|recusarconvite|deserdar|desherdar|adotaruser|adotarfilho|eventos?|proteger|protect|mercadoplayer|leilaoplayer)/, 'progredir'],
    // Moderação e punição
    [/^(ban|kick|remover|expulsar|mute|mutar|desmute|desmutar|unmute|silenciar|advert|warn|^adv|rmadv|unwarning|block|bloq|unblock|antilink|anti|banir|nuke|blacklist|unblacklist|denunciar|report|x9)/, 'punir'],
    [/^(promover|promote|rebaixar|demote|seradm|sermembro|addmod|listmods|adddono|deldono|remdono|listdonos|donos|addsubdono|rmsubdono|listsubdonos|addpremium|addvip|rmpremium|rmvip|premiumlist|listpremium|listprem|vip)/, 'promover'],
    [/^(limpar|clear|clean|apagar|del|remove|^rem|fechar|abrir|opengp|closegp|marcar|marca|todos|hidetag|tagall|totag|cita|mark|group|linkgp|linkgroup|solicitacoes|pendentes|requests|aprovar|aceitar|approve|recusar|reject|captcha)/, 'moderar'],
    // Configuração
    [/^(set|config|ativar|desativar|^on$|^off$|mudar|alterar|trocar|prefixo|prefix|idioma|tema|borda|midia|personaliz|reset|design|automsg|autorepo|autoresposta|personalidade|changeperso|mudarpersona|default|addauto|autoresponses|autorespostas|addnoprefix|addalias|addcmd|adicionarcmd|edcmd|editcmd|addcmdmidia|cmdlimit|limitarcmd|cmddeslimit|rmcmdlimit|litemode|soadm|onlyadm|soadmin|minmessage|msgprefix|msgboton|addreact|boton|botoff|aluguel|addaluguel|rental|dayfree|addxp|freetemu)/, 'configurar'],
    // Ajuda e menus
    [/(menu|help|ajuda|comandos|commands|guia|tutorial|creditos|criador|sobre|^info$|botinfo|cmdinfo|comandoinfo|changers|alteradores|ferramentas|tools|lermais)/, 'ajudar'],
    // Perfil e status pessoal
    [/^(perfil|profile|rank|globalrank|level|nivel|^xp|^meu|mystats|status|stats|groupstats|inventario|^inv|reputacao|^rep|reputation|votar|vote|conquista|arvore|familytree|familia|family|casamento|casar|namoro|namorar|relacionamento|divorciar|divorcio|terminar|termino|trair|traicao|historico|shipo|^sn$|afk|voltei|aniversario|niver|birthday)/, 'perfilar'],
    // Cálculo
    [/^(calc|calcul|conta|soma|math|moeda|cotacao|converterm)/, 'calcular'],
    // Sorteio explícito
    [/^(sorte|sortear|random|aleat|roleta|dado|dice|cara|coroa|escolher|frase|conselho|piada|fato|curiosidade|motivacional|motivacao|elogio|elogiar|reflexao|pensamento|cantada|biblia|horoscopo|signo)/, 'sortear'],
    // Consulta e listagem
    [/^(ping|uptime|estatis|listar?|^list|^ver|mostrar|consultar|^top|ranking|lembr|agenda|nota|anota|recado|aviso|viewmsg|updates|atualizar|update|reiniciar|restart|reboot|repairdb|fixdb|cachedebug|debugcache|horarios|sinais|totalcmd|totalcomando|checkativo|atividade|regras|suporte|ticket|parcerias|partnerships|^t$|transc|transcrever|autotr|prompts|verprompt|^wl\.|^wladd|whitelist|^cases|getcase|^d$|mention|^b$|^bam|^return|roles?|^role\.)/, 'consultar'],
    // Envio
    [/^(enviar|mandar|send|encaminhar|repost|^fw$|divulgar|^div|upload|encurtalink|tinyurl|imgpralink|nick|inscrever|desinscrever|cancelartm|^tm)/, 'enviar'],
];
// Tudo o que sobra é brincadeira: o bloco maior não classificado é a família de
// medidores e interações (gay, burro, gostoso, beijo, tapa...), centenas de
// adjetivos que nenhuma regex sã enumera.
const PADRAO = 'brincar';
export function intencaoDoComando(comando) {
    const t = String(comando || '').toLowerCase();
    for (const [re, intencao] of REGRAS)
        if (re.test(t))
            return intencao;
    return PADRAO;
}
/** Exposto para o teste medir a distribuição real sobre a superfície. */
export { REGRAS, PADRAO };
//# sourceMappingURL=classify.js.map