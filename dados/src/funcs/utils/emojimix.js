/**
 * Mistura dois emojis usando o Emoji Kitchen do Google.
 *
 * A versão anterior falava com a API do Tenor usando uma chave escrita no
 * próprio arquivo. A chave foi revogada — todo pedido passou a voltar 403 e o
 * comando morreu — e, estando o código num repositório com espelho público,
 * era também um segredo exposto. As duas coisas eram o mesmo defeito.
 *
 * O Emoji Kitchen serve as imagens em URL pública, sem chave e sem conta:
 *   .../emojikitchen/<data>/<a>/<a>_<b>.png
 *
 * O preço é que a <data> não é dedutível do par: cada combinação foi publicada
 * numa leva e só existe naquela. Por isso as levas conhecidas são sondadas em
 * paralelo, e o que der certo entra em cache — assim o custo é pago uma vez por
 * par, não a cada chamada.
 */

/** Levas de publicação do Emoji Kitchen, da mais recente para a mais antiga. */
const LEVAS = Object.freeze([
  '20230821', '20230803', '20230426', '20230418', '20230301', '20230221',
  '20230127', '20221101', '20220823', '20220815', '20220506', '20220406',
  '20220203', '20220110', '20211115', '20210831', '20210521', '20210218',
  '20201001',
]);

const BASE = 'https://www.gstatic.com/android/keyboard/emojikitchen';
const TIMEOUT_MS = 8000;

class EmojiMixError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EmojiMixError';
  }
}

const cache = new Map();

/**
 * Devolve as notações possíveis do emoji em codepoints.
 *
 * O seletor de variação (FE0F) é o detalhe traiçoeiro aqui: o Emoji Kitchen
 * o preserva em uns e omite em outros — `u2764-ufe0f_u1f525` existe, mas
 * `u2764_u1f525` não. Como não há regra dedutível, as duas notações entram
 * como candidatas.
 */
function notacoes(emoji) {
  const pontos = [...String(emoji)].map((c) => c.codePointAt(0));
  if (pontos.length === 0) throw new EmojiMixError('Emoji inválido.');
  const hex = (lista) => lista.map((cp) => `u${cp.toString(16)}`).join('-');
  const semSeletor = pontos.filter((cp) => cp !== 0xfe0f);
  if (semSeletor.length === 0) throw new EmojiMixError('Emoji inválido.');
  const variantes = new Set([hex(pontos), hex(semSeletor)]);
  return [...variantes];
}

async function existe(url) {
  const resposta = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!resposta.ok) throw new EmojiMixError(`indisponível (${resposta.status})`);
  return url;
}

/**
 * Sonda todas as levas e todas as notações de uma vez, nas duas ordens.
 *
 * Em série seriam dezenas de idas ao servidor antes de desistir de um par que
 * não existe — tempo demais para um comando de conversa. Aqui o custo é o de
 * uma requisição só, e o par que existe vence a corrida.
 */
async function procurar(emoji1, emoji2) {
  const tentativas = [];
  for (const [x, y] of [[emoji1, emoji2], [emoji2, emoji1]]) {
    for (const a of notacoes(x)) {
      for (const b of notacoes(y)) {
        for (const leva of LEVAS) tentativas.push(existe(`${BASE}/${leva}/${a}/${a}_${b}.png`));
      }
    }
  }
  try {
    return await Promise.any(tentativas);
  } catch {
    return null;
  }
}

async function emojiMix(emoji1, emoji2) {
  const chave = `${notacoes(emoji1)[0]}_${notacoes(emoji2)[0]}`;
  if (cache.has(chave)) return cache.get(chave);

  const url = await procurar(emoji1, emoji2);
  if (!url) throw new EmojiMixError('Combinação de emojis não disponível.');

  cache.set(chave, url);
  return url;
}

export default emojiMix;
export { EmojiMixError };
