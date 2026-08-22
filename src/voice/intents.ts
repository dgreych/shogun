/**
 * Intenção semântica de um comando.
 *
 * O sistema antigo mapeava emoji por NOME de comando: 44 overrides exatos e 13
 * regex, para 545 famílias — 8% de cobertura explícita. Os outros 92% caíam em
 * padrões largos ou no ⚙️. Por isso parecia repetitivo: era repetitivo.
 *
 * Aqui o comando declara o que FAZ, não como se chama. A cobertura passa a ser
 * total por construção, e dois comandos só dividem emoji quando realmente fazem
 * a mesma coisa — que é quando dividir é correto.
 */
export type Intencao =
  | 'buscar'
  | 'baixar'
  | 'gerar'
  | 'converter'
  | 'enviar'
  | 'jogar'
  | 'consultar'
  | 'configurar'
  | 'moderar'
  | 'punir'
  | 'promover'
  | 'conversar'
  | 'calcular'
  | 'sortear'
  | 'perfilar'
  | 'ajudar'
  | 'brincar'
  | 'negociar'
  | 'progredir';

export const EMOJI_POR_INTENCAO: Readonly<Record<Intencao, string>> = Object.freeze({
  buscar: '🔍',
  baixar: '📥',
  gerar: '🎨',
  converter: '🔄',
  enviar: '📤',
  jogar: '🎲',
  consultar: '📊',
  configurar: '⚙️',
  moderar: '🧹',
  punir: '🚫',
  promover: '⭐',
  conversar: '💬',
  calcular: '🧮',
  sortear: '🍀',
  perfilar: '👤',
  ajudar: '📖',
  brincar: '😄',
  negociar: '💰',
  progredir: '⚔️',
});

/**
 * Quanto tempo, tipicamente, a intenção leva. Só o que é lento merece aviso de
 * espera: anunciar "processando" num comando de 200ms é ruído, e é parte do que
 * faz o bot soar robótico. Silêncio também é resposta humana.
 */
export const LENTA: ReadonlySet<Intencao> = new Set<Intencao>(['buscar', 'baixar', 'gerar', 'converter']);

export function emojiDaIntencao(intencao: Intencao): string {
  return EMOJI_POR_INTENCAO[intencao];
}

export function mereceAvisoDeEspera(intencao: Intencao): boolean {
  return LENTA.has(intencao);
}

/**
 * Verbo no gerúndio para compor o aviso de espera com o assunto real do pedido.
 * É a diferença entre "Nas sombras, já estou preparando tudo" — que serve para
 * qualquer coisa e portanto não informa nada — e "Procurando X".
 */
const GERUNDIO: Readonly<Record<Intencao, string>> = Object.freeze({
  buscar: 'Procurando',
  baixar: 'Baixando',
  gerar: 'Criando',
  converter: 'Convertendo',
  enviar: 'Enviando',
  jogar: 'Preparando',
  consultar: 'Consultando',
  configurar: 'Ajustando',
  moderar: 'Organizando',
  punir: 'Aplicando',
  promover: 'Promovendo',
  conversar: 'Pensando',
  calcular: 'Calculando',
  sortear: 'Sorteando',
  perfilar: 'Montando',
  ajudar: 'Reunindo',
  brincar: 'Preparando',
  negociar: 'Registrando',
  progredir: 'Resolvendo',
});

export function gerundioDaIntencao(intencao: Intencao): string {
  return GERUNDIO[intencao];
}
