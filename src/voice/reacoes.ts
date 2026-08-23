/**
 * Escolha da reação de cada comando.
 *
 * O mapa por intenção resolveu metade do problema e criou a outra: são 19
 * intenções para mais de 500 famílias, então tudo que é "brincar" recebe o
 * mesmo 😄 e tudo que é "configurar" recebe o mesmo ⚙️. Continua parecendo
 * automático, que é justamente o que se quer evitar.
 *
 * Aqui o emoji vem do ASSUNTO do comando, reconhecido por radicais no nome, e
 * cada assunto tem várias reações possíveis. Qual delas sai é decidido pelo
 * próprio nome do comando: `play` e `playvid` são o mesmo assunto e recebem
 * reações diferentes, mas `play` recebe sempre a mesma. Previsível para quem
 * usa, variado no grupo.
 */

/** Radicais que identificam o assunto, e as reações que combinam com ele. */
const TEMAS: ReadonlyArray<readonly [readonly string[], readonly string[]]> = Object.freeze([
  // A ordem decide: o primeiro tema que reconhece o nome vence. Assunto
  // específico vem antes do genérico, senão `banco` cai em banimento por
  // conter "ban" e `playvid` cai em música por conter "play".
  [['tiktok', 'ttk', 'tkk', 'kwai'], ['📱', '🕺', '🎪']],
  [['instagram', 'insta', 'igdl', 'reels'], ['📸', '🌇', '💠']],
  [['facebook', 'fbdl'], ['📘', '🔵', '🗞️']],
  [['pinterest', 'pin'], ['📌', '🧷', '🖇️']],
  [['twitter', 'tweet', 'twdl'], ['🐦', '💬', '🔗']],

  [['banco', 'bank', 'dinheiro', 'money', 'coin', 'pix', 'transf', 'carteira',
    'pag', 'compr', 'vend', 'loja', 'shop', 'mercad', 'saldo', 'deposit', 'sac'],
   ['💰', '🪙', '💳', '🏦', '💸']],

  [['jogodavelha', 'velha', 'forca', 'quiz', 'roleta', 'caca', 'palavra',
    'jogo', 'game', 'tavern', 'duelo', 'partida'],
   ['🎲', '🕹️', '🃏', '🎯', '🎪']],

  [['video', 'mp4', 'vid', 'filme', 'movie', 'cine', 'clip', 'shorts'],
   ['🎬', '🎥', '📹', '🍿']],
  [['musica', 'music', 'song', 'audio', 'mp3', 'som', 'play', 'letra', 'lyric'],
   ['🎵', '🎧', '🎼', '🎶', '📻']],

  [['figurinha', 'sticker', 'stik', 'fig', 'emojimix', 'emoji'],
   ['🩹', '✨', '🧩', '🪄']],
  [['gif', 'anima', 'motion'], ['🌀', '💫', '🎞️']],
  [['foto', 'image', 'imagem', 'img', 'pic', 'wall', 'papel', 'desenh', 'draw', 'art'],
   ['🖼️', '🎨', '📸', '🖌️']],

  [['rpg', 'level', 'xp', 'skill', 'habilid', 'forj', 'miner', 'pesc',
    'plant', 'colh', 'receit', 'ingredient', 'propriedad', 'emprego', 'trabalh'],
   ['⚔️', '🛡️', '🗡️', '⛏️', '🌾', '🏹']],

  [['banir', 'ban', 'kick', 'remov', 'expuls', 'block', 'bloq'], ['🚪', '⛔', '🔨']],
  [['mut', 'silenc', 'calar'], ['🤐', '🔇', '🤫']],
  [['adv', 'warn', 'punir', 'castig'], ['⚠️', '📛', '🪧']],
  [['admin', 'promov', 'rebaix', 'dono', 'owner', 'moder'], ['👑', '🎖️', '🗝️']],
  [['grupo', 'group', 'membro', 'member', 'marca', 'tag', 'todos'], ['👥', '📣', '🫂']],
  [['limp', 'clean', 'apag', 'delet'], ['🧹', '🗑️', '🫧']],

  [['rank', 'top', 'placar', 'lider'], ['🏆', '🥇', '📈']],
  [['perfil', 'profile', 'user', 'usuario'], ['🪪', '👤', '🎭']],
  [['transcri', 'voz', 'tts', 'fala', 'speak'], ['🗣️', '🎙️', '💬']],
  [['ia', 'gpt', 'chat', 'pergunt', 'resum', 'traduz', 'translate'], ['🧠', '💭', '🗯️']],
  [['tempo', 'clima', 'weather', 'hora', 'data', 'agenda', 'lembr'], ['🌤️', '⏰', '📅']],
  [['busca', 'search', 'pesquis', 'procur'], ['🔍', '🧭', '🔦']],
  [['down', 'baix', 'dl'], ['📥', '⬇️', '📦']],
  [['config', 'set', 'ativ', 'desativ', 'liga', 'desliga', 'modo', 'prefix'],
   ['🎚️', '🔧', '🧰', '🎛️']],
  [['menu', 'ajuda', 'help', 'comando'], ['📜', '🗂️', '📖']],
  [['texto', 'ttp', 'fonte', 'escrev'], ['✍️', '🔤', '🖋️']],
  [['sort', 'random', 'dado', 'aleat', 'escolh'], ['🍀', '🎰', '🎯']],
  [['amor', 'ship', 'casa', 'namor', 'beij'], ['💘', '💞', '🌹']],
  [['status', 'ping', 'info', 'sobre', 'versao', 'uptime'], ['📊', '🏓', 'ℹ️']],
]);

/** Reações de último caso, quando nenhum tema reconhece o comando. */
const NEUTRAS: readonly string[] = Object.freeze(['⚡', '🌑', '🔹', '◾', '🀄']);

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Índice estável a partir do nome, para o mesmo comando sair sempre igual.
 * Um sorteio faria a reação mudar a cada chamada, e reação que pisca é pior
 * que reação repetida.
 */
function indiceEstavel(nome: string, tamanho: number): number {
  let soma = 0;
  for (let i = 0; i < nome.length; i += 1) soma = (soma * 31 + nome.charCodeAt(i)) % 100000;
  return soma % tamanho;
}

/** Tema do comando, ou null quando nenhum radical reconhece. */
export function temaDoComando(comando: string): readonly string[] | null {
  const nome = semAcento(String(comando || ''));
  if (!nome) return null;
  for (const [radicais, reacoes] of TEMAS) {
    if (radicais.some((r) => nome.includes(r))) return reacoes;
  }
  return null;
}

/**
 * Reação do comando. Vazio devolve neutro em vez de lançar: reação é enfeite,
 * e enfeite não derruba comando.
 */
export function reacaoDoComando(comando: string): string {
  const nome = semAcento(String(comando || ''));
  if (!nome) return NEUTRAS[0]!;
  const tema = temaDoComando(nome) ?? NEUTRAS;
  return tema[indiceEstavel(nome, tema.length)]!;
}

/** Quantas reações distintas o catálogo consegue produzir. */
export function reacoesDistintas(): number {
  return new Set([...TEMAS.flatMap(([, r]) => r), ...NEUTRAS]).size;
}
