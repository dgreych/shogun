/**
 * Contexto compartilhado do bloco de economia do RPG.
 *
 * Os 23 ramos internos do bloco `perfilrpg` — que 85 aliases compartilham —
 * comecam todos pelo mesmo preambulo: dois gates, carga da economia, resolucao
 * do usuario e aplicacao de bonus de loja. Enquanto isso ficar embutido no
 * monolito, nenhum ramo pode sair de la sozinho.
 *
 * Isolar o preambulo e o primeiro passo da nativizacao: com ele tipado aqui,
 * cada ramo passa a poder migrar em fatia propria, com paridade provada, sem
 * arrastar os outros 22 junto.
 */

/** Motivo pelo qual o bloco recusou atender, antes de qualquer ramo rodar. */
export type RecusaEconomia = 'fora-de-grupo' | 'modo-rpg-desativado';

export interface BonusDeLoja {
  readonly mineBonus: number;
  readonly workBonus: number;
  readonly bankCapacity: number;
  readonly fishBonus: number;
  readonly exploreBonus: number;
  readonly huntBonus: number;
  readonly forgeBonus: number;
}

export interface EntradaEconomia {
  readonly emGrupo: boolean;
  /** Vem do estado do grupo; sem ele os comandos de RPG nao respondem. */
  readonly modoRpgAtivo: boolean;
  readonly remetente: string;
  /** O comando digitado, que seleciona o ramo interno. */
  readonly comando: string;
  /** Texto apos o comando, ja normalizado pelo chamador. */
  readonly consulta: string;
}

export interface DependenciasEconomia {
  readonly loadEconomy: () => unknown;
  readonly ensureEconomyDefaults: (econ: unknown) => boolean;
  readonly getEcoUser: (econ: unknown, id: string) => unknown;
  readonly ensureUserChallenge: (usuario: unknown) => void;
  readonly applyShopBonuses: (usuario: unknown, econ: unknown) => BonusDeLoja;
  readonly saveEconomy: (econ: unknown) => void;
}

export interface ContextoEconomia {
  readonly econ: unknown;
  readonly usuario: unknown;
  readonly bonus: BonusDeLoja;
  /** Sub-comando que decide o ramo. */
  readonly sub: string;
  /** Argumentos ja divididos e em minusculas, como o bloco legado espera. */
  readonly args: readonly string[];
}

export type ResultadoPreambulo =
  | { readonly ok: true; readonly contexto: ContextoEconomia }
  | { readonly ok: false; readonly recusa: RecusaEconomia };

/**
 * Reproduz o preambulo legado com a MESMA ordem de efeitos.
 *
 * A ordem importa e nao e cosmetica: os defaults sao garantidos antes de
 * resolver o usuario, o desafio e garantido antes dos bonus, e a economia so e
 * salva quando os defaults mudaram algo. Inverter qualquer um desses passos
 * muda o que fica gravado em disco.
 */
export function prepararEconomia(
  entrada: EntradaEconomia,
  deps: DependenciasEconomia,
): ResultadoPreambulo {
  if (!entrada.emGrupo) return { ok: false, recusa: 'fora-de-grupo' };
  if (!entrada.modoRpgAtivo) return { ok: false, recusa: 'modo-rpg-desativado' };

  const econ = deps.loadEconomy();
  const mudou = deps.ensureEconomyDefaults(econ);
  const usuario = deps.getEcoUser(econ, entrada.remetente);
  deps.ensureUserChallenge(usuario);
  const bonus = deps.applyShopBonuses(usuario, econ);
  // Só grava quando os defaults mexeram em algo: salvar sempre multiplicaria
  // escrita em disco a cada comando de RPG do grupo.
  if (mudou) deps.saveEconomy(econ);

  const consulta = String(entrada.consulta || '').trim();
  return {
    ok: true,
    contexto: {
      econ,
      usuario,
      bonus,
      sub: entrada.comando,
      args: consulta ? consulta.toLowerCase().split(/\s+/) : [],
    },
  };
}

/** Mensagens de recusa, preservadas ao pe da letra do bloco legado. */
export function textoDaRecusa(recusa: RecusaEconomia, prefixo: string): string {
  if (recusa === 'fora-de-grupo') return '\u2694\ufe0f Os comandos RPG funcionam apenas em grupos.';
  return '\u2694\ufe0f *Modo RPG desativado!*\n\n\ud83d\udd12 Este recurso est\u00e1 dispon\u00edvel apenas quando o Modo RPG est\u00e1 ativado.\n'
    + '\ud83d\udd10 *Administradores* podem ativar com: ' + prefixo + 'modorpg\n\n'
    + '\ud83d\udca1 Use ' + prefixo + 'menurpg para ver todos os comandos!';
}
