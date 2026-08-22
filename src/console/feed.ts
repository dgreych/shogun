/**
 * Feed tematico do console: um despacho Shogun por mensagem recebida.
 *
 * A hierarquia e deliberadamente simples: natureza e origem na faixa superior,
 * conteudo primeiro no corpo, identidade depois. O tema nunca compete com a
 * informacao e cada cartao continua legivel em uma cascata rapida.
 */

const ESC = '\u001b';
const R = ESC + '[0m';
const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/g;

const frente = (r: number, g: number, b: number): string => ESC + '[38;2;' + r + ';' + g + ';' + b + 'm';
const fundo = (r: number, g: number, b: number): string => ESC + '[48;2;' + r + ';' + g + ';' + b + 'm';

const PRETO = frente(10, 10, 13);
const OURO = frente(222, 176, 84);
const BRASA = frente(206, 40, 46);
const OSSO = frente(232, 226, 214);
const FUMACA = frente(122, 126, 138);
const MOLDURA = frente(86, 28, 32);
const FUNDO = fundo(10, 10, 13);
const FUNDO_BRASA = fundo(92, 15, 21);
const FUNDO_OURO = fundo(222, 176, 84);
const FUNDO_OSSO = fundo(232, 226, 214);

/** Remove sequencias capazes de quebrar o cartao ou controlar o terminal. */
export function textoSeguroParaTerminal(texto: string): string {
  return texto
    .replace(ANSI, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Largura em COLUNAS, nao em caracteres.
 *
 * Emoji, simbolos e ideogramas podem ocupar duas colunas; marcas combinantes
 * nao ocupam coluna propria. ANSI tambem nao participa da geometria.
 */
export function larguraVisual(texto: string): number {
  let total = 0;
  for (const ch of texto.replace(ANSI, '')) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0xfe0f || (cp >= 0x300 && cp <= 0x36f)) continue;
    const largo = (cp >= 0x1100 && cp <= 0x115f)
      || (cp >= 0x2e80 && cp <= 0xa4cf)
      || (cp >= 0xac00 && cp <= 0xd7a3)
      || (cp >= 0xf900 && cp <= 0xfaff)
      || (cp >= 0xfe30 && cp <= 0xfe6f)
      || (cp >= 0xff00 && cp <= 0xff60)
      || (cp >= 0x1f300 && cp <= 0x1faff);
    total += largo ? 2 : 1;
  }
  return total;
}

/** Corta respeitando colunas, com reticencia quando sobra texto. */
function cortar(texto: string, limite: number): string {
  if (larguraVisual(texto) <= limite) return texto;
  let saida = '';
  let usado = 0;
  for (const ch of texto) {
    const largura = larguraVisual(ch);
    if (usado + largura > limite - 1) break;
    saida += ch;
    usado += largura;
  }
  return saida + '\u2026';
}

const LARGURA = 60;

function preencher(texto: string, largura: number): string {
  const seguro = cortar(texto, largura);
  return seguro + ' '.repeat(Math.max(0, largura - larguraVisual(seguro)));
}

function regua(esq: string, meio: string, dir: string): string {
  return MOLDURA + esq + meio.repeat(LARGURA) + dir + R;
}

function reguaComMarca(): string {
  const marca = ' SHOGUN / SENTINELA ';
  const restante = Math.max(0, LARGURA - 1 - larguraVisual(marca));
  return MOLDURA + '\u256d\u2500' + R + OURO + marca + R + MOLDURA + '\u2500'.repeat(restante) + '\u256e' + R;
}

function linhaFundo(conteudo: string, corTexto: string = OSSO): string {
  const limpo = '  ' + textoSeguroParaTerminal(conteudo);
  return MOLDURA + '\u2502' + R + FUNDO + corTexto + preencher(limpo, LARGURA) + R + MOLDURA + '\u2502' + R;
}

function linhaCampo(marca: string, rotulo: string, valor: string, corValor: string): string {
  const valorSeguro = textoSeguroParaTerminal(valor) || '\u2014';
  const prefixo = `  ${marca}  ${rotulo.toUpperCase().padEnd(9)} `;
  const disponivel = LARGURA - larguraVisual(prefixo);
  const conteudo = cortar(valorSeguro, disponivel);
  const sobra = disponivel - larguraVisual(conteudo);
  return MOLDURA + '\u2502' + R + FUNDO + FUMACA + prefixo + corValor + conteudo
    + ' '.repeat(Math.max(0, sobra)) + R + MOLDURA + '\u2502' + R;
}

function linhaCabecalho(comando: boolean, contexto: string, horario: string): string {
  const titulo = comando ? ' ORDEM RECEBIDA ' : ' DESPACHO RECEBIDO ';
  const fundoTitulo = comando ? FUNDO_OURO : FUNDO_OSSO;
  const direita = `${contexto}  \u00b7  ${horario} `;
  const miolo = LARGURA - larguraVisual(titulo) - larguraVisual(direita);
  return MOLDURA + '\u2502' + R + fundoTitulo + PRETO + titulo + R + FUNDO_BRASA + OSSO
    + ' '.repeat(Math.max(1, miolo)) + direita + R + MOLDURA + '\u2502' + R;
}

export interface EventoFeed {
  readonly comando: boolean;
  readonly emGrupo: boolean;
  readonly conteudo: string;
  readonly grupo?: string | null;
  readonly usuario?: string | null;
  readonly numero?: string | null;
  readonly horario: string;
}

/** Desenha um cartao completo, sempre com a mesma largura visual. */
export function renderEventoFeed(evento: EventoFeed): string {
  const contexto = evento.emGrupo ? 'GRUPO' : 'PRIVADO';
  const horario = textoSeguroParaTerminal(evento.horario) || '--:--:--';
  const linhas = [
    reguaComMarca(),
    linhaCabecalho(evento.comando, contexto, horario),
    regua('\u251c', '\u2500', '\u2524'),
    linhaCampo('\u203a', 'conteúdo', evento.conteudo, OSSO),
  ];

  if (evento.emGrupo) {
    linhas.push(linhaCampo('\u25c7', 'grupo', evento.grupo || 'desconhecido', BRASA));
    linhas.push(linhaCampo('\u25cf', 'usuário', evento.usuario || 'sem nome', OSSO));
  } else {
    linhas.push(linhaCampo('\u25cf', 'usuário', evento.usuario || 'sem nome', OSSO));
    linhas.push(linhaCampo('\u25cb', 'número', evento.numero || '\u2014', FUMACA));
  }

  linhas.push(regua('\u251c', '\u2500', '\u2524'));
  linhas.push(linhaFundo('REGISTRO LOCAL  /  FLUXO MONITORADO', FUMACA));
  linhas.push(regua('\u2570', '\u2500', '\u256f'));
  return linhas.join('\n');
}
