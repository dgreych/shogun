export type FunCommandKind =
  | 'profile-male'
  | 'profile-female'
  | 'rank-male'
  | 'rank-female'
  | 'interaction';

export interface FunCommandDescriptor {
  readonly id: string;
  readonly kind: FunCommandKind;
  readonly tokens: readonly string[];
}

function descriptor(input: FunCommandDescriptor): FunCommandDescriptor {
  return Object.freeze({ ...input, tokens: Object.freeze([...input.tokens]) });
}

/**
 * Primeira tranche funcional ampla do strangler.
 *
 * Estes cinco descritores correspondem a cinco famílias completas e contíguas
 * do switch(command) legado. São comandos de brincadeira/apresentação que
 * compartilham o mesmo comportamento e não atravessam BunnyFy, IA, NEXO ou a
 * economia persistente. Manter as famílias inteiras evita ownership parcial.
 */
export const FUN_COMMAND_DESCRIPTORS = Object.freeze([
  descriptor({
    id: 'profile-male',
    kind: 'profile-male',
    tokens: [
      'gay', 'burro', 'inteligente', 'otaku', 'fiel', 'infiel', 'corno', 'gado',
      'gostoso', 'feio', 'rico', 'pobre', 'pirocudo', 'pirokudo', 'ladrao', 'safado',
      'vesgo', 'bebado', 'machista', 'homofobico', 'racista', 'chato', 'sortudo',
      'azarado', 'forte', 'fraco', 'pegador', 'otario', 'macho', 'bobo', 'nerd',
      'preguicoso', 'trabalhador', 'brabo', 'lindo', 'malandro', 'simpatico',
      'engracado', 'charmoso', 'misterioso', 'carinhoso', 'desumilde', 'humilde',
      'ciumento', 'corajoso', 'covarde', 'esperto', 'talarico', 'chorao', 'brincalhao',
      'bolsonarista', 'petista', 'comunista', 'lulista', 'traidor', 'bandido',
      'cachorro', 'vagabundo', 'pilantra', 'mito', 'padrao', 'comedia', 'psicopata',
      'fortao', 'magrelo', 'bombado', 'chefe', 'presidente', 'rei', 'patrao', 'playboy',
      'zueiro', 'gamer', 'programador', 'visionario', 'billionario', 'poderoso',
      'vencedor', 'senhor', 'fofoqueiro', 'dorminhoco', 'comilao', 'sedentario',
      'atleta', 'estudioso', 'romantico', 'extrovertido', 'introvertido', 'calmo',
      'nervoso', 'organizado', 'bagunceiro', 'economico', 'gastador', 'saudavel',
      'doente', 'supersticioso', 'cetico', 'religioso', 'ateu', 'tradicional', 'moderno',
      'conservador', 'liberal', 'patriotico', 'cosmopolita', 'rural', 'urbano',
      'aventureiro', 'caseiro', 'viajante', 'local', 'global', 'tecnologico', 'analogico',
      'digital', 'offline', 'online', 'social', 'antisocial', 'popular', 'solitario',
      'lider', 'seguidor', 'independente', 'dependente', 'criativo', 'pratico', 'sonhador',
      'realista', 'otimista', 'pessimista', 'confiante', 'inseguro', 'maduro', 'infantil',
      'serio', 'sortudo2', 'zueira', 'viaja nte', 'responsavel', 'irresponsavel',
    ],
  }),
  descriptor({
    id: 'profile-female',
    kind: 'profile-female',
    tokens: [
      'lesbica', 'burra', 'corna', 'gostosa', 'feia', 'rica', 'bucetuda', 'ladra',
      'safada', 'vesga', 'bebada', 'homofobica', 'chata', 'sortuda', 'azarada', 'fraca',
      'pegadora', 'otaria', 'boba', 'preguicosa', 'trabalhadora', 'braba', 'linda',
      'malandra', 'simpatica', 'engracada', 'charmosa', 'misteriosa', 'carinhosa',
      'ciumenta', 'corajosa', 'esperta', 'talarica', 'chorona', 'brincalhona', 'traidora',
      'bandida', 'cachorra', 'vagabunda', 'fortona', 'magrela', 'bombada', 'presidenta',
      'rainha', 'patroa', 'programadora', 'visionaria', 'bilionaria', 'poderosa',
      'vencedora', 'senhora', 'fofoqueira', 'dorminhoca', 'comilona', 'sedentaria',
      'estudiosa', 'romantica', 'extrovertida', 'introvertida', 'calma', 'nervosa',
      'organizada', 'bagunceira', 'economica', 'gastadora', 'supersticiosa', 'cetica',
      'religiosa', 'ateia', 'moderna', 'conservadora', 'patriotica', 'urbana',
      'aventureira', 'caseira', 'tecnologica', 'analogica', 'solitaria', 'seguidora',
      'criativa', 'pratica', 'sonhadora', 'insegura', 'madura', 'seria',
    ],
  }),
  descriptor({
    id: 'rank-male',
    kind: 'rank-male',
    tokens: [
      'rankgay', 'rankburro', 'rankinteligente', 'rankotaku', 'rankfiel', 'rankinfiel',
      'rankcorno', 'rankgado', 'rankgostoso', 'rankrico', 'rankpobre', 'rankforte',
      'rankpegador', 'rankmacho', 'ranknerd', 'ranktrabalhador', 'rankbrabo', 'ranklindo',
      'rankmalandro', 'rankengracado', 'rankcharmoso', 'rankvisionario', 'rankpoderoso',
      'rankvencedor', 'rankgays', 'rankburros', 'rankinteligentes', 'rankotakus',
      'rankfiels', 'rankinfieis', 'rankcornos', 'rankgados', 'rankgostosos', 'rankricos',
      'rankpobres', 'rankfortes', 'rankpegadores', 'rankmachos', 'ranknerds',
      'ranktrabalhadores', 'rankbrabos', 'ranklindos', 'rankmalandros', 'rankengracados',
      'rankcharmosos', 'rankvisionarios', 'rankpoderosos', 'rankvencedores',
    ],
  }),
  descriptor({
    id: 'rank-female',
    kind: 'rank-female',
    tokens: [
      'ranklesbica', 'rankburra', 'rankcorna', 'rankgada', 'rankgostosa', 'rankrica',
      'rankpegadora', 'ranktrabalhadora', 'rankbraba', 'ranklinda', 'rankmalandra',
      'rankengracada', 'rankcharmosa', 'rankvisionaria', 'rankpoderosa', 'rankvencedora',
      'ranklesbicas', 'rankburras', 'rankcornas', 'rankgads', 'rankgostosas', 'rankricas',
      'rankpegadoras', 'ranktrabalhadoras', 'rankbrabas', 'ranklindas', 'rankmalandras',
      'rankengracadas', 'rankcharmosas', 'rankvisionarias', 'rankpoderosas', 'rankvencedoras',
    ],
  }),
  descriptor({
    id: 'interaction',
    kind: 'interaction',
    tokens: [
      'chute', 'chutar', 'tapa', 'soco', 'socar', 'beijo', 'beijar', 'beijob', 'beijarb',
      'abraco', 'abracar', 'mata', 'matar', 'tapar', 'goza', 'gozar', 'mamar', 'mamada',
      'cafune', 'morder', 'mordida', 'lamber', 'lambida', 'explodir', 'sexo', 'tomate',
    ],
  }),
] satisfies readonly FunCommandDescriptor[]);

export const FUN_COMMAND_TOKENS = Object.freeze(
  FUN_COMMAND_DESCRIPTORS.flatMap((item) => item.tokens),
);

const byToken = new Map<string, FunCommandDescriptor>();
for (const item of FUN_COMMAND_DESCRIPTORS) {
  for (const token of item.tokens) {
    if (byToken.has(token)) throw new Error(`Token duplicado no domínio de brincadeiras: ${token}`);
    byToken.set(token, item);
  }
}

export function findFunCommandDescriptor(command: string): FunCommandDescriptor | undefined {
  return byToken.get(String(command || '').trim().toLowerCase());
}
