/** Painel de conexão: o gato do Shogun em preto e vermelho. */
import { larguraVisual, textoSeguroParaTerminal } from './feed.js';
type RGB = readonly [number, number, number];
const PALETA: Readonly<Record<string, RGB | null>> = {
  '.': null, d: [70, 6, 10], R: [206, 20, 26], K: [10, 10, 13],
  A: [24, 24, 28], H: [48, 45, 48], E: [255, 42, 50],
};
const LARGURA = 64;
const ALTURA = 50;
function montarQuadro(): string[][] {
  const tela = Array.from({ length: ALTURA }, () => Array.from({ length: LARGURA }, () => '.'));
  const ellipse = (cx: number, cy: number, rx: number, ry: number, pixel: string): void => {
    for (let y = 0; y < ALTURA; y++) for (let x = 0; x < LARGURA; x++) {
      if (((x-cx)/rx)**2 + ((y-cy)/ry)**2 <= 1) tela[y]![x] = pixel;
    }
  };
  ellipse(31.5, 24, 22, 22, 'd');
  ellipse(31.5, 24, 20.5, 20.5, 'R');
  ellipse(32, 39, 12, 15, 'K');
  ellipse(32, 26, 16, 12, 'K');
  // Orelhas pontudas; sem elas o bichano vira uma bolinha.
  for (let y=7; y<=23; y++) {
    const width = (y-7)*0.5;
    for(let x=18; x<=18+width; x++) tela[y]![x] = 'K';
    for(let x=46-width; x<=46; x++) tela[y]![Math.round(x)] = 'K';
  }
  ellipse(32, 38, 8, 10, 'A');
  ellipse(23, 47, 6, 3, 'K');
  ellipse(41, 47, 6, 3, 'K');
  // Olhar de quem já sabe qual comando você vai errar.
  for(let x=22; x<=28; x++) { const y=24+Math.floor((x-22)/3); tela[y]![x]='E'; }
  for(let x=36; x<=42; x++) { const y=26-Math.floor((x-36)/3); tela[y]![x]='E'; }
  tela[30]![31]='H'; tela[30]![32]='H'; tela[31]![32]='H';
  for(let x=12; x<=21; x++) { tela[30]![x]='H'; tela[32]![x]='H'; }
  for(let x=43; x<=52; x++) { tela[30]![x]='H'; tela[32]![x]='H'; }
  return tela;
}

const ESC = '\u001b';
const RESET = ESC + '[0m';

function pinta(cima: RGB | null, baixo: RGB | null): string {
  if (!cima && !baixo) return ' ';
  if (cima && baixo) {
    return ESC + '[38;2;' + cima[0] + ';' + cima[1] + ';' + cima[2] + 'm'
      + ESC + '[48;2;' + baixo[0] + ';' + baixo[1] + ';' + baixo[2] + 'm' + '\u2580' + RESET;
  }
  if (cima) return ESC + '[38;2;' + cima[0] + ';' + cima[1] + ';' + cima[2] + 'm' + '\u2580' + RESET;
  return ESC + '[38;2;' + baixo![0] + ';' + baixo![1] + ';' + baixo![2] + 'm' + '\u2584' + RESET;
}

/** Desenha o Shogun. Duas linhas de pixel por linha de texto. */
export function renderShogun(): string[] {
  const tela = montarQuadro();
  const linhas: string[] = [];
  for (let y = 0; y < ALTURA; y += 2) {
    let linha = '';
    for (let x = 0; x < LARGURA; x += 1) {
      linha += pinta(PALETA[tela[y]![x]!] ?? null, PALETA[tela[y + 1]?.[x] ?? '.'] ?? null);
    }
    linhas.push(linha);
  }
  return linhas;
}

/**
 * Fonte de bloco 5x7 para o nome do bot.
 *
 * Texto pequeno some ao lado de uma arte grande, e o nome é a primeira coisa
 * que precisa ser lida. Renderizar por bitmap dá tipografia com o mesmo grão da
 * ilustração, em vez de misturar pixel art com fonte do terminal.
 */
const FONTE: Readonly<Record<string, readonly string[]>> = {
  '-': ['.....', '.....', '.....', '.####', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['#..#.', '#..#.', '#..#.', '#####', '...#.', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#...#', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '#...#', '.###.'],
  'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  'G': ['.###.', '#...#', '#....', '#..##', '#...#', '#...#', '.###.'],
  'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'I': ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  'J': ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  'N': ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  'S': ['.###.', '#...#', '#....', '.###.', '....#', '#...#', '.###.'],
  'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

/** Desenha a palavra em blocos, com meia-altura para caber em poucas linhas. */
function renderTitulo(texto: string, cor: RGB): string[] {
  const normalizado = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const letras = [...normalizado];
  if (letras.length === 0 || letras.some((c) => !FONTE[c])) return [];
  // Cada letra ocupa 6 colunas. Nome que não cabe sairia cortado ao meio, o
  // que é pior que texto pequeno: melhor degradar para uma linha legível.
  if (letras.length * 6 > LARGURA) return [];
  const grade: string[] = [];
  for (let linha = 0; linha < 7; linha += 1) {
    grade.push(letras.map((c) => FONTE[c]![linha]!).join('.'));
  }
  const largura = grade[0]!.length;
  const esq = Math.max(0, Math.floor((LARGURA - largura) / 2));

  const saida: string[] = [];
  for (let y = 0; y < 8; y += 2) {
    let linha = ' '.repeat(esq);
    for (let x = 0; x < largura; x += 1) {
      const cima = grade[y]?.[x] === '#';
      const baixo = grade[y + 1]?.[x] === '#';
      linha += pinta(cima ? cor : null, baixo ? cor : null);
    }
    saida.push(linha);
  }
  return saida;
}

const DESTAQUE = ESC + '[38;2;206;20;26m';
const BRASA = ESC + '[38;2;206;20;26m';
const CINZA = ESC + '[38;2;138;143;158m';
const SUCESSO = ESC + '[38;2;104;170;126m';

function limitarColunas(texto: string, limite: number): string {
  const seguro = textoSeguroParaTerminal(texto);
  if (larguraVisual(seguro) <= limite) return seguro;
  let saida = '';
  let usado = 0;
  for (const ch of seguro) {
    const largura = larguraVisual(ch);
    if (usado + largura > limite - 1) break;
    saida += ch;
    usado += largura;
  }
  return saida + '\u2026';
}

/**
 * Painel de conexao. O QR e impresso pelo chamador: misturar arte com geracao
 * de QR acoplaria desenho a protocolo.
 */
export function renderConnectionPanel(opcoes: {
  readonly titulo?: string;
  readonly estado: string;
  readonly detalhe?: string;
} = { estado: 'aguardando' }): string {
  const titulo = textoSeguroParaTerminal(opcoes.titulo ?? 'SHOGUN') || 'SHOGUN';
  const estado = limitarColunas(opcoes.estado, LARGURA);
  const detalhe = opcoes.detalhe ? limitarColunas(opcoes.detalhe, LARGURA) : '';
  const arte = renderShogun();
  const tituloRenderizado = renderTitulo(titulo, [206, 20, 26]);

  const centraliza = (texto: string): string => {
    const ajustado = limitarColunas(texto, LARGURA);
    const sobra = Math.max(0, LARGURA - larguraVisual(ajustado));
    const esq = Math.floor(sobra / 2);
    return ' '.repeat(esq) + ajustado + ' '.repeat(sobra - esq);
  };

  const corEstado = /conectad|online|pronto|ativo/i.test(estado)
    ? SUCESSO
    : /erro|falh|desconect|expir/i.test(estado) ? BRASA : DESTAQUE;

  // A informação vem depois da arte e nunca dentro dela: o usuário precisa
  // achar estado e instrução sem caçar entre pixels. Régua separando os dois.
  const partes = [
    '',
    ...arte,
    '',
    ...(tituloRenderizado.length > 0
      ? tituloRenderizado
      : [DESTAQUE + centraliza(titulo.toUpperCase()) + RESET]),
    '',
    CINZA + centraliza('\u2500'.repeat(Math.min(LARGURA - 4, 44))) + RESET,
    '',
    corEstado + centraliza(estado.toUpperCase()) + RESET,
  ];
  if (detalhe) {
    partes.push('');
    partes.push(CINZA + centraliza(detalhe) + RESET);
  }
  partes.push('');
  return partes.join('\n');
}
