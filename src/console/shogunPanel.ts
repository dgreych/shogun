/**
 * Painel de conexao do bot, com o Shogun em pixel art.
 *
 * Reproduz a referencia escolhida pelo dono: samurai sentado em silhueta contra
 * uma lua vermelha enorme, sobre uma colina de grama rubra.
 *
 * Por que ESSA referencia e nao a outra: circulo chapado, silhueta preta e
 * chifres dourados sobrevivem a baixa resolucao. A alternativa tinha gradiente
 * suave, galhos finos e centenas de papoulas -- detalhe que vira borrao quando
 * cada pixel custa meio caractere.
 *
 * Renderiza com meio-bloco: cada caractere carrega DOIS pixels verticais, o de
 * cima na cor de frente e o de baixo na de fundo. Dobra a resolucao vertical
 * sem gastar mais linhas de terminal.
 */

import { larguraVisual, textoSeguroParaTerminal } from './feed.js';

type RGB = readonly [number, number, number];

const PALETA: Readonly<Record<string, RGB | null>> = {
  '.': null,            // fundo
  'd': [70, 6, 10],     // penumbra da lua
  'R': [206, 20, 26],   // lua
  'K': [10, 10, 13],    // silhueta
  'A': [42, 46, 55],    // volume na armadura
  'B': [22, 40, 58],    // aco azulado em sombra
  'b': [52, 88, 116],   // aresta fria das placas
  'e': [134, 18, 24],   // reflexo rubro distante
  'G': [222, 176, 84],  // ouro dos chifres
  'g': [172, 128, 48],  // ouro em sombra
  'S': [72, 82, 94],    // katana em aco escuro
  'T': [38, 43, 51],    // corpo da katana
  'h': [96, 10, 16],    // grama em sombra
  'H': [188, 24, 30],   // grama iluminada
  'm': [48, 7, 11],     // terra profunda
};

/**
 * Sprite derivado visualmente da referencia: cabeca baixa a esquerda, dorso e
 * ombreira altos a direita, bracos cruzando o colo e dois joelhos separados.
 * Os agrupamentos azuis acompanham volumes reais da armadura, nao ruido.
 */
const SAMURAI = [
  '...............G............G.................',
  '..............G.............G.................',
  '..............G............gG.................',
  '...............G..........gG..................',
  '................G........gG...................',
  '.................G......gG....................',
  '..................gGKbBBKKK.....................',
  '.................gGKKKKKKKBBK...................',
  '.................KbeKKKBBBBBBK..................',
  '................KgKKKKBBBBBBBBK.................',
  '.................KgKKKBBKKBBBBK.................',
  '..................KKAKKBBKKBBBBBBK..............',
  '....................KKBKKKK...KKKBBB............',
  '.....................KKKBBBBKBBBBBBBB........',
  '...................BKBBgBBBBBBBBBBBBB........',
  '..................KKKKgKKKKKBBBBBBBBB........',
  '.................KKKKKKBKKBBBBKBBBBBBB.......',
  '.................BKKBKBBBBBBKBBBBBKKKB.......',
  '................KBKBBBBBBBKKKBbKKKKBKB.......',
  '................KBKBBBKKBBKKKBBKKKKBKK.......',
  '................BKKKBKKKBKKKKKBBBBBBK........',
  '...............BKKKKKBBKKKBBKBBBBKKKK........',
  '.............KBBKKKKKKBKKKBBBBBBKKKKK........',
  '.............KABBKKK...KBBBBKBBBKKKKB.........',
  '.....KK....KKABBKK....BBBKKKKKKKKKB..........',
  '.........KKKKBKKK..KBBBKKKKKBBKKKKK.........',
  '..........BBKKKK.KBBKKKKKKKKKBBKKKBB........',
  '........bBKBKKKKBBBKKKKKKBBBKKKKKK...........',
  '......BBBKKKKKKKKKKKKBBBBBBBBKKK.............',
  '....KKKBBBBKKKKKKKKKKBBBKKKBB................',
  '.....BBKKBKKKKKKKBKKKK.......................',
  '....KBKBBKKKKKKKBKBBK........................',
  '.....KKBBKKKK................................',
  '.....KKKKKK..................................',
];

const LARGURA = 64;
const ALTURA = 50;
const SAMURAI_X = 9;
const SAMURAI_Y = 8;

function montarSamurai(): string[][] {
  const sprite = SAMURAI.map((linha) => [...linha]);
  const faixa = (y: number, inicio: number, fim: number, pixel: string): void => {
    const linha = sprite[y];
    if (!linha) return;
    for (let x = Math.max(0, inicio); x <= Math.min(linha.length - 1, fim); x += 1) linha[x] = pixel;
  };
  const ponto = (x: number, y: number, pixel: string): void => faixa(y, x, x, pixel);

  const linha = (x0: number, y0: number, x1: number, y1: number, pixel: string): void => {
    let x = x0;
    let y = y0;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const passoX = x0 < x1 ? 1 : -1;
    const passoY = y0 < y1 ? 1 : -1;
    let erro = dx - dy;

    while (true) {
      ponto(x, y, pixel);
      if (x === x1 && y === y1) break;
      const dobro = erro * 2;
      if (dobro > -dy) { erro -= dy; x += passoX; }
      if (dobro < dx) { erro += dx; y += passoY; }
    }
  };

  // Os antebracos convergem para duas luvas separadas. A katana repousa mais
  // baixa, sobre o colo, e passa ENTRE as maos em vez de atravessar o torso.
  linha(17, 18, 23, 25, 'B');
  linha(18, 18, 24, 25, 'A');
  ponto(18, 18, 'b'); ponto(23, 24, 'b');
  linha(38, 18, 30, 26, 'B');
  linha(39, 18, 31, 26, 'A');
  ponto(38, 18, 'b'); ponto(31, 25, 'b');

  // Cabo curto e escuro com cinco voltas discretas, tsuba vertical e bainha
  // quase toda absorvida pelo colo. Nenhuma linha cruza o torso de lado a lado.
  linha(5, 26, 22, 27, 'T');
  ponto(6, 26, 'S'); ponto(10, 26, 'S'); ponto(14, 27, 'S');
  ponto(8, 26, 'g'); ponto(12, 26, 'g'); ponto(16, 27, 'g'); ponto(20, 27, 'g');
  ponto(23, 25, 'g'); ponto(23, 26, 'G'); ponto(23, 27, 'g');
  linha(24, 27, 37, 28, 'B');
  linha(24, 28, 37, 29, 'K');

  // Luva frontal fechada no cabo e luva traseira apoiando a bainha.
  faixa(23, 19, 21, 'b');
  faixa(24, 18, 22, 'B');
  faixa(25, 19, 22, 'A');
  faixa(26, 19, 22, 'A');
  faixa(27, 20, 22, 'K');
  ponto(19, 25, 'b'); ponto(22, 26, 'b');
  faixa(24, 26, 28, 'b');
  faixa(25, 25, 29, 'B');
  faixa(26, 25, 29, 'A');
  faixa(27, 25, 28, 'A');
  faixa(28, 26, 28, 'K');
  ponto(25, 26, 'b'); ponto(28, 27, 'b');
  ponto(41, 16, 'e');

  return sprite;
}

function montarQuadro(): string[][] {
  const tela: string[][] = Array.from({ length: ALTURA }, () => Array.from({ length: LARGURA }, () => '.'));

  // Lua cheia com aro escuro: grande o bastante para enquadrar a silhueta.
  const cx = LARGURA / 2 - 0.5;
  const cy = 23;
  const raio = 22;
  for (let y = 0; y < ALTURA; y += 1) {
    for (let x = 0; x < LARGURA; x += 1) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > raio) continue;
      // Chapada de proposito, como na referencia: so um aro escuro na borda e
      // o resto vermelho solido. Faixa clara grande no meio lava o contraste
      // e a silhueta do samurai deixa de recortar.
      tela[y]![x] = dist > raio - 1.4 ? 'd' : 'R';
    }
  }

  // Samurai por cima da lua.
  const samurai = montarSamurai();
  for (let sy = 0; sy < samurai.length; sy += 1) {
    const linha = samurai[sy]!;
    for (let sx = 0; sx < linha.length; sx += 1) {
      const p = linha[sx]!;
      if (p === '.') continue;
      const y = SAMURAI_Y + sy;
      const x = SAMURAI_X + sx;
      if (y < 0 || y >= ALTURA || x < 0 || x >= LARGURA) continue;
      tela[y]![x] = p;
    }
  }

  // A referencia sobe para a direita, em vez de formar um pedestal simetrico.
  // O volume continua curto para o rodape respirar, mas a silhueta diagonal e
  // os tufos em duas alturas fazem a faixa ler como grama em primeiro plano.
  const topos = Array.from({ length: LARGURA }, (_, x) => {
    const t = x / (LARGURA - 1);
    return Math.round(
      ALTURA - 5 - t * 3.6 - Math.sin(t * Math.PI) * 2.6 - Math.sin(t * Math.PI * 3) * 0.55,
    );
  });
  for (let x = 0; x < LARGURA; x += 1) {
    if (x < 3 || x > LARGURA - 4) continue;
    const t = x / (LARGURA - 1);
    const topo = topos[x]!;
    const borda = Math.min(1, (x - 3) / 6, (LARGURA - 4 - x) / 6);
    const profundidade = 1 + Math.round(borda + t * 2 + Math.sin(t * Math.PI));
    for (let y = topo; y <= Math.min(ALTURA - 1, topo + profundidade); y += 1) {
      if (y === topo) tela[y]![x] = x % 5 === 0 ? 'h' : 'H';
      else if (y === topo + 1) tela[y]![x] = (x * 7) % 11 === 0 ? 'H' : 'h';
      else if (y === topo + profundidade && (x * 3 + y) % 5 !== 0) continue;
      else tela[y]![x] = (x + y) % 7 === 0 ? 'h' : 'm';
    }

    if ((x % 9 === 2 || x % 13 === 7) && topo > 0) tela[topo - 1]![x] = 'H';
    if (x % 17 === 5 && topo > 1) {
      tela[topo - 1]![x] = 'H';
      if (x + 1 < LARGURA) tela[topo - 2]![x + 1] = 'h';
    }
    // Uma lamina inclinada por tufo evita o aspecto de dentes verticais.
    if (x % 19 === 11 && x + 1 < LARGURA && topo > 0) {
      tela[topo - 1]![x] = 'h';
      tela[Math.max(0, topos[x + 1]! - 1)]![x + 1] = 'H';
    }
  }

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

const OURO = ESC + '[38;2;222;176;84m';
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
  const tituloRenderizado = renderTitulo(titulo, [222, 176, 84]);

  const centraliza = (texto: string): string => {
    const ajustado = limitarColunas(texto, LARGURA);
    const sobra = Math.max(0, LARGURA - larguraVisual(ajustado));
    const esq = Math.floor(sobra / 2);
    return ' '.repeat(esq) + ajustado + ' '.repeat(sobra - esq);
  };

  const corEstado = /conectad|online|pronto|ativo/i.test(estado)
    ? SUCESSO
    : /erro|falh|desconect|expir/i.test(estado) ? BRASA : OURO;

  // A informação vem depois da arte e nunca dentro dela: o usuário precisa
  // achar estado e instrução sem caçar entre pixels. Régua separando os dois.
  const partes = [
    '',
    ...arte,
    '',
    ...(tituloRenderizado.length > 0
      ? tituloRenderizado
      : [OURO + centraliza(titulo.toUpperCase()) + RESET]),
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
