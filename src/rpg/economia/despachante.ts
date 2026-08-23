/**
 * Porta de entrada do bloco de economia migrado.
 *
 * O monólito trata os 23 ramos num `case` único com 85 aliases. Trocar tudo de
 * uma vez seria uma cirurgia de risco alto num arquivo de 32 mil linhas, então
 * a substituição é por estrangulamento: o legado chama este despachante antes
 * de entrar nos seus próprios `if`s, e só segue adiante quando a resposta é
 * `null`.
 *
 * Isso torna o corte reversível de graça. Um ramo que saia daqui volta a ser
 * atendido pelo código antigo sem deploy nenhum — e enquanto os dois convivem,
 * o legado é a rede de segurança, não uma segunda fonte de verdade: para os
 * ramos listados em RAMOS_MIGRADOS ele nunca roda.
 */

import type { ContextoEconomia } from './context.js';
import {
  RAMOS_MIGRADOS,
  ramoBanco, ramoCancelar, ramoCarteira, ramoColetarPropriedades,
  ramoComprarPropriedade, ramoCrime, ramoDemitir, ramoDesafio, ramoEmprego,
  ramoHabilidades, ramoIngredientes, ramoListar, ramoMateriais, ramoMercado,
  ramoPerfilRpg, ramoPropriedades, ramoReceitas, ramoResetRpg, ramoSementes,
  ramoSlots, ramoVagas, ramoVender, ramoVenderComida,
} from './ramos.js';
import type {
  DadosPerfilRpg, FerramentasAcaso, FerramentasEconomia, FerramentasHabilidade,
  FerramentasProgressao, FerramentasTexto, PermissaoReset, RespostaEconomia,
} from './ramos.js';

/** Tudo que os ramos tomam emprestado do runtime legado, num pacote só. */
export interface DependenciasDespacho {
  readonly economia: FerramentasEconomia;
  readonly acaso: FerramentasAcaso;
  readonly texto: FerramentasTexto;
  readonly progressao: FerramentasProgressao;
  readonly habilidade: FerramentasHabilidade;
}

/** Dados da mensagem que alguns ramos precisam além do contexto de economia. */
export interface DadosDespacho {
  readonly prefixo: string;
  readonly remetente: string;
  readonly pushname: string;
  readonly mencionado: string | null;
  readonly membrosDoGrupo: readonly string[];
  readonly consultaBruta: string;
  readonly permissaoReset: PermissaoReset;
  readonly parAtivo: DadosPerfilRpg['parAtivo'];
  readonly capacidadeBanco: number;
}

/** Verdadeiro quando o ramo já saiu do monólito e não deve rodar por lá. */
export function estaMigrado(sub: string): boolean {
  return (RAMOS_MIGRADOS as readonly string[]).includes(sub);
}

/**
 * Atende o ramo, ou devolve `null` para o legado seguir.
 *
 * Nunca devolve `null` para um ramo de RAMOS_MIGRADOS: se a lista e este
 * switch divergirem, o comando cairia num corpo legado que já foi considerado
 * morto. O teste de cobertura guarda essa correspondência.
 */
export function despachar(
  ctx: ContextoEconomia,
  d: DependenciasDespacho,
  dados: DadosDespacho,
): RespostaEconomia | null {
  const { economia: f, acaso: a, texto: t, progressao: p, habilidade: h } = d;
  const { prefixo } = dados;

  switch (ctx.sub) {
    case 'banco': return ramoBanco(ctx, f, dados.capacidadeBanco);
    case 'cancelar': return ramoCancelar(ctx, f, dados.remetente);
    case 'carteira': return ramoCarteira(ctx, f);
    case 'coletarpropriedades': return ramoColetarPropriedades(ctx, f, a, p);
    case 'comprarpropriedade': return ramoComprarPropriedade(ctx, f, a, prefixo);
    case 'crime': return ramoCrime(ctx, f, a, p);
    case 'demitir': return ramoDemitir(ctx, f, prefixo);
    case 'desafio': return ramoDesafio(ctx, f, p, prefixo);
    case 'emprego': return ramoEmprego(ctx, f, t, prefixo);
    case 'habilidades': return ramoHabilidades(ctx, h);
    case 'ingredientes': return ramoIngredientes(ctx, prefixo);
    case 'listar': return ramoListar(ctx, f, dados.remetente, prefixo);
    case 'materiais': return ramoMateriais(ctx, prefixo);
    case 'mercado': return ramoMercado(ctx, f);
    case 'perfilrpg':
      return ramoPerfilRpg(ctx, f, h, { pushname: dados.pushname, parAtivo: dados.parAtivo }, prefixo);
    case 'propriedades': return ramoPropriedades(ctx, f);
    case 'receitas': return ramoReceitas(ctx, f, prefixo);
    case 'resetrpg':
      return ramoResetRpg(
        ctx, f, dados.permissaoReset, dados.mencionado,
        dados.membrosDoGrupo, dados.consultaBruta,
      );
    case 'sementes': return ramoSementes(ctx, f, prefixo);
    case 'slots': return ramoSlots(ctx, f, a, t);
    case 'vagas': return ramoVagas(ctx, f, prefixo);
    case 'vender': return ramoVender(ctx, f, t, prefixo);
    case 'vendercomida': return ramoVenderComida(ctx, f, prefixo);
    default: return null;
  }
}
