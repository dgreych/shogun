import type { ContextoEconomia } from './context.js';

/**
 * Ramos do bloco de economia, migrados um a um.
 *
 * Handler devolve DESCRITOR de resposta em vez de chamar `reply`. No monólito,
 * cada ramo terminava com `return reply(...)`, o que amarrava a regra ao
 * transporte e tornava o comportamento impossível de testar sem subir o bot.
 * Aqui a decisão é dado; quem entrega é o chamador.
 */

export interface RespostaEconomia {
  readonly texto: string;
  /** JIDs a marcar. O legado passava isto em `{ mentions: [...] }`. */
  readonly mencoes?: readonly string[];
}

/** Dependências que os ramos tomam emprestado do runtime legado. */
export interface FerramentasEconomia {
  /** Formatação de moeda do jogo, preservada do legado. */
  readonly fmt: (valor: unknown) => string;
  readonly getUserName: (jid: string) => string;
  readonly saveEconomy: (econ: unknown) => void;
}

type Eco = {
  users?: Record<string, unknown>;
  market?: ReadonlyArray<Record<string, never> & {
    id: string | number; type: string; key?: string; mat?: string;
    qty: number; price: number; seller: string;
  }>;
  jobCatalog?: Record<string, { name?: string }>;
};

type Usuario = { wallet?: number; bank?: number; job?: string | null };

/** `carteira` — extrato financeiro do jogador. */
export function ramoCarteira(ctx: ContextoEconomia, f: FerramentasEconomia): RespostaEconomia {
  const me = ctx.usuario as Usuario;
  const econ = ctx.econ as Eco;
  const total = (me.wallet || 0) + (me.bank || 0);
  const emprego = me.job ? econ.jobCatalog?.[me.job]?.name || me.job : 'Desempregado(a)';
  return {
    texto: '╭━━━⊱ 👤 *PERFIL FINANCEIRO* 👤 ⊰━━━╮\n'
      + '│\n'
      + `│   *Carteira:* ${f.fmt(me.wallet)}\n`
      + `│ 🏦 *Banco:* ${f.fmt(me.bank)}\n`
      + `│   *Total:* ${f.fmt(total)}\n`
      + '│\n'
      + `│ 💼 *Emprego:* ${emprego}\n`
      + '│\n'
      + '╰━━━━━━━━━━━━━━━━━━━━━━━━╯',
  };
}

/** `mercado` — ofertas abertas entre jogadores. */
export function ramoMercado(ctx: ContextoEconomia, f: FerramentasEconomia): RespostaEconomia {
  const econ = ctx.econ as Eco;
  const itens = econ.market || [];
  if (itens.length === 0) {
    return { texto: '🛒 O mercado está vazio. Use listar para anunciar algo.' };
  }
  let texto = '🛒 Mercado (ofertas abertas)\n\n';
  for (const ofr of itens) {
    const oque = ofr.type === 'item' ? `${ofr.key} x${ofr.qty}` : `${ofr.mat} x${ofr.qty}`;
    texto += `#${ofr.id} • ${oque} — ${f.fmt(ofr.price)} | Vendedor: @${ofr.seller.split('@')[0]}\n`;
  }
  return { texto, mencoes: itens.map((i) => i.seller) };
}

export interface PermissaoReset {
  readonly isOwner: boolean;
  readonly isSubOwner: boolean;
  readonly remetente: string;
  readonly donoPrincipal: string;
  readonly enviadoPeloBot: boolean;
}

/**
 * `resetrpg` — apaga progresso. Só o dono principal, e nunca sub-dono.
 *
 * O gate é mais estreito que o de outros comandos de dono porque a ação é
 * destrutiva e irreversível: apaga o progresso de RPG de um membro, ou do grupo
 * inteiro quando o escopo é "all".
 */
export function ramoResetRpg(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  permissao: PermissaoReset,
  alvoMencionado: string | null,
  membrosDoGrupo: readonly string[],
  escopoBruto: string,
): RespostaEconomia {
  const autorizado = permissao.isOwner
    && !permissao.isSubOwner
    && (permissao.remetente === permissao.donoPrincipal || permissao.enviadoPeloBot);
  if (!autorizado) return { texto: 'Apenas o Dono principal pode resetar usuários.' };

  const econ = ctx.econ as Eco;
  const escopo = String(escopoBruto || '').toLowerCase();

  if (escopo.includes('all') || escopo.includes('todos')) {
    let contagem = 0;
    for (const membro of membrosDoGrupo || []) {
      if (econ.users?.[membro]) {
        delete econ.users[membro];
        contagem += 1;
      }
    }
    f.saveEconomy(econ);
    return { texto: `✅ Resetado os dados RPG de ${contagem} membros do grupo.` };
  }

  if (!alvoMencionado) return { texto: 'Marque um usuário para resetar ou use "all".' };

  delete econ.users?.[alvoMencionado];
  f.saveEconomy(econ);
  return {
    texto: `✅ Dados RPG resetados para @${f.getUserName(alvoMencionado)}.`,
    mencoes: [alvoMencionado],
  };
}

// ===== Segunda leva de ramos =====

type Materiais = Record<string, number>;
type UsuarioEco = {
  wallet?: number; bank?: number; job?: string | null;
  materials?: Materiais; inventory?: Record<string, number>;
};
type Oferta = {
  id: number; type: string; key?: string; mat?: string;
  qty: number; price: number; seller: string;
};

/** Catálogo embutido usado quando a economia não traz vagas próprias. */
const VAGAS_PADRAO: Readonly<Record<string, { name: string; min: number; max: number }>> = Object.freeze({
  estagiario: { name: 'Estagiário', min: 80, max: 140 },
  designer: { name: 'Designer', min: 150, max: 250 },
  programador: { name: 'Programador', min: 200, max: 350 },
  gerente: { name: 'Gerente', min: 260, max: 420 },
});

/**
 * `vagas` — lista de empregos.
 *
 * Cai para o catálogo embutido quando a economia não tem vagas. Sem isso, um
 * grupo novo veria a lista vazia e não teria como conseguir emprego nenhum.
 */
export function ramoVagas(ctx: ContextoEconomia, f: FerramentasEconomia, prefixo: string): RespostaEconomia {
  const econ = ctx.econ as { jobCatalog?: Record<string, { name?: string; min?: number; max?: number }> };
  const catalogo = econ.jobCatalog && Object.keys(econ.jobCatalog).length > 0
    ? econ.jobCatalog
    : VAGAS_PADRAO;

  let texto = '╭━━━⊱ 💼 *VAGAS DE EMPREGO* 💼 ⊰━━━╮\n│\n';
  for (const [chave, vaga] of Object.entries(catalogo)) {
    texto += `│ 🔹 *${chave}*\n│   ${vaga.name}\n│   💰 ${f.fmt(vaga.min)}-${f.fmt(vaga.max)}\n│\n`;
  }
  texto += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n💡 Use: ${prefixo}emprego <vaga>`;
  return { texto };
}

/** `materiais` — inventário de matéria-prima do jogador. */
export function ramoMateriais(ctx: ContextoEconomia, prefixo: string): RespostaEconomia {
  const me = ctx.usuario as UsuarioEco;
  const mats = me.materials || {};
  // Só o que tem saldo: listar material zerado polui e sugere posse que não há.
  const chaves = Object.keys(mats).filter((k) => (mats[k] ?? 0) > 0);

  if (chaves.length === 0) {
    return {
      texto: '╭━━━⊱ ⛏️ *MATERIAIS* ⛏️ ⊰━━━╮\n│\n│ 📭 Você não possui materiais\n│\n'
        + `│ ⛏️ Mine para coletar!\n│ Use: ${prefixo}minerar\n│\n╰━━━━━━━━━━━━━━━━━━━━━━╯`,
    };
  }

  let texto = '╭━━━⊱ ⛏️ *MATERIAIS* ⛏️ ⊰━━━╮\n│\n';
  for (const k of chaves) texto += `│ 💎 ${k}: ${mats[k]}\n`;
  return { texto: texto + '│\n╰━━━━━━━━━━━━━━━━━━━━━━╯' };
}

/**
 * `cancelar` — retira um anúncio do mercado e devolve o que estava reservado.
 *
 * A devolução é a parte que não pode falhar: sem ela o jogador perde o item ao
 * cancelar, que é pior do que não poder cancelar.
 */
export function ramoCancelar(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  remetente: string,
): RespostaEconomia {
  const econ = ctx.econ as { market?: Oferta[] };
  const me = ctx.usuario as UsuarioEco;

  const id = Number.parseInt(ctx.args[0] ?? '', 10);
  if (!Number.isFinite(id)) return { texto: 'Informe o ID do anúncio.' };

  const mercado = econ.market || [];
  const indice = mercado.findIndex((o) => o.id === id);
  if (indice < 0) return { texto: 'Anúncio não encontrado.' };

  const oferta = mercado[indice]!;
  if (oferta.seller !== remetente) return { texto: 'Apenas o vendedor pode cancelar.' };

  if (oferta.type === 'item') {
    me.inventory = me.inventory || {};
    me.inventory[oferta.key!] = (me.inventory[oferta.key!] || 0) + oferta.qty;
  } else {
    me.materials = me.materials || {};
    me.materials[oferta.mat!] = (me.materials[oferta.mat!] || 0) + oferta.qty;
  }

  mercado.splice(indice, 1);
  f.saveEconomy(econ);
  return { texto: `❌ Anúncio #${id} cancelado e itens devolvidos.` };
}

/**
 * `vendercomida` — converte comida cozida em dinheiro.
 *
 * A validação de posse vem ANTES da receita porque a mensagem de falta é mais
 * útil: diz quanto o jogador tem. Inverter faria "receita não encontrada"
 * aparecer para quem só não tinha estoque.
 */
export function ramoVenderComida(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  prefixo: string,
): RespostaEconomia {
  const me = ctx.usuario as UsuarioEco & { cookedFood?: Record<string, number> };
  const econ = ctx.econ as { cookingRecipes?: Record<string, { name?: string; sellPrice?: number }> };
  me.cookedFood = me.cookedFood || {};

  const comida = (ctx.args[0] || '').toLowerCase();
  if (!comida) {
    return {
      texto: `💰 *VENDER COMIDA*\n\nUse: ${prefixo}vendercomida <comida>\n\n`
        + `💡 Veja suas comidas com ${prefixo}comer`,
    };
  }

  const qtd = Number.parseInt(ctx.args[1] ?? '', 10) || 1;
  const emEstoque = me.cookedFood[comida] || 0;
  if (emEstoque < qtd) {
    return { texto: `❌ Você não tem ${qtd}x ${comida}.\n\n🍽️ Você tem: ${emEstoque}` };
  }

  const receita = econ.cookingRecipes?.[comida];
  if (!receita) return { texto: '❌ Receita não encontrada.' };

  const total = (receita.sellPrice || 0) * qtd;
  me.cookedFood[comida] = emEstoque - qtd;
  me.wallet = (me.wallet || 0) + total;
  f.saveEconomy(econ);

  return {
    texto: `💰 *VENDA CONCLUÍDA!*\n\nVocê vendeu ${qtd}x ${receita.name}\n`
      + `💵 Ganhou: ${f.fmt(total)}\n💼 Carteira: ${f.fmt(me.wallet)}`,
  };
}

/**
 * `listar` — cria anúncio no mercado, debitando do estoque na hora.
 *
 * O débito é imediato e proposital: sem ele o jogador anunciaria o mesmo item
 * várias vezes e venderia estoque que não tem.
 */
export function ramoListar(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  remetente: string,
  prefixo: string,
): RespostaEconomia {
  const me = ctx.usuario as UsuarioEco;
  const econ = ctx.econ as { market?: Oferta[]; marketCounter?: number };

  const tipo = (ctx.args[0] || '').toLowerCase();
  if (!['item', 'mat', 'material'].includes(tipo)) {
    return {
      texto: `Use: ${prefixo}listar item <key> <qtd> <preco> | ${prefixo}listar mat <material> <qtd> <preco>`,
    };
  }

  const qtd = Number.parseInt(ctx.args[2] ?? '', 10);
  const preco = Number.parseInt(ctx.args[3] ?? '', 10);
  if (!Number.isFinite(qtd) || qtd <= 0 || !Number.isFinite(preco) || preco <= 0) {
    return { texto: 'Quantidade e preço inválidos.' };
  }

  econ.market = econ.market || [];
  const chave = (ctx.args[1] || '').toLowerCase();

  if (tipo === 'item') {
    if ((me.inventory?.[chave] || 0) < qtd) return { texto: 'Você não possui itens suficientes.' };
    me.inventory![chave] = (me.inventory![chave] || 0) - qtd;
    const id = econ.marketCounter ?? 0;
    econ.marketCounter = id + 1;
    econ.market.push({ id, type: 'item', key: chave, qty: qtd, price: preco, seller: remetente });
    f.saveEconomy(econ);
    return { texto: `📢 Anúncio #${id} criado: ${chave} x${qtd} por ${f.fmt(preco)}.` };
  }

  if ((me.materials?.[chave] || 0) < qtd) return { texto: 'Você não possui materiais suficientes.' };
  me.materials![chave] = (me.materials![chave] || 0) - qtd;
  const id = econ.marketCounter ?? 0;
  econ.marketCounter = id + 1;
  econ.market.push({ id, type: 'mat', mat: chave, qty: qtd, price: preco, seller: remetente });
  f.saveEconomy(econ);
  return { texto: `📢 Anúncio #${id} criado: ${chave} x${qtd} por ${f.fmt(preco)}.` };
}

export interface FerramentasTexto {
  /** Converte "10", "all", "50%" etc. no legado. Injetado para não reimplementar. */
  readonly parseAmount: (bruto: string, disponivel: number) => number;
  /** Busca chave ignorando acentos, como o legado faz para vagas. */
  readonly findKeyIgnoringAccents: (obj: Record<string, unknown>, alvo: string) => string | null;
  readonly normalizeParam: (bruto: string) => string;
}

const PALAVRAS_TUDO = new Set(['all', 'tudo', 'max']);

/**
 * `vender` — troca material por dinheiro.
 *
 * Aceita "all" além de número porque vender estoque inteiro é a operação mais
 * comum depois de minerar, e obrigar a contar seria atrito puro.
 */
export function ramoVender(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  t: Pick<FerramentasTexto, 'parseAmount'>,
  prefixo: string,
): RespostaEconomia {
  const me = ctx.usuario as UsuarioEco;
  const econ = ctx.econ as { materialsPrices?: Record<string, number> };
  const material = (ctx.args[0] || '').toLowerCase();

  if (!material) {
    return {
      texto: '╭━━━⊱ 💰 *VENDER MATERIAIS* 💰 ⊰━━━╮\n│\n│ 📝 *Uso:*\n'
        + `│ ${prefixo}vender <material> <qtd|all>\n│\n│ 💡 *Exemplo:*\n`
        + `│ ${prefixo}vender ferro 10\n│ ${prefixo}vender ouro all\n│\n`
        + `│ 💱 Ver preços: ${prefixo}precos\n│\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯`,
    };
  }

  const preco = (econ.materialsPrices || {})[material];
  if (!preco) return { texto: `❌ Material inválido.\n\n💱 Veja preços com ${prefixo}precos` };

  const possui = me.materials?.[material] || 0;
  if (possui <= 0) return { texto: '❌ Você não possui esse material.' };

  const bruto = ctx.args[1] || 'all';
  const qtd = PALAVRAS_TUDO.has(bruto.toLowerCase()) ? possui : t.parseAmount(bruto, possui);
  if (!Number.isFinite(qtd) || qtd <= 0) return { texto: '❌ Quantidade inválida.' };

  const ganho = qtd * preco;
  me.materials![material] = possui - qtd;
  me.wallet = (me.wallet || 0) + ganho;
  f.saveEconomy(econ);

  return {
    texto: '╭━━━⊱ ✅ *VENDA* ✅ ⊰━━━╮\n│\n'
      + `│   Vendeu: ${qtd}x ${material}\n│ 💰 Ganhou: ${f.fmt(ganho)}\n│\n`
      + '╰━━━━━━━━━━━━━━━━━━━━╯',
  };
}

/**
 * `emprego` — contrata o jogador numa vaga.
 *
 * Busca a vaga ignorando acentos porque os nomes têm acento e o usuário digita
 * sem. E persiste o catálogo padrão quando a economia não tinha nenhum: sem
 * isso, a vaga aceita agora não seria encontrada na próxima consulta.
 */
export function ramoEmprego(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  t: Pick<FerramentasTexto, 'findKeyIgnoringAccents' | 'normalizeParam'>,
  prefixo: string,
): RespostaEconomia {
  const me = ctx.usuario as UsuarioEco;
  const econ = ctx.econ as { jobCatalog?: Record<string, { name?: string; min?: number; max?: number }> };
  const bruto = ctx.args[0] || '';

  if (!bruto) {
    return {
      texto: '╭━━━⊱ 💼 *EMPREGO* 💼 ⊰━━━╮\n│\n│ ❌ Informe a vaga desejada\n│\n'
        + `│ 📋 Ver vagas: ${prefixo}vagas\n│\n│ 💡 Exemplo:\n│ ${prefixo}emprego vendedor\n│\n`
        + '╰━━━━━━━━━━━━━━━━━━━━╯',
    };
  }

  const temProprio = econ.jobCatalog && Object.keys(econ.jobCatalog).length > 0;
  const catalogo = temProprio ? econ.jobCatalog! : { ...VAGAS_PADRAO };
  const chave = t.findKeyIgnoringAccents(catalogo, bruto) || t.normalizeParam(bruto);
  const vaga = catalogo[chave];
  if (!vaga) return { texto: `❌ Vaga inexistente. Use ${prefixo}vagas para ver disponíveis.` };

  // Persiste o padrão: sem isto, a vaga aceita agora sumiria na próxima consulta.
  if (!temProprio) econ.jobCatalog = catalogo;

  me.job = chave;
  f.saveEconomy(econ);

  return {
    texto: '╭━━━⊱ ✅ *CONTRATADO!* ✅ ⊰━━━╮\n│\n'
      + `│ 💼 Emprego: ${vaga.name}\n│ 💰 Ganhos: ${f.fmt(vaga.min)}-${f.fmt(vaga.max)}\n│\n`
      + `│ 🏢 Use ${prefixo}trabalhar\n│    para receber seu salário!\n│\n`
      + '╰━━━━━━━━━━━━━━━━━━━━━━╯',
  };
}

/** Relógio e sorte injetados: sem isso, cassino e crime são intestáveis. */
export interface FerramentasAcaso {
  readonly agora: () => number;
  readonly aleatorio: () => number;
  readonly timeLeft: (ate: number) => string;
}

/** Progressão do jogador, tudo vindo do runtime legado. */
export interface FerramentasProgressao {
  readonly getSkillBonus: (usuario: unknown, chave: string) => number;
  readonly addSkillXP: (usuario: unknown, chave: string, xp: number) => void;
  readonly updateChallenge: (u: unknown, t: string, n: number, b: boolean) => void;
  readonly updatePeriodChallenge: (u: unknown, t: string, n: number, b: boolean) => void;
  readonly isChallengeCompleted: (usuario: unknown) => boolean;
  readonly giveMaterial: (usuario: unknown, chave: string, qtd: number) => void;
}

type Cooldowns = Record<string, number | undefined>;
type UsuarioJogo = UsuarioEco & {
  cooldowns?: Cooldowns;
  stats?: Record<string, number>;
  challenge?: { tasks?: ReadonlyArray<{ type: string; progress?: number; target: number }>; reward: number; claimed?: boolean };
  properties?: Record<string, { owned?: boolean; lastCollect?: number }>;
};

const ROTULOS_DESAFIO: Record<string, string> = {
  mine: 'Minerações', work: 'Trabalhos', fish: 'Pescarias',
  explore: 'Explorações', hunt: 'Caçadas', crimeSuccess: 'Crimes bem-sucedidos',
};

/**
 * `desafio` — painel diário e coleta da recompensa.
 *
 * `coletar` é subcomando e não ramo próprio; manter assim preserva o legado.
 */
export function ramoDesafio(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  p: Pick<FerramentasProgressao, 'isChallengeCompleted'>,
  prefixo: string,
): RespostaEconomia {
  const me = ctx.usuario as UsuarioJogo;
  const ch = me.challenge!;

  if ((ctx.args[0] || '').toLowerCase() === 'coletar') {
    if (ch.claimed) return { texto: '❌ Você já coletou a recompensa de hoje.' };
    if (!p.isChallengeCompleted(me)) return { texto: '❌ Complete todas as tarefas diárias para coletar.' };
    me.wallet = (me.wallet || 0) + ch.reward;
    ch.claimed = true;
    f.saveEconomy(ctx.econ);
    return {
      texto: '╭━━━⊱ 🎉 *RECOMPENSA!* 🎉 ⊱━━━╮\n│\n│ ✅ Desafio diário concluído!\n'
        + `│ 💰 Recompensa: ${f.fmt(ch.reward)}\n│\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯`,
    };
  }

  let texto = '╭━━━⊱ 🏅 *DESAFIO DIÁRIO* 🏅 ⊱━━━╮\n│\n';
  for (const tarefa of ch.tasks || []) {
    texto += `│ 📋 ${ROTULOS_DESAFIO[tarefa.type] || tarefa.type}\n│    ${tarefa.progress || 0}/${tarefa.target}\n`;
  }
  texto += `│\n│ 🎁 Prêmio: ${f.fmt(ch.reward)}\n`;
  if (ch.claimed) texto += '│ ✅ (coletado)\n';
  texto += '│\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯';
  if (p.isChallengeCompleted(me) && !ch.claimed) texto += `\n\n💡 Use: ${prefixo}desafio coletar`;
  return { texto };
}

const SIMBOLOS_SLOT = ['🍒', '🍋', '🍉', '⭐', '🔔', '🍇', '🍊', '🍓'] as const;
const PESOS_SLOT = [30, 20, 15, 12, 10, 6, 4, 3] as const;
const COOLDOWN_SLOTS_MS = 8 * 60 * 1000;

/**
 * Cada rolo usa os mesmos pesos rotacionados, o que torna a combinação rara
 * de propósito — o cassino é deliberadamente desfavorável ao jogador.
 */
function sortearSlot(indice: number, aleatorio: () => number): string {
  const deslocado = [...PESOS_SLOT.slice(indice * 2), ...PESOS_SLOT.slice(0, indice * 2)];
  const total = deslocado.reduce((a, b) => a + b, 0);
  let sorteio = aleatorio() * total;
  for (let i = 0; i < SIMBOLOS_SLOT.length; i += 1) {
    sorteio -= deslocado[i]!;
    if (sorteio <= 0) return SIMBOLOS_SLOT[i]!;
  }
  return SIMBOLOS_SLOT[0];
}

/** `slots` — cassino de três rolos. Aposta padrão de 100 quando omitida. */
export function ramoSlots(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  a: FerramentasAcaso,
  t: Pick<FerramentasTexto, 'parseAmount'>,
): RespostaEconomia {
  const me = ctx.usuario as UsuarioJogo;
  const espera = me.cooldowns?.slots || 0;
  if (a.agora() < espera) return { texto: `⏳ Aguarde ${a.timeLeft(espera)} para jogar slots novamente.` };

  const aposta = t.parseAmount(ctx.args[0] || '100', me.wallet || 0);
  if (!Number.isFinite(aposta) || aposta <= 0) return { texto: 'Valor inválido.' };
  if (aposta > (me.wallet || 0)) return { texto: 'Saldo insuficiente.' };

  const rolos = [sortearSlot(0, a.aleatorio), sortearSlot(1, a.aleatorio), sortearSlot(2, a.aleatorio)];
  let mult = 0;
  if (rolos[0] === rolos[1] && rolos[1] === rolos[2]) mult = 2;
  else if (rolos[0] === rolos[1] || rolos[1] === rolos[2] || rolos[0] === rolos[2]) mult = 1.2;

  me.wallet = (me.wallet || 0) + Math.floor(aposta * (mult - 1));
  me.cooldowns = { ...me.cooldowns, slots: a.agora() + COOLDOWN_SLOTS_MS };
  f.saveEconomy(ctx.econ);

  const painel = `╭━━━⊱ 🎰 *SLOTS* 🎰 ⊱━━━╮\n│\n│ ${rolos.join(' | ')}\n│\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
  const desfecho = mult > 1
    ? `╭━━━⊱ 🎉 *GANHOU!* 🎉 ⊱━━━╮\n│\n│ 💰 Ganhou: *+${f.fmt(Math.floor(aposta * (mult - 1)))}*\n│\n╰━━━━━━━━━━━━━━━━━━━━╯`
    : `╭━━━⊱ 💸 *PERDEU!* 💸 ⊱━━━╮\n│\n│ 💔 Perdeu: *-${f.fmt(aposta)}*\n│\n╰━━━━━━━━━━━━━━━━━━━━╯`;
  return { texto: painel + desfecho };
}

const COOLDOWN_CRIME_MS = 30 * 60 * 1000;
const CHANCE_CRIME = 0.18;

/**
 * `crime` — aposta de alto risco. O cooldown é o mesmo no sucesso e na falha,
 * de propósito: fracassar não pode virar atalho para tentar de novo mais cedo.
 */
export function ramoCrime(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  a: FerramentasAcaso,
  p: FerramentasProgressao,
): RespostaEconomia {
  const me = ctx.usuario as UsuarioJogo;
  const espera = me.cooldowns?.crime || 0;
  if (a.agora() < espera) return { texto: `⏳ Aguarde ${a.timeLeft(espera)} para tentar de novo.` };

  const venceu = a.aleatorio() < CHANCE_CRIME;
  me.cooldowns = { ...me.cooldowns, crime: a.agora() + COOLDOWN_CRIME_MS };

  if (venceu) {
    const base = 40 + Math.floor(a.aleatorio() * 61);
    const ganho = Math.floor(base * (1 + p.getSkillBonus(me, 'crime') * 0.3));
    me.wallet = (me.wallet || 0) + ganho;
    p.addSkillXP(me, 'crime', 1);
    p.updateChallenge(me, 'crimeSuccess', 1, true);
    p.updatePeriodChallenge(me, 'crimeSuccess', 1, true);
    me.stats = { ...me.stats, totalCrimes: (me.stats?.totalCrimes || 0) + 1 };
    f.saveEconomy(ctx.econ);
    return {
      texto: '╭━━━⊱ 🕵️ *CRIME* 🕵️ ⊱━━━╮\n│\n│ ✅ Crime bem-sucedido!\n'
        + `│ 💰 Lucrou: ${f.fmt(ganho)}\n│\n│ ⚠️ Cuidado para não ser pego!\n│\n`
        + '╰━━━━━━━━━━━━━━━━━━━━━╯',
    };
  }

  // Multa limitada ao saldo: o legado nunca deixa a carteira negativa aqui.
  const multa = 200 + Math.floor(a.aleatorio() * 401);
  const pago = Math.min(me.wallet || 0, multa);
  me.wallet = (me.wallet || 0) - pago;
  f.saveEconomy(ctx.econ);
  return {
    texto: '╭━━━⊱ 🚔 *PEGO!* 🚔 ⊱━━━╮\n│\n│ ❌ Você foi pego pela polícia!\n'
      + `│ 💸 Multa: ${f.fmt(pago)}\n│\n╰━━━━━━━━━━━━━━━━━━━━╯`,
  };
}

type Propriedade = {
  name?: string; price: number; upkeepPerDay?: number;
  incomeGoldPerDay?: number; incomeMaterialsPerDay?: Record<string, number>;
};
type EcoProp = { propertiesCatalog?: Record<string, Propriedade> };

/** `propriedades` — vitrine do catálogo mais o que o jogador já possui. */
export function ramoPropriedades(ctx: ContextoEconomia, f: FerramentasEconomia): RespostaEconomia {
  const me = ctx.usuario as UsuarioJogo;
  const catalogo = (ctx.econ as EcoProp).propertiesCatalog || {};
  let texto = '🏠 Propriedades disponíveis\n\n';
  for (const [chave, prop] of Object.entries(catalogo)) {
    const ouro = prop.incomeGoldPerDay || 0;
    const mats = Object.entries(prop.incomeMaterialsPerDay || {}).map(([mk, mq]) => `${mk} x${mq}/dia`).join(', ');
    const renda = `${ouro > 0 ? `${f.fmt(ouro)} gold/dia` : ''}${mats ? `${ouro > 0 ? ' e ' : ''}${mats}` : ''}`;
    texto += `• ${chave} — ${prop.name} — Preço: ${f.fmt(prop.price)}`
      + ` — Manutenção: ${f.fmt(prop.upkeepPerDay || 0)}/dia — Renda: ${renda}\n`;
  }

  const minhas = me.properties || {};
  const possuidas = Object.keys(minhas).filter((k) => minhas[k]?.owned);
  if (possuidas.length > 0) {
    texto += '\n📦 Suas propriedades:\n';
    for (const chave of possuidas) {
      const desde = minhas[chave]!.lastCollect
        ? new Date(minhas[chave]!.lastCollect!).toLocaleDateString('pt-BR')
        : '—';
      texto += `• ${catalogo[chave]?.name || chave} — desde ${desde}\n`;
    }
  }
  return { texto };
}

/** `comprarpropriedade` — compra única; nunca duplica o que já é do jogador. */
export function ramoComprarPropriedade(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  a: Pick<FerramentasAcaso, 'agora'>,
  prefixo: string,
): RespostaEconomia {
  const me = ctx.usuario as UsuarioJogo;
  const chave = (ctx.args[0] || '').toLowerCase();
  if (!chave) return { texto: `Use: ${prefixo}comprarpropriedade <tipo>` };

  const prop = ((ctx.econ as EcoProp).propertiesCatalog || {})[chave];
  if (!prop) return { texto: 'Propriedade inexistente.' };
  if (me.properties?.[chave]?.owned) return { texto: 'Você já possui essa propriedade.' };
  if ((me.wallet || 0) < prop.price) return { texto: 'Saldo insuficiente.' };

  me.wallet = (me.wallet || 0) - prop.price;
  me.properties = { ...me.properties, [chave]: { owned: true, lastCollect: a.agora() } };
  f.saveEconomy(ctx.econ);
  return { texto: `🏠 Você comprou ${prop.name}!` };
}

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * `coletarpropriedades` — renda acumulada menos manutenção.
 *
 * Aborta inteiro se faltar saldo para a manutenção de qualquer propriedade,
 * como o legado: cobrar parcial deixaria o relógio de umas zerado e o de
 * outras não, e o jogador pagaria de novo pelos mesmos dias.
 */
export function ramoColetarPropriedades(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  a: Pick<FerramentasAcaso, 'agora'>,
  p: Pick<FerramentasProgressao, 'giveMaterial'>,
): RespostaEconomia {
  const me = ctx.usuario as UsuarioJogo;
  const catalogo = (ctx.econ as EcoProp).propertiesCatalog || {};
  const props = me.properties || {};
  const chaves = Object.keys(props).filter((k) => props[k]?.owned);
  if (chaves.length === 0) return { texto: 'Você não possui propriedades.' };

  const agora = a.agora();
  let totalOuro = 0;
  const materiais: Record<string, number> = {};

  for (const chave of chaves) {
    const meta = catalogo[chave];
    if (!meta) continue;
    const dias = Math.max(1, Math.ceil((agora - (props[chave]!.lastCollect || agora)) / DIA_MS));
    const manutencao = (meta.upkeepPerDay || 0) * dias;
    if ((me.wallet || 0) < manutencao) {
      return { texto: `Saldo insuficiente para pagar manutenção de ${meta.name} (${f.fmt(manutencao)}).` };
    }
    me.wallet = (me.wallet || 0) - manutencao;
    if (meta.incomeGoldPerDay) totalOuro += meta.incomeGoldPerDay * dias;
    for (const [mk, mq] of Object.entries(meta.incomeMaterialsPerDay || {})) {
      materiais[mk] = (materiais[mk] || 0) + mq * dias;
    }
    props[chave]!.lastCollect = agora;
  }

  me.wallet = (me.wallet || 0) + totalOuro;
  for (const [mk, mq] of Object.entries(materiais)) p.giveMaterial(me, mk, mq);
  f.saveEconomy(ctx.econ);

  let msg = `🏡 Coleta concluída! +${f.fmt(totalOuro)} gold`;
  const lista = Object.entries(materiais);
  if (lista.length > 0) msg += ` | Materiais: ${lista.map(([k, q]) => `${k} x${q}`).join(', ')}`;
  return { texto: msg };
}

/** Catálogo de habilidades, na ordem em que o legado sempre mostrou. */
export interface FerramentasHabilidade {
  readonly SKILL_LIST: readonly string[];
  readonly skillXpForNext: (nivel: number) => number;
  readonly ensureUserSkills: (usuario: unknown) => void;
}

type UsuarioSkills = UsuarioJogo & {
  skills?: Record<string, { level: number; xp: number }>;
  ingredients?: Record<string, number>;
};

/**
 * `banco` — extrato da conta.
 *
 * A capacidade vem de `applyShopBonuses` e pode ser Infinity para quem tem
 * cofre sem limite; nesse caso o legado escreve "Ilimitada" em vez do número.
 */
export function ramoBanco(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  capacidade: number,
): RespostaEconomia {
  const me = ctx.usuario as UsuarioEco;
  const limite = Number.isFinite(capacidade) ? f.fmt(capacidade) : 'Ilimitada';
  return {
    texto: '╭━━━⊱ 🏦 *BANCO* 🏦 ⊱━━━╮\n│\n'
      + `│ 💰 *Saldo:* ${f.fmt(me.bank)}\n│ 📦 *Capacidade:* ${limite}\n│\n`
      + '╰━━━━━━━━━━━━━━━━━━━━━╯',
  };
}

/** `habilidades` — progresso de cada perícia e quanto falta para o próximo nível. */
export function ramoHabilidades(ctx: ContextoEconomia, h: FerramentasHabilidade): RespostaEconomia {
  const me = ctx.usuario as UsuarioSkills;
  h.ensureUserSkills(me);
  let texto = '📚 Habilidades\n\n';
  for (const chave of h.SKILL_LIST) {
    const sk = me.skills![chave]!;
    texto += `• ${chave}: Nível ${sk.level} (${sk.xp}/${h.skillXpForNext(sk.level)})\n`;
  }
  return { texto };
}

/** `ingredientes` — despensa do jogador. Esconde o que zerou. */
export function ramoIngredientes(ctx: ContextoEconomia, prefixo: string): RespostaEconomia {
  const me = ctx.usuario as UsuarioSkills;
  me.ingredients = me.ingredients || {};
  // Quantidade zero é resto de consumo, não item: listar poluiria a despensa.
  const itens = Object.entries(me.ingredients).filter(([, qtd]) => qtd > 0);

  if (itens.length === 0) {
    return {
      texto: '📦 *INGREDIENTES*\n\nVocê não possui ingredientes.\n\n'
        + `🌱 Plante com ${prefixo}plantar para conseguir ingredientes!`,
    };
  }

  let texto = '📦 *MEUS INGREDIENTES*\n\n';
  for (const [ing, qtd] of itens) texto += `• ${ing}: x${qtd}\n`;
  texto += `\n👨‍🍳 Use ${prefixo}receitas para ver o que pode cozinhar`;
  return { texto };
}

/** Sementes padrão, embutidas como no legado para o primeiro uso da economia. */
export const SEMENTES_PADRAO: Record<string, {
  name: string; cost: number; growTime: number; yield: Record<string, number>;
}> = {
  trigo: { name: '🌾 Trigo', cost: 20, growTime: 5 * 60 * 1000, yield: { trigo: 3 } },
  cenoura: { name: '🥕 Cenoura', cost: 15, growTime: 4 * 60 * 1000, yield: { cenoura: 2 } },
  batata: { name: '🥔 Batata', cost: 15, growTime: 4 * 60 * 1000, yield: { batata: 2 } },
  tomate: { name: '🍅 Tomate', cost: 18, growTime: 6 * 60 * 1000, yield: { tomate: 3 } },
  alface: { name: '🥬 Alface', cost: 12, growTime: 3 * 60 * 1000, yield: { alface: 2 } },
  milho: { name: '🌽 Milho', cost: 25, growTime: 7 * 60 * 1000, yield: { milho: 4 } },
  arroz: { name: '🌾 Arroz', cost: 22, growTime: 8 * 60 * 1000, yield: { arroz: 4 } },
  cana: { name: '🌿 Cana-de-açúcar', cost: 30, growTime: 10 * 60 * 1000, yield: { acucar: 5 } },
};

/**
 * `sementes` — catálogo de plantio.
 *
 * Grava o padrão na economia quando ela ainda não tem sementes, igual ao
 * legado: `plantar` lê de `econ.seeds`, então só mostrar não bastaria.
 */
export function ramoSementes(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  prefixo: string,
): RespostaEconomia {
  const econ = ctx.econ as { seeds?: typeof SEMENTES_PADRAO };
  if (!econ.seeds) {
    econ.seeds = { ...SEMENTES_PADRAO };
    f.saveEconomy(econ);
  }

  let texto = '🌱 *CATÁLOGO DE SEMENTES*\n\n';
  for (const [chave, semente] of Object.entries(econ.seeds)) {
    const minutos = Math.floor(semente.growTime / 60000);
    const colheita = Object.entries(semente.yield).map(([k, v]) => `${k} x${v}`).join(', ');
    texto += `${semente.name}\n`
      + `  💰 Custo: ${f.fmt(semente.cost)}\n`
      + `  ⏱️ Crescimento: ${minutos} min\n`
      + `  🌾 Colheita: ${colheita}\n`
      + `  🌱 Plantar: ${prefixo}plantar ${chave}\n\n`;
  }
  texto += `💡 *Dica:* Use ${prefixo}horta para ver suas plantações`;
  return { texto };
}

/** `demitir` — larga o emprego atual. Sem cooldown, como no legado. */
export function ramoDemitir(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  prefixo: string,
): RespostaEconomia {
  (ctx.usuario as UsuarioEco).job = null;
  f.saveEconomy(ctx.econ);
  return {
    texto: '╭━━━⊱ 👋 *DEMISSÃO* 👋 ⊱━━━╮\n│\n│ ✅ Você pediu demissão\n│\n'
      + `│ 💼 Veja novas vagas: ${prefixo}vagas\n│\n╰━━━━━━━━━━━━━━━━━━━━━━╯`,
  };
}

export interface Receita {
  readonly name: string;
  readonly requires: Record<string, number>;
  readonly gold: number;
  readonly sellPrice: number;
  readonly energy: number;
}

/**
 * Receitas padrão.
 *
 * No monólito este objeto estava escrito duas vezes, literal, em `receitas` e
 * em `cozinhar` — duas cópias que já podiam divergir em silêncio. Aqui é uma só.
 */
export const RECEITAS_PADRAO: Record<string, Receita> = {
  pao: { name: '🍞 Pão', requires: { trigo: 3 }, gold: 10, sellPrice: 50, energy: 10 },
  sopa: { name: '🍲 Sopa', requires: { cenoura: 2, batata: 2 }, gold: 15, sellPrice: 80, energy: 20 },
  salada: { name: '🥗 Salada', requires: { alface: 2, tomate: 2 }, gold: 12, sellPrice: 60, energy: 15 },
  bolo: { name: '🍰 Bolo', requires: { trigo: 5, ovo: 3 }, gold: 25, sellPrice: 120, energy: 30 },
  pizza: { name: '🍕 Pizza', requires: { trigo: 4, tomate: 3, queijo: 2 }, gold: 35, sellPrice: 150, energy: 40 },
  hamburguer: { name: '🍔 Hambúrguer', requires: { carne: 2, trigo: 3, alface: 1 }, gold: 40, sellPrice: 180, energy: 50 },
  sushi: { name: '🍣 Sushi', requires: { peixe: 4, arroz: 3 }, gold: 50, sellPrice: 200, energy: 45 },
  macarrao: { name: '🍝 Macarrão', requires: { trigo: 3, tomate: 2 }, gold: 20, sellPrice: 90, energy: 25 },
};

/** `receitas` — cardápio. Grava o padrão na primeira consulta, como o legado. */
export function ramoReceitas(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  prefixo: string,
): RespostaEconomia {
  const econ = ctx.econ as { cookingRecipes?: Record<string, Receita> };
  if (!econ.cookingRecipes) {
    econ.cookingRecipes = { ...RECEITAS_PADRAO };
    f.saveEconomy(econ);
  }

  let texto = '📖 *RECEITAS CULINÁRIAS*\n\n';
  for (const [chave, rec] of Object.entries(econ.cookingRecipes)) {
    const ingredientes = Object.entries(rec.requires).map(([ing, qtd]) => `${ing} x${qtd}`).join(', ');
    texto += `${rec.name}\n`
      + `  📦 Ingredientes: ${ingredientes}\n`
      + `  💰 Custo: ${f.fmt(rec.gold)}\n`
      + `  💵 Venda: ${f.fmt(rec.sellPrice)}\n`
      + `  ⚡ Energia: +${rec.energy}\n`
      + `  🍳 Cozinhar: ${prefixo}cozinhar ${chave}\n\n`;
  }
  texto += `💡 *Dica:* Plante ingredientes com ${prefixo}plantar`;
  return { texto };
}

const CLASSES_RPG: Record<string, { emoji: string; name: string }> = {
  guerreiro: { emoji: '⚔️', name: 'Guerreiro' },
  mago: { emoji: '🧙', name: 'Mago' },
  arqueiro: { emoji: '🏹', name: 'Arqueiro' },
  curandeiro: { emoji: '💚', name: 'Curandeiro' },
  ladino: { emoji: '🗡️', name: 'Ladino' },
  paladino: { emoji: '🛡️', name: 'Paladino' },
};

const CASAS_RPG: Record<string, { emoji: string; name: string }> = {
  barraca: { emoji: '⛺', name: 'Barraca' },
  cabana: { emoji: '🏚️', name: 'Cabana' },
  casa: { emoji: '🏠', name: 'Casa' },
  mansao: { emoji: '🏰', name: 'Mansão' },
  castelo: { emoji: '🏯', name: 'Castelo' },
};

const ROTULOS_RELACAO: Record<string, { rotulo: string; emoji: string }> = {
  casamento: { rotulo: 'Casado(a)', emoji: '💍' },
  namoro: { rotulo: 'Namorando', emoji: '💞' },
  brincadeira: { rotulo: 'Brincadeira', emoji: '🎈' },
};

/** Vínculo ativo do jogador, vindo do gestor de relacionamentos legado. */
export interface ParAtivo {
  readonly partnerId?: string | null;
  readonly pair?: { status?: string } | null;
}

export interface DadosPerfilRpg {
  readonly pushname: string;
  readonly parAtivo: ParAtivo | null;
}

type UsuarioPerfil = UsuarioSkills & {
  level?: number; exp?: number; power?: number;
  battlesWon?: number; battlesLost?: number;
  achievements?: Record<string, unknown>;
  pets?: readonly unknown[];
  premiumItems?: Record<string, unknown>;
  prestige?: { level?: number; bonusMultiplier?: number };
  reputation?: { points?: number; karma?: number };
  streak?: { count?: number };
  classe?: string | null;
  clan?: string | null;
  house?: { type?: string } | null;
  family?: { spouse?: string | null; children?: readonly unknown[] } | null;
};

/**
 * `perfilrpg` — ficha completa do jogador.
 *
 * Só lê e formata. O legado indexava `econ.clans[...]` e `econ.jobCatalog[...]`
 * sem guarda, contando com `ensureEconomyDefaults` ter rodado antes; aqui o
 * acesso é opcional para que uma economia incompleta degrade em vez de derrubar
 * o comando.
 */
export function ramoPerfilRpg(
  ctx: ContextoEconomia,
  f: FerramentasEconomia,
  h: Pick<FerramentasHabilidade, 'SKILL_LIST' | 'ensureUserSkills'>,
  dados: DadosPerfilRpg,
  prefixo: string,
): RespostaEconomia {
  const me = ctx.usuario as UsuarioPerfil;
  const econ = ctx.econ as Eco & { clans?: Record<string, { name?: string }> };

  const nivel = me.level || 1;
  const exp = me.exp || 0;
  const expProximo = 100 * 1.5 ** (nivel - 1);
  const expPercent = Math.min(100, Math.floor((exp / expProximo) * 100));

  h.ensureUserSkills(me);
  const topSkills = h.SKILL_LIST
    .map((sk) => ({ nome: sk, nivel: me.skills?.[sk]?.level || 1 }))
    .sort((a, b) => b.nivel - a.nivel)
    .slice(0, 3);

  const vitorias = me.battlesWon || 0;
  const derrotas = me.battlesLost || 0;
  const batalhas = vitorias + derrotas;
  const aproveitamento = batalhas > 0 ? Math.floor((vitorias / batalhas) * 100) : 0;

  const streak = me.streak?.count || 0;
  const classe = me.classe ? `${CLASSES_RPG[me.classe]?.emoji} ${CLASSES_RPG[me.classe]?.name}` : 'Nenhuma';
  const cla = (me.clan && econ.clans?.[me.clan]?.name) || (me.clan && econ.clans?.[me.clan] ? 'Sem nome' : 'Nenhum');
  const casaTipo = me.house?.type;
  const casa = casaTipo ? `${CASAS_RPG[casaTipo]?.emoji || ''} ${CASAS_RPG[casaTipo]?.name || casaTipo}` : 'Nenhuma';

  const par = dados.parAtivo;
  const relacao = par?.pair?.status ? ROTULOS_RELACAO[par.pair.status] : undefined;
  const mencoes = par?.partnerId ? [par.partnerId] : [];

  let texto = '╭━━━⊱ ⚔️ *PERFIL RPG* ⚔️ ⊱━━━╮\n'
    + `│ ${dados.pushname}\n`
    + '╰━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n';

  texto += '📊 *NÍVEL & EXPERIÊNCIA*\n'
    + `├ Level: ${nivel}\n`
    + `├ XP: ${exp}/${Math.floor(expProximo)} (${expPercent}%)\n`
    + `├ Prestige: ${me.prestige?.level || 0}x (${(me.prestige?.bonusMultiplier || 1).toFixed(2)}x)\n`
    + `└ Streak: ${streak} dia${streak !== 1 ? 's' : ''}\n\n`;

  texto += '💰 *FINANÇAS*\n'
    + `├ Carteira: ${f.fmt(me.wallet)}\n`
    + `├ Banco: ${f.fmt(me.bank)}\n`
    + `├ Total: ${f.fmt((me.wallet || 0) + (me.bank || 0))}\n`
    + `└ Emprego: ${me.job ? econ.jobCatalog?.[me.job]?.name || me.job : 'Desempregado(a)'}\n\n`;

  texto += `🎭 *PERSONALIZAÇÃO*\n├ Classe: ${classe}\n├ Clã: ${cla}\n└ Casa: ${casa}\n\n`;

  texto += '⚔️ *COMBATE*\n'
    + `├ Vitórias: ${vitorias}\n├ Derrotas: ${derrotas}\n`
    + `├ Win Rate: ${aproveitamento}%\n└ Poder: ${me.power || 100}\n\n`;

  texto += '🛠️ *HABILIDADES (TOP 3)*\n';
  topSkills.forEach((sk, i) => {
    const galho = i === topSkills.length - 1 ? '└' : '├';
    texto += `${galho} ${sk.nome.charAt(0).toUpperCase()}${sk.nome.slice(1)}: Lv.${sk.nivel}\n`;
  });
  texto += '\n';

  texto += '👨‍👩‍👧‍👦 *FAMÍLIA & RELACIONAMENTO*\n';
  if (relacao && par?.partnerId) {
    texto += `├ ${relacao.emoji} Status: ${relacao.rotulo}\n`
      + `├ Parceiro(a): @${par.partnerId.split('@')[0]}\n`;
  } else {
    texto += '├ 💔 Status: Solteiro(a)\n';
  }
  texto += `└ Filhos: ${(me.family?.children || []).length}\n\n`;

  texto += '🏆 *COLECIONÁVEIS*\n'
    + `├ Conquistas: ${Object.keys(me.achievements || {}).length}\n`
    + `├ Pets: ${(me.pets || []).length}\n`
    + `└ Itens Premium: ${Object.keys(me.premiumItems || {}).length}\n\n`;

  texto += `⭐ *REPUTAÇÃO*\n├ Pontos: ${me.reputation?.points || 0}\n└ Karma: ${me.reputation?.karma || 0}\n\n`;
  texto += `💎 Use ${prefixo}meustats para ver estatísticas detalhadas`;

  return mencoes.length > 0 ? { texto, mencoes } : { texto };
}

/** Ramos já migrados. Serve de gate: o que não está aqui segue no monólito. */
export const RAMOS_MIGRADOS = Object.freeze([
  'banco', 'cancelar', 'carteira', 'coletarpropriedades', 'comprarpropriedade',
  'crime', 'demitir', 'desafio', 'emprego', 'habilidades', 'ingredientes',
  'listar', 'materiais', 'mercado', 'perfilrpg', 'propriedades', 'receitas',
  'resetrpg', 'sementes', 'slots', 'vagas', 'vender', 'vendercomida',
]);
