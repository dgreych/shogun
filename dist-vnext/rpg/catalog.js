/**
 * Catálogo do contexto RPG.
 *
 * Escolhido como primeira nativização por medição, não por intuição: é a maior
 * remoção COERENTE disponível do monólito — 4086 linhas, 12% do index.js,
 * concentradas num contexto fechado, com estado e progressão próprios.
 *
 * O ADR de cutover exige bounded context completo, não blocos escolhidos por
 * tamanho. Por isso entra o RPG inteiro e não apenas o `perfilrpg`, que sozinho
 * tem 1646 linhas e é o maior bloco isolado do arquivo.
 *
 * Risco baixo perto de moderation e admin: nenhum comando aqui concede
 * permissão nem executa ação destrutiva de grupo.
 *
 * Inventário levantado da superfície real: 39 famílias / 284 tokens.
 */
function descriptor(input) {
    return Object.freeze({ ...input, tokens: Object.freeze([...input.tokens]) });
}
export const RPG_COMMAND_DESCRIPTORS = Object.freeze([
    descriptor({
        id: 'perfilrpg',
        kind: 'economia',
        // 1646 linhas no index.js, a partir da 6135
        tokens: ['perfilrpg', 'carteira', 'banco', 'depositar', 'dep', 'sacar', 'saque', 'transferir', 'pix', 'loja', 'lojarps', 'comprar', 'buy', 'inventario', 'inv', 'apostar', 'bet', 'slots', 'minerar', 'mine', 'trabalhar', 'work', 'emprego', 'vagas', 'demitir', 'pescar', 'fish', 'explorar', 'explore', 'cacar', 'caçar', 'hunt', 'mercado', 'listar', 'comprarmercado', 'cmerc', 'meusanuncios', 'meusan', 'cancelar', 'propriedades', 'comprarpropriedade', 'cprop', 'coletarpropriedades', 'cprops', 'habilidades', 'desafiosemanal', 'desafiomensal', 'materiais', 'precos', 'preços', 'vender', 'reparar', 'desafio', 'forjar', 'forge', 'crime', 'assaltar', 'roubar', 'cozinhar', 'cook', 'receitas', 'plantar', 'cultivar', 'plant', 'farm', 'colher', 'coletar', 'harvest', 'plantacao', 'plantação', 'horta', 'comer', 'eat', 'vendercomida', 'ingredientes', 'sementes', 'toprpg', 'ranklevel', 'ranklvl', 'rankinglevel', 'levels', 'toplevels', 'diario', 'daily', 'resetrpg'],
    }),
    descriptor({
        id: 'duelarrpg',
        kind: 'combate',
        // 239 linhas no index.js, a partir da 9207
        tokens: ['duelarrpg', 'duelorpg'],
    }),
    descriptor({
        id: 'batalhapet',
        kind: 'pets',
        // 219 linhas no index.js, a partir da 8428
        tokens: ['batalhapet'],
    }),
    descriptor({
        id: 'dungeon',
        kind: 'combate',
        // 209 linhas no index.js, a partir da 9799
        tokens: ['dungeon', 'masmorra'],
    }),
    descriptor({
        id: 'masmorrasolo',
        kind: 'combate',
        // 130 linhas no index.js, a partir da 8930
        tokens: ['masmorrasolo', 'dungeonsolo'],
    }),
    descriptor({
        id: 'evoluirpet',
        kind: 'pets',
        // 121 linhas no index.js, a partir da 8265
        tokens: ['evoluirpet'],
    }),
    descriptor({
        id: 'torneio',
        kind: 'combate',
        // 119 linhas no index.js, a partir da 10853
        tokens: ['torneio'],
    }),
    descriptor({
        id: 'leilao',
        kind: 'comercio',
        // 103 linhas no index.js, a partir da 11872
        tokens: ['leilao', 'leilaorpg'],
    }),
    descriptor({
        id: 'pets',
        kind: 'pets',
        // 101 linhas no index.js, a partir da 7955
        tokens: ['pets'],
    }),
    descriptor({
        id: 'cheferpg',
        kind: 'combate',
        // 86 linhas no index.js, a partir da 9061
        tokens: ['cheferpg', 'bossrpg'],
    }),
    descriptor({
        id: 'encantar',
        kind: 'producao',
        // 78 linhas no index.js, a partir da 9447
        tokens: ['encantar'],
    }),
    descriptor({
        id: 'missoes',
        kind: 'missoes',
        // 76 linhas no index.js, a partir da 10159
        tokens: ['missoes', 'quests'],
    }),
    descriptor({
        id: 'equippet',
        kind: 'pets',
        // 72 linhas no index.js, a partir da 8715
        tokens: ['equippet'],
    }),
    descriptor({
        id: 'apostarpet',
        kind: 'pets',
        // 68 linhas no index.js, a partir da 8647
        tokens: ['apostarpet'],
    }),
    descriptor({
        id: 'diagnosticrpg',
        kind: 'nucleo',
        // 66 linhas no index.js, a partir da 24600
        tokens: ['diagnosticrpg', 'repairdb'],
    }),
    descriptor({
        id: 'equipar',
        kind: 'personagem',
        // 63 linhas no index.js, a partir da 8817
        tokens: ['equipar'],
    }),
    descriptor({
        id: 'classe',
        kind: 'cla',
        // 60 linhas no index.js, a partir da 9592
        tokens: ['classe', 'class'],
    }),
    descriptor({
        id: 'solicitacoes',
        kind: 'nucleo',
        // 59 linhas no index.js, a partir da 25862
        tokens: ['solicitacoes', 'pendentes', 'requests'],
    }),
    descriptor({
        id: 'desequipar',
        kind: 'personagem',
        // 50 linhas no index.js, a partir da 8880
        tokens: ['desequipar'],
    }),
    descriptor({
        id: 'rpgstats',
        kind: 'nucleo',
        // 49 linhas no index.js, a partir da 11360
        tokens: ['rpgstats', 'rpgstatistics'],
    }),
    descriptor({
        id: 'rankglobal',
        kind: 'nucleo',
        // 46 linhas no index.js, a partir da 11165
        tokens: ['rankglobal', 'globalrank', 'toprpgglobal'],
    }),
    descriptor({
        id: 'renomearpet',
        kind: 'pets',
        // 42 linhas no index.js, a partir da 8386
        tokens: ['renomearpet'],
    }),
    descriptor({
        id: 'cla',
        kind: 'cla',
        // 42 linhas no index.js, a partir da 10306
        tokens: ['cla'],
    }),
    descriptor({
        id: 'gay',
        kind: 'nucleo',
        // 38 linhas no index.js, a partir da 31156
        tokens: ['gay', 'burro', 'inteligente', 'otaku', 'fiel', 'infiel', 'corno', 'gado', 'gostoso', 'feio', 'rico', 'pobre', 'pirocudo', 'pirokudo', 'ladrao', 'safado', 'vesgo', 'bebado', 'machista', 'homofobico', 'racista', 'chato', 'sortudo', 'azarado', 'forte', 'fraco', 'pegador', 'otario', 'macho', 'bobo', 'nerd', 'preguicoso', 'trabalhador', 'brabo', 'lindo', 'malandro', 'simpatico', 'engracado', 'charmoso', 'misterioso', 'carinhoso', 'desumilde', 'humilde', 'ciumento', 'corajoso', 'covarde', 'esperto', 'talarico', 'chorao', 'brincalhao', 'bolsonarista', 'petista', 'comunista', 'lulista', 'traidor', 'bandido', 'cachorro', 'vagabundo', 'pilantra', 'mito', 'padrao', 'comedia', 'psicopata', 'fortao', 'magrelo', 'bombado', 'chefe', 'presidente', 'rei', 'patrao', 'playboy', 'zueiro', 'gamer', 'programador', 'visionario', 'billionario', 'poderoso', 'vencedor', 'senhor', 'fofoqueiro', 'dorminhoco', 'comilao', 'sedentario', 'atleta', 'estudioso', 'romantico', 'extrovertido', 'introvertido', 'calmo', 'nervoso', 'organizado', 'bagunceiro', 'economico', 'gastador', 'saudavel', 'doente', 'supersticioso', 'cetico', 'religioso', 'ateu', 'tradicional', 'moderno', 'conservador', 'liberal', 'patriotico', 'cosmopolita', 'rural', 'urbano', 'aventureiro', 'caseiro', 'viajante', 'local', 'global', 'tecnologico', 'analogico', 'digital', 'offline', 'online', 'social', 'antisocial', 'popular', 'solitario', 'lider', 'seguidor', 'independente', 'dependente', 'criativo', 'pratico', 'sonhador', 'realista', 'otimista', 'pessimista', 'confiante', 'inseguro', 'maduro', 'infantil', 'serio', 'sortudo2', 'zueira', 'viaja nte', 'responsavel', 'irresponsavel'],
    }),
    descriptor({
        id: 'captchasolic',
        kind: 'nucleo',
        // 36 linhas no index.js, a partir da 26115
        tokens: ['captchasolic', 'captcha', 'captcharequests'],
    }),
    descriptor({
        id: 'unequippet',
        kind: 'pets',
        // 30 linhas no index.js, a partir da 8787
        tokens: ['unequippet'],
    }),
    descriptor({
        id: 'rpgadditem',
        kind: 'nucleo',
        // 23 linhas no index.js, a partir da 11278
        tokens: ['rpgadditem'],
    }),
    descriptor({
        id: 'rpgremoveitem',
        kind: 'nucleo',
        // 23 linhas no index.js, a partir da 11301
        tokens: ['rpgremoveitem'],
    }),
    descriptor({
        id: 'rpgremove',
        kind: 'nucleo',
        // 21 linhas no index.js, a partir da 11234
        tokens: ['rpgremove', 'rpgremovemoney'],
    }),
    descriptor({
        id: 'rpgsetlevel',
        kind: 'nucleo',
        // 21 linhas no index.js, a partir da 11256
        tokens: ['rpgsetlevel', 'setlevel'],
    }),
    descriptor({
        id: 'abracarrpg',
        kind: 'nucleo',
        // 20 linhas no index.js, a partir da 10972
        tokens: ['abracarrpg'],
    }),
    descriptor({
        id: 'beijarrpg',
        kind: 'nucleo',
        // 20 linhas no index.js, a partir da 10992
        tokens: ['beijarrpg'],
    }),
    descriptor({
        id: 'baterrpg',
        kind: 'nucleo',
        // 20 linhas no index.js, a partir da 11012
        tokens: ['baterrpg', 'taparpg'],
    }),
    descriptor({
        id: 'rpgadd',
        kind: 'nucleo',
        // 20 linhas no index.js, a partir da 11213
        tokens: ['rpgadd', 'rpgaddmoney'],
    }),
    descriptor({
        id: 'rpgresetplayer',
        kind: 'nucleo',
        // 19 linhas no index.js, a partir da 11324
        tokens: ['rpgresetplayer'],
    }),
    descriptor({
        id: 'rpgresetglobal',
        kind: 'nucleo',
        // 17 linhas no index.js, a partir da 11343
        tokens: ['rpgresetglobal'],
    }),
    descriptor({
        id: 'modorpg',
        kind: 'nucleo',
        // 14 linhas no index.js, a partir da 6121
        tokens: ['modorpg'],
    }),
    descriptor({
        id: 'menurpg',
        kind: 'nucleo',
        // 11 linhas no index.js, a partir da 6011
        tokens: ['menurpg'],
    }),
    descriptor({
        id: 'inventario',
        kind: 'personagem',
        // 9 linhas no index.js, a partir da 29324
        tokens: ['inventario', 'inventory'],
    }),
]);
export const RPG_COMMAND_TOKENS = Object.freeze(RPG_COMMAND_DESCRIPTORS.flatMap((d) => [...d.tokens]));
export const RPG_FAMILY_COUNT = RPG_COMMAND_DESCRIPTORS.length;
export const RPG_TOKEN_COUNT = RPG_COMMAND_TOKENS.length;
/** Linhas que a nativização remove do index.js quando concluída. */
export const RPG_LEGACY_LINES = 4086;
export function findRpgCommandDescriptor(token) {
    const alvo = String(token || '').trim().toLowerCase();
    return RPG_COMMAND_DESCRIPTORS.find((d) => d.tokens.includes(alvo)) ?? null;
}
//# sourceMappingURL=catalog.js.map