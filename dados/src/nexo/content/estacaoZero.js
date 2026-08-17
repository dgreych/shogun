import {
  ESTACAO_ZERO_CONTENT_VERSION,
  ESTACAO_ZERO_SCHEMA_VERSION
} from '../contracts/estacaoZeroContracts.js';

const map = {
  id: 'estacao_zero_map',
  version: 1,
  name: 'Estação Zero',
  description: 'Uma estação abandonada reaparece fora do horário do mundo. Três plataformas apontam para lugares que ainda não aconteceram.',
  locations: [
    {
      id: 'refugio',
      version: 1,
      name: 'Refúgio',
      description: 'Uma antiga sala de manutenção transformada pelo Círculo em ponto seguro para reorganizar pistas e proteger quem retorna.'
    },
    {
      id: 'plataforma_sem_relogio',
      version: 1,
      name: 'Plataforma sem Relógio',
      description: 'Os painéis mostram destinos, mas nenhum horário. Cada trilho parece chegar alguns minutos antes da própria estação.'
    },
    {
      id: 'plataforma_do_vidro',
      version: 1,
      name: 'Plataforma do Vidro',
      description: 'As janelas refletem passageiros que não estão presentes e deixam pistas diferentes quando observadas em conjunto.'
    },
    {
      id: 'plataforma_da_linha_morta',
      version: 1,
      name: 'Plataforma da Linha Morta',
      description: 'Um trilho termina numa escuridão imóvel. O Cartógrafo afirma que a linha continua, mas apenas enquanto alguém lembra dela.'
    },
    {
      id: 'mercado_invertido',
      version: 1,
      name: 'Mercado Invertido',
      description: 'Barracas trocam objetos por promessas, mapas e lembranças. O preço muda quando uma verdade sobre a Estação é descoberta.'
    }
  ]
};

const enemies = [
  {
    id: 'cao_de_rasura',
    version: 1,
    name: 'Cão de Rasura',
    hpBase: 20,
    guarda: 1,
    atributoPrincipal: 'IMPACT',
    intentLabels: [
      'Rasgar a barreira mais frágil',
      'Forçar o grupo a recuar',
      'Abrir espaço para a Ruptura'
    ]
  },
  {
    id: 'espectro_da_catraca',
    version: 1,
    name: 'Espectro da Catraca',
    hpBase: 18,
    guarda: 1,
    atributoPrincipal: 'BEND',
    intentLabels: [
      'Trancar a passagem recém-aberta',
      'Separar duas rotas da plataforma',
      'Cobrar uma saída que não existe'
    ]
  },
  {
    id: 'carcaca_de_trilho',
    version: 1,
    name: 'Carcaça de Trilho',
    hpBase: 28,
    guarda: 3,
    atributoPrincipal: 'SUSTAIN',
    intentLabels: [
      'Fixar o caminho sob ferrugem',
      'Empurrar a linha contra o Refúgio',
      'Fechar a rota com o próprio corpo'
    ]
  },
  {
    id: 'fiscal_cego',
    version: 1,
    name: 'Fiscal Cego',
    hpBase: 22,
    guarda: 2,
    atributoPrincipal: 'READING',
    intentLabels: [
      'Marcar a pista mais evidente como falsa',
      'Confiscar um caminho já confirmado',
      'Transformar certeza em suspeita'
    ]
  },
  {
    id: 'cobrador_de_eco',
    version: 1,
    name: 'Cobrador de Eco',
    hpBase: 24,
    guarda: 2,
    atributoPrincipal: 'CONNECTION',
    intentLabels: [
      'Romper o vínculo mais recente',
      'Cobrar uma memória prometida',
      'Isolar uma voz do restante do Círculo'
    ]
  },
  {
    id: 'agulha_invertida',
    version: 1,
    name: 'Agulha Invertida',
    hpBase: 26,
    guarda: 2,
    atributoPrincipal: 'BEND',
    intentLabels: [
      'Desviar a rota para um destino impossível',
      'Costurar duas saídas incompatíveis',
      'Virar a plataforma contra a própria passagem'
    ]
  }
];

const boss = {
  id: 'vigia_sem_rosto',
  version: 1,
  name: 'Vigia Sem Rosto',
  hpBase: 120,
  guarda: 3,
  atributoPrincipal: 'BEND',
  intentLabels: [
    'Apagar a trilha aberta nesta rodada',
    'Separar duas rotas do Círculo',
    'Reescrever a passagem mais instável',
    'Fechar a linha antes que ela seja compreendida'
  ],
  fraturas: [
    {
      id: 'sombras_eco_chama',
      hint: 'Sombras perdem força após Eco -> Chama.'
    },
    {
      id: 'troca_de_alvo',
      hint: 'Ele não reconhece quem troca de alvo.'
    },
    {
      id: 'destino_nomeado',
      hint: 'Quando precisa nomear um destino, a Guarda do Vigia vacila.'
    }
  ],
  ancora: 'O sino de partida mantém o Vigia ligado à linha temporal que ele protege.'
};

const missions = [
  {
    id: 'vozes_sob_a_ponte',
    version: 1,
    name: 'Vozes sob a Ponte',
    type: 'INVESTIGATION',
    description: 'Ruídos vindos do Refúgio repetem frases que ainda não foram ditas. O Círculo precisa separar aviso, armadilha e memória.',
    locationIds: ['refugio', 'plataforma_do_vidro'],
    enemyIds: ['fiscal_cego'],
    startNodeId: 'escolher_pista',
    nodes: [
      {
        id: 'escolher_pista',
        type: 'CHOICE',
        prompt: 'Duas pistas contraditórias surgem ao mesmo tempo. Qual delas o Círculo segue primeiro?',
        options: [
          { id: 'ouvir_refugio', label: 'Ouvir a repetição no Refúgio', next: 'ler_repeticao' },
          { id: 'seguir_reflexo', label: 'Seguir o reflexo até a plataforma', next: 'ler_reflexo' }
        ],
        timeout: { minutes: 20, defaultOption: 'ouvir_refugio' }
      },
      {
        id: 'ler_repeticao',
        type: 'TEST',
        prompt: 'A voz repete uma frase com uma palavra deslocada. Descubra o padrão antes que o Fiscal Cego o marque como falso.',
        options: [{
          id: 'analisar_voz',
          label: 'Analisar a sequência das palavras',
          test: {
            attribute: 'READING',
            difficulty: 9,
            nextByOutcome: { SETBACK: null, TENSE: null, FULL: null, RUPTURE: null }
          }
        }]
      },
      {
        id: 'ler_reflexo',
        type: 'TEST',
        prompt: 'O vidro mostra um passageiro ausente apontando para duas direções. Encontre qual gesto pertence ao presente.',
        options: [{
          id: 'comparar_reflexos',
          label: 'Comparar os reflexos em vez de seguir um só',
          test: {
            attribute: 'CONNECTION',
            difficulty: 9,
            nextByOutcome: { SETBACK: null, TENSE: null, FULL: null, RUPTURE: null }
          }
        }]
      }
    ]
  },
  {
    id: 'linhas_que_nao_existem',
    version: 1,
    name: 'Linhas que não Existem',
    type: 'EXPEDITION',
    description: 'As três plataformas do Ato I abrem rotas incompatíveis. O Círculo precisa provar que uma linha existe sem perder a volta.',
    locationIds: ['plataforma_sem_relogio', 'plataforma_do_vidro', 'plataforma_da_linha_morta'],
    enemyIds: ['carcaca_de_trilho', 'agulha_invertida'],
    startNodeId: 'escolher_linha',
    nodes: [
      {
        id: 'escolher_linha',
        type: 'CHOICE',
        prompt: 'Uma linha promete caminho curto; outra preserva marcas suficientes para uma retirada segura.',
        options: [
          { id: 'rota_curta', label: 'Entrar pela linha curta e instável', next: 'dobrar_trilho' },
          { id: 'rota_marcada', label: 'Seguir a linha longa e marcar o retorno', next: 'sustentar_retorno' }
        ]
      },
      {
        id: 'dobrar_trilho',
        type: 'TEST',
        prompt: 'A Agulha Invertida costura o trilho a um destino errado. Desfaça a mudança antes que a rota se feche.',
        options: [{
          id: 'improvisar_desvio',
          label: 'Dobrar a regra da linha sem perder o destino',
          test: {
            attribute: 'BEND',
            difficulty: 11,
            nextByOutcome: { SETBACK: null, TENSE: null, FULL: null, RUPTURE: null }
          }
        }]
      },
      {
        id: 'sustentar_retorno',
        type: 'TEST',
        prompt: 'A Carcaça de Trilho pesa sobre a rota marcada. Mantenha o caminho aberto até o último sinal atravessar.',
        options: [{
          id: 'segurar_linha',
          label: 'Sustentar a linha de retorno',
          test: {
            attribute: 'SUSTAIN',
            difficulty: 10,
            nextByOutcome: { SETBACK: null, TENSE: null, FULL: null, RUPTURE: null }
          }
        }]
      }
    ]
  },
  {
    id: 'cerco_do_cartografo',
    version: 1,
    name: 'Cerco do Cartógrafo',
    type: 'DEFENSE',
    description: 'O Cartógrafo fica preso entre duas plataformas enquanto criaturas tentam apagar o mapa que ele carregou até a Estação.',
    locationIds: ['plataforma_da_linha_morta', 'refugio'],
    enemyIds: ['cao_de_rasura', 'espectro_da_catraca'],
    startNodeId: 'definir_prioridade',
    nodes: [
      {
        id: 'definir_prioridade',
        type: 'CHOICE',
        prompt: 'O Círculo não consegue proteger o mapa e a passagem com a mesma força. O que recebe prioridade?',
        options: [
          { id: 'proteger_mapa', label: 'Formar defesa ao redor do mapa', next: 'conter_rasura' },
          { id: 'proteger_saida', label: 'Manter aberta a retirada do Cartógrafo', next: 'segurar_catraca' }
        ],
        timeout: { minutes: 15, defaultOption: 'proteger_saida' }
      },
      {
        id: 'conter_rasura',
        type: 'TEST',
        prompt: 'O Cão de Rasura avança sobre as bordas do mapa. Impeça que uma rota inteira desapareça.',
        options: [{
          id: 'romper_avanco',
          label: 'Romper o avanço antes que alcance o mapa',
          test: {
            attribute: 'IMPACT',
            difficulty: 10,
            nextByOutcome: { SETBACK: null, TENSE: null, FULL: null, RUPTURE: null }
          }
        }]
      },
      {
        id: 'segurar_catraca',
        type: 'TEST',
        prompt: 'O Espectro da Catraca tenta declarar a saída inválida. Mantenha a passagem reconhecida pelo Círculo.',
        options: [{
          id: 'firmar_passagem',
          label: 'Firmar a passagem como rota válida',
          test: {
            attribute: 'SUSTAIN',
            difficulty: 9,
            nextByOutcome: { SETBACK: null, TENSE: null, FULL: null, RUPTURE: null }
          }
        }]
      }
    ]
  },
  {
    id: 'preco_do_mercado_invertido',
    version: 1,
    name: 'O Preço do Mercado Invertido',
    type: 'DIPLOMACY',
    description: 'Mercadores oferecem uma rota segura em troca de uma promessa impossível de verificar. O Círculo precisa negociar sem entregar o próprio futuro.',
    locationIds: ['mercado_invertido'],
    enemyIds: ['cobrador_de_eco'],
    startNodeId: 'escolher_moeda',
    nodes: [
      {
        id: 'escolher_moeda',
        type: 'CHOICE',
        prompt: 'O Mercado aceita uma verdade difícil ou uma promessa útil. As duas escolhas têm testemunhas.',
        options: [
          { id: 'oferecer_verdade', label: 'Oferecer uma verdade verificável sobre a Estação', next: 'negociar_verdade' },
          { id: 'oferecer_promessa', label: 'Oferecer uma promessa limitada ao próximo Ciclo', next: 'negociar_promessa' }
        ]
      },
      {
        id: 'negociar_verdade',
        type: 'TEST',
        prompt: 'O Cobrador de Eco tenta transformar a verdade em dívida. Preserve o sentido original diante das testemunhas.',
        options: [{
          id: 'firmar_versao',
          label: 'Firmar uma versão que todos possam repetir',
          test: {
            attribute: 'CONNECTION',
            difficulty: 10,
            nextByOutcome: { SETBACK: null, TENSE: null, FULL: null, RUPTURE: null }
          }
        }]
      },
      {
        id: 'negociar_promessa',
        type: 'TEST',
        prompt: 'A promessa começa a ganhar cláusulas que ninguém disse. Limite o acordo antes que ele se torne outra coisa.',
        options: [{
          id: 'dobrar_clausula',
          label: 'Redefinir a cláusula sem romper o pacto',
          test: {
            attribute: 'BEND',
            difficulty: 11,
            nextByOutcome: { SETBACK: null, TENSE: null, FULL: null, RUPTURE: null }
          }
        }]
      }
    ]
  },
  {
    id: 'o_nome_do_vigia',
    version: 1,
    name: 'O Nome do Vigia',
    type: 'INVESTIGATION',
    description: 'Pistas nas plataformas sugerem que o antagonista não está tentando destruir a Estação, mas impedir uma linha do futuro de chegar até ela.',
    locationIds: ['plataforma_do_vidro', 'mercado_invertido'],
    enemyIds: ['fiscal_cego', 'vigia_sem_rosto'],
    startNodeId: 'escolher_fonte',
    nodes: [
      {
        id: 'escolher_fonte',
        type: 'CHOICE',
        prompt: 'Há duas fontes sobre o Vigia: registros apagados no vidro e relatos preservados por comerciantes.',
        options: [
          { id: 'registros', label: 'Reconstruir os registros apagados', next: 'ler_ausencia' },
          { id: 'relatos', label: 'Cruzar relatos de quem já negociou com a Estação', next: 'ligar_testemunhos' }
        ]
      },
      {
        id: 'ler_ausencia',
        type: 'TEST',
        prompt: 'O que foi removido deixa um padrão mais claro que o texto restante. Descubra qual destino o Vigia tentou apagar.',
        options: [{
          id: 'reconstruir_lacuna',
          label: 'Ler a forma deixada pela ausência',
          test: {
            attribute: 'READING',
            difficulty: 12,
            nextByOutcome: { SETBACK: null, TENSE: null, FULL: null, RUPTURE: null }
          }
        }]
      },
      {
        id: 'ligar_testemunhos',
        type: 'TEST',
        prompt: 'Os relatos discordam sobre o rosto, mas repetem o mesmo medo. Encontre a conexão que sobrevive às versões.',
        options: [{
          id: 'costurar_relato',
          label: 'Costurar os relatos pelo que todos evitam dizer',
          test: {
            attribute: 'CONNECTION',
            difficulty: 11,
            nextByOutcome: { SETBACK: null, TENSE: null, FULL: null, RUPTURE: null }
          }
        }]
      }
    ]
  },
  {
    id: 'a_linha_que_nao_volta',
    version: 1,
    name: 'A Linha que não Volta',
    type: 'EXPEDITION',
    description: 'Uma rota nova cruza a Linha Morta e termina diante do Vigia Sem Rosto. O objetivo é voltar com prova suficiente para preparar o Círculo.',
    locationIds: ['plataforma_da_linha_morta', 'plataforma_sem_relogio'],
    enemyIds: ['agulha_invertida', 'vigia_sem_rosto'],
    startNodeId: 'escolher_marcha',
    nodes: [
      {
        id: 'escolher_marcha',
        type: 'CHOICE',
        prompt: 'A rota pode ser atravessada em silêncio ou marcada para permitir retirada. O Vigia percebe qualquer padrão repetido.',
        options: [
          { id: 'marcha_silenciosa', label: 'Cruzar sem deixar marcas estáveis', next: 'passar_entre_linhas' },
          { id: 'marcha_marcada', label: 'Marcar uma retirada antes de avançar', next: 'ancorar_retorno' }
        ],
        timeout: { minutes: 20, defaultOption: 'marcha_marcada' }
      },
      {
        id: 'passar_entre_linhas',
        type: 'TEST',
        prompt: 'A Agulha Invertida tenta costurar o grupo ao trilho errado. Atravesse a mudança sem aceitar o destino imposto.',
        options: [{
          id: 'quebrar_regra',
          label: 'Improvisar uma passagem entre as linhas',
          test: {
            attribute: 'BEND',
            difficulty: 12,
            nextByOutcome: { SETBACK: null, TENSE: null, FULL: null, RUPTURE: null }
          }
        }]
      },
      {
        id: 'ancorar_retorno',
        type: 'TEST',
        prompt: 'O Vigia tenta apagar o caminho de volta antes que a prova atravesse. Preserve a rota sem transformar a retirada em confronto final.',
        options: [{
          id: 'manter_vinculo',
          label: 'Manter o vínculo entre a prova e o Refúgio',
          test: {
            attribute: 'SUSTAIN',
            difficulty: 12,
            nextByOutcome: { SETBACK: null, TENSE: null, FULL: null, RUPTURE: null }
          }
        }]
      }
    ]
  }
];

export const RAW_ESTACAO_ZERO_CONTENT = {
  schemaVersion: ESTACAO_ZERO_SCHEMA_VERSION,
  contentVersion: ESTACAO_ZERO_CONTENT_VERSION,
  map,
  enemies,
  boss,
  missions
};
