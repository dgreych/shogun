import { CONTENT_SCHEMA_VERSION, NEXO_MVP_CONTENT_VERSION } from '../contracts/enums.js';

// Impulsos e Cicatrizes abaixo preservam literalmente o conteúdo da seção 5.3
// da especificação. IDs e versões são metadados internos estáveis.
const impulses = [
  {
    id: 'break_impossible',
    version: 1,
    name: 'Romper o impossível',
    signature: ['FLAME', 'ROOT'],
    favoredAttributes: ['IMPACT', 'SUSTAIN'],
    fantasy: 'Vanguarda resistente, intensidade e proteção.'
  },
  {
    id: 'understand_hidden',
    version: 1,
    name: 'Entender o oculto',
    signature: ['VEIL', 'ECHO'],
    favoredAttributes: ['READING', 'CONNECTION'],
    fantasy: 'Investigador, estrategista e revelador de padrões.'
  },
  {
    id: 'keep_people_standing',
    version: 1,
    name: 'Manter pessoas de pé',
    signature: ['ROOT', 'ECHO'],
    favoredAttributes: ['SUSTAIN', 'CONNECTION'],
    fantasy: 'Guardião, curador e centro do grupo.'
  },
  {
    id: 'bend_rules',
    version: 1,
    name: 'Dobrar as regras',
    signature: ['VEIL', 'FLAME'],
    favoredAttributes: ['BEND', 'IMPACT'],
    fantasy: 'Improvisador, trapaceiro e catalisador de risco.'
  }
];

const scars = [
  {
    id: 'haste',
    version: 1,
    name: 'Pressa',
    riskRule: 'Primeira postura Ruptura do Ciclo gera +1 Tensão.',
    futureTransformation: 'Uma vez por Ciclo, agir antes da intenção inimiga.'
  },
  {
    id: 'strange_echo',
    version: 1,
    name: 'Eco estranho',
    riskRule: 'Ao falhar em análise, recebe uma pista falsa marcada.',
    futureTransformation: 'Pode converter uma pista falsa em atalho verdadeiro.'
  },
  {
    id: 'others_weight',
    version: 1,
    name: 'Peso dos outros',
    riskRule: 'Ao aliado cair, recebe 1 Tensão.',
    futureTransformation: 'Ao salvar aliado, remove Tensão de todos.'
  },
  {
    id: 'answer_hunger',
    version: 1,
    name: 'Fome de resposta',
    riskRule: 'Abandonar investigação custa Memória de combo.',
    futureTransformation: 'Descobertas completas geram Vestígio raro.'
  }
];

// A especificação fixa oito Origens para o beta e mostra archive_runaway no
// CharacterSeed, mas não enumera as outras sete. Esta fatia MVP materializa
// as oito sem bônus permanente: cada uma oferece apenas +1 situacional.
const origins = [
  {
    id: 'archive_runaway',
    version: 1,
    name: 'Fugitivo do Arquivo',
    description: 'Você escapou de registros que pareciam conhecer seu nome antes de você chegar.',
    modifier: { attribute: 'READING', value: 1, condition: 'Ao interpretar arquivos, registros ou inscrições da Ruptura.' }
  },
  {
    id: 'line_cartographer',
    version: 1,
    name: 'Cartógrafo de Linhas',
    description: 'Você aprendeu a reconhecer caminhos que só existem quando ninguém olha direto para eles.',
    modifier: { attribute: 'READING', value: 1, condition: 'Ao descobrir uma conexão, rota ou local ainda não visitado pelo Círculo.' }
  },
  {
    id: 'refuge_keeper',
    version: 1,
    name: 'Guardião do Refúgio',
    description: 'Você já segurou uma porta tempo suficiente para que outras pessoas atravessassem.',
    modifier: { attribute: 'SUSTAIN', value: 1, condition: 'Ao defender o Refúgio, um Projeto ou um aliado durante uma ameaça.' }
  },
  {
    id: 'inverted_market_runner',
    version: 1,
    name: 'Corredor do Mercado Invertido',
    description: 'Você conhece o preço das coisas que ainda não foram vendidas e o custo de chegar atrasado.',
    modifier: { attribute: 'CONNECTION', value: 1, condition: 'Ao negociar, trocar informação ou obter ajuda de um NPC comerciante.' }
  },
  {
    id: 'dead_line_survivor',
    version: 1,
    name: 'Sobrevivente da Linha Morta',
    description: 'Você voltou de uma plataforma onde o relógio parou, mas o perigo continuou andando.',
    modifier: { attribute: 'SUSTAIN', value: 1, condition: 'No primeiro teste após entrar em uma região de Ruptura ou ambiente hostil.' }
  },
  {
    id: 'well_listener',
    version: 1,
    name: 'Ouvinte do Poço',
    description: 'Você aprendeu que algumas vozes não querem resposta; querem testemunha.',
    modifier: { attribute: 'CONNECTION', value: 1, condition: 'Ao apoiar uma pessoa diferente depois que ela falhar ou sofrer consequência.' }
  },
  {
    id: 'lantern_courier',
    version: 1,
    name: 'Mensageiro das Lanternas',
    description: 'Você atravessou fronteiras levando avisos que precisavam chegar antes da crise.',
    modifier: { attribute: 'BEND', value: 1, condition: 'Ao reposicionar, retirar ou improvisar uma rota sob prazo ou perseguição.' }
  },
  {
    id: 'broken_sun_heir',
    version: 1,
    name: 'Herdeiro do Sol Partido',
    description: 'Você carrega uma lembrança impossível de uma luz que se quebrou sem apagar.',
    modifier: { attribute: 'IMPACT', value: 1, condition: 'Ao romper uma Âncora, obstáculo ou defesa estrutural ligada à Ruptura.' }
  }
];

// O PDF define 48 técnicas para o beta, 16 para a Fase 1/MVP e fornece quatro
// exemplos canônicos, um por tom. As quatro definições canônicas abaixo
// preservam esses nomes/efeitos; as doze restantes completam a fatia MVP sem
// alterar os combos fundamentais, que continuam responsabilidade do motor.
const techniques = [
  {
    id: 'solar_strike',
    version: 1,
    name: 'Golpe Solar',
    tone: 'FLAME',
    category: 'OFFENSE',
    attribute: 'IMPACT',
    focusCost: 1,
    baseEffect: { damage: 6, resonance: 8 },
    range: 'ENEMY',
    allowedStances: ['CAUTION', 'PULSE', 'RUPTURE'],
    tags: ['CHAIN_STARTER', 'ENTROPY_ON_RUPTURE'],
    cooldownRounds: 0,
    unlock: { path: 'flame', rank: 1 },
    description: 'Dano alto; em Ruptura, +Entropia. Inicia Chama.'
  },
  {
    id: 'threshold_break',
    version: 1,
    name: 'Quebra do Limiar',
    tone: 'FLAME',
    category: 'CONTROL',
    attribute: 'IMPACT',
    focusCost: 2,
    baseEffect: { damage: 4, guardDelta: -2, resonance: 8 },
    range: 'ENEMY',
    allowedStances: ['PULSE', 'RUPTURE'],
    tags: ['PRESSURE', 'BREAK_GUARD'],
    cooldownRounds: 1,
    unlock: { path: 'flame', rank: 1 },
    description: 'Força uma abertura na defesa e transforma pressão em espaço para a próxima ação.'
  },
  {
    id: 'ash_rush',
    version: 1,
    name: 'Avanço de Cinza',
    tone: 'FLAME',
    category: 'UTILITY',
    attribute: 'BEND',
    focusCost: 1,
    baseEffect: { mobility: 3, resonance: 7 },
    range: 'SELF',
    allowedStances: ['PULSE', 'RUPTURE'],
    tags: ['MOBILITY', 'POSITION'],
    cooldownRounds: 1,
    unlock: { path: 'flame', rank: 2 },
    description: 'Avança apesar do risco, reposicionando o personagem antes que a pressão feche a rota.'
  },
  {
    id: 'borrowed_spark',
    version: 1,
    name: 'Faísca Emprestada',
    tone: 'FLAME',
    category: 'SUPPORT',
    attribute: 'CONNECTION',
    focusCost: 1,
    baseEffect: { resonance: 14, tensionDelta: 1 },
    range: 'ALLY',
    allowedStances: ['PULSE', 'RUPTURE'],
    tags: ['AMPLIFY', 'RISK'],
    cooldownRounds: 1,
    unlock: { path: 'flame', rank: 2 },
    description: 'Empurra um aliado para a próxima janela de ação, ampliando Ressonância ao custo de Tensão.'
  },
  {
    id: 'veil_mark',
    version: 1,
    name: 'Marca Velada',
    tone: 'VEIL',
    category: 'CONTROL',
    attribute: 'READING',
    focusCost: 1,
    baseEffect: { guardDelta: -2, analysis: 1, resonance: 8 },
    range: 'ENEMY',
    allowedStances: ['CAUTION', 'PULSE', 'RUPTURE'],
    tags: ['CHAIN_STARTER', 'REVEAL_RESISTANCE'],
    cooldownRounds: 0,
    unlock: { path: 'veil', rank: 1 },
    description: 'Reduz Guarda ou revela resistência; inicia Véu.'
  },
  {
    id: 'step_between_voices',
    version: 1,
    name: 'Passo Entre Vozes',
    tone: 'VEIL',
    category: 'UTILITY',
    attribute: 'BEND',
    focusCost: 1,
    baseEffect: { mobility: 3, analysis: 1 },
    range: 'SELF',
    allowedStances: ['CAUTION', 'PULSE'],
    tags: ['MOBILITY', 'EVADE'],
    cooldownRounds: 1,
    unlock: { path: 'veil', rank: 2 },
    description: 'Move o personagem por uma abertura difícil de perceber e melhora a leitura do próximo risco.'
  },
  {
    id: 'interval_snare',
    version: 1,
    name: 'Laço de Intervalo',
    tone: 'VEIL',
    category: 'CONTROL',
    attribute: 'READING',
    focusCost: 2,
    baseEffect: { intentReduction: 2, resonance: 9 },
    range: 'ENEMY',
    allowedStances: ['CAUTION', 'PULSE'],
    tags: ['TRAP', 'INTENT_CONTROL'],
    cooldownRounds: 1,
    unlock: { path: 'veil', rank: 2 },
    description: 'Prende a próxima Intenção em uma janela estreita, reduzindo sua força se o grupo reagir a tempo.'
  },
  {
    id: 'noise_eye',
    version: 1,
    name: 'Olho no Ruído',
    tone: 'VEIL',
    category: 'UTILITY',
    attribute: 'READING',
    focusCost: 1,
    baseEffect: { analysis: 3, resonance: 6 },
    range: 'ENEMY',
    allowedStances: ['CAUTION', 'PULSE'],
    tags: ['ANALYZE', 'FRACTURE'],
    cooldownRounds: 0,
    unlock: { path: 'veil', rank: 1 },
    description: 'Separa sinal de distração e aumenta a chance de revelar uma Fratura ou pista útil.'
  },
  {
    id: 'fix_ground',
    version: 1,
    name: 'Fixar o Chão',
    tone: 'ROOT',
    category: 'DEFENSE',
    attribute: 'SUSTAIN',
    focusCost: 1,
    baseEffect: { shield: 3, resonance: 8 },
    range: 'GROUP',
    allowedStances: ['CAUTION', 'PULSE'],
    tags: ['CHAIN_STARTER', 'PREVENT_DISPLACEMENT'],
    cooldownRounds: 1,
    unlock: { path: 'root', rank: 1 },
    description: 'Escudo coletivo pequeno e impede deslocamento.'
  },
  {
    id: 'shared_bark',
    version: 1,
    name: 'Casca Compartilhada',
    tone: 'ROOT',
    category: 'SUPPORT',
    attribute: 'SUSTAIN',
    focusCost: 1,
    baseEffect: { shield: 4, resonance: 7 },
    range: 'ALLY',
    allowedStances: ['CAUTION', 'PULSE'],
    tags: ['ALLY', 'SHIELD'],
    cooldownRounds: 1,
    unlock: { path: 'root', rank: 1 },
    description: 'Concentra proteção em um aliado sem retirar valor da ação dele na cadeia.'
  },
  {
    id: 'refuge_anchor',
    version: 1,
    name: 'Âncora do Refúgio',
    tone: 'ROOT',
    category: 'DEFENSE',
    attribute: 'SUSTAIN',
    focusCost: 2,
    baseEffect: { shield: 5, intentReduction: 1 },
    range: 'GROUP',
    allowedStances: ['CAUTION', 'PULSE'],
    tags: ['GROUP', 'INTENT_CONTROL'],
    cooldownRounds: 2,
    unlock: { path: 'root', rank: 2 },
    description: 'Ergue uma defesa coletiva que amortece a próxima Intenção telegráfica.'
  },
  {
    id: 'stone_patience',
    version: 1,
    name: 'Paciência de Pedra',
    tone: 'ROOT',
    category: 'UTILITY',
    attribute: 'SUSTAIN',
    focusCost: 0,
    baseEffect: { tensionDelta: -1, shield: 1 },
    range: 'SELF',
    allowedStances: ['CAUTION'],
    tags: ['RECOVERY', 'TENSION'],
    cooldownRounds: 1,
    unlock: { path: 'root', rank: 2 },
    description: 'Aceita perder impulso para baixar Tensão e preparar uma posição mais segura.'
  },
  {
    id: 'echo_thread',
    version: 1,
    name: 'Fio de Retorno',
    tone: 'ECHO',
    category: 'SUPPORT',
    attribute: 'CONNECTION',
    focusCost: 1,
    baseEffect: { shield: 3, resonance: 12 },
    range: 'ALLY',
    allowedStances: ['CAUTION', 'PULSE', 'RUPTURE'],
    tags: ['ALLY', 'CHAIN_STARTER'],
    cooldownRounds: 1,
    unlock: { path: 'echo', rank: 1 },
    description: 'Escudo em aliado e amplia próxima Ressonância.'
  },
  {
    id: 'borrowed_memory',
    version: 1,
    name: 'Memória Emprestada',
    tone: 'ECHO',
    category: 'UTILITY',
    attribute: 'CONNECTION',
    focusCost: 1,
    baseEffect: { analysis: 2, resonance: 10 },
    range: 'ALLY',
    allowedStances: ['CAUTION', 'PULSE'],
    tags: ['MEMORY', 'ANALYZE'],
    cooldownRounds: 1,
    unlock: { path: 'echo', rank: 1 },
    description: 'Recupera uma observação de outro participante para reforçar análise ou continuidade da cadeia.'
  },
  {
    id: 'return_bell',
    version: 1,
    name: 'Sino de Retorno',
    tone: 'ECHO',
    category: 'SUPPORT',
    attribute: 'CONNECTION',
    focusCost: 2,
    baseEffect: { heal: 3, resonance: 10 },
    range: 'ALLY',
    allowedStances: ['CAUTION', 'PULSE'],
    tags: ['HEAL', 'ALLY'],
    cooldownRounds: 1,
    unlock: { path: 'echo', rank: 2 },
    description: 'Chama um aliado de volta ao ritmo do grupo, restaurando Vitalidade e mantendo a cadeia viva.'
  },
  {
    id: 'watch_link',
    version: 1,
    name: 'Laço de Vigília',
    tone: 'ECHO',
    category: 'SUPPORT',
    attribute: 'CONNECTION',
    focusCost: 1,
    baseEffect: { shield: 2, tensionDelta: -1, resonance: 9 },
    range: 'ALLY',
    allowedStances: ['CAUTION', 'PULSE'],
    tags: ['ALLY', 'TENSION', 'AMPLIFY'],
    cooldownRounds: 1,
    unlock: { path: 'echo', rank: 2 },
    description: 'Mantém um aliado sob cuidado, reduzindo Tensão enquanto prepara a próxima contribuição coletiva.'
  }
];

const tutorial = {
  id: 'door_in_noise',
  version: 1,
  name: 'A Porta no Ruído',
  durationHours: 24,
  startTrigger: 'FIRST_PLAYER_JOINED',
  stages: [
    {
      id: 'first_choice',
      kind: 'CHOICE',
      title: 'A porta responde',
      prompt: 'O ruído abre quatro respostas possíveis. Escolha como o Círculo vai se aproximar antes que a passagem mude.',
      requiresDistinctPlayers: false,
      recommendedTechniqueIds: []
    },
    {
      id: 'read_the_noise',
      kind: 'ANALYSIS',
      title: 'Leia o que não foi dito',
      prompt: 'Uma intenção aparece por trás do ruído. Analise a ameaça para revelar uma pista antes de agir.',
      requiresDistinctPlayers: false,
      recommendedTechniqueIds: ['veil_mark']
    },
    {
      id: 'answer_the_door',
      kind: 'ACTION',
      title: 'Responda à Ruptura',
      prompt: 'A porta assume uma forma hostil. Use uma técnica compatível com sua Signatura e veja como postura e efeito mudam a resposta.',
      requiresDistinctPlayers: false,
      recommendedTechniqueIds: ['solar_strike', 'veil_mark', 'fix_ground', 'echo_thread']
    },
    {
      id: 'first_resonance',
      kind: 'RESONANCE',
      title: 'Duas vozes, um efeito',
      prompt: 'Combine tons de pessoas diferentes. A Ressonância só existe quando ações distintas se encontram na mesma janela.',
      requiresDistinctPlayers: true,
      recommendedTechniqueIds: ['solar_strike', 'veil_mark', 'fix_ground', 'echo_thread']
    }
  ],
  canDestroyCircle: false,
  collectiveRewardOnce: true,
  lateJoinReplay: 'INDIVIDUAL_NO_DUPLICATE_COLLECTIVE_REWARD',
  outcomeVariation: 'REWARD_AND_RUMOR_ONLY',
  rewardVariants: ['Vestígios de Eco', 'Cacos da primeira passagem'],
  rumorVariants: ['A estação apareceu antes do horário.', 'Alguém do outro lado já conhecia o nome do Círculo.']
};

export const RAW_NEXO_MVP_CONTENT = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  contentVersion: NEXO_MVP_CONTENT_VERSION,
  impulses,
  scars,
  origins,
  techniques,
  tutorial
};
