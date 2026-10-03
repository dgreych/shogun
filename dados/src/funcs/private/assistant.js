import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import userContextDB from '../../utils/userContextDB.js';
import * as automacoesV9 from '../../utils/shogunRuntime.js';
import {
  buildBoundedChatMessages,
  createBunnyFyConversationClient,
  toLegacyChatResponse
} from '../../services/bunnyfy/index.js';

function getBunnyFyConversationModelOverride() {
  return automacoesV9.getConfig()?.nvidia_model || undefined;
}

// Função para obter data/hora no fuso horário do Brasil (GMT-3)
function getBrazilDateTime() {
  const now = new Date();
  // Converter para horário do Brasil (UTC-3)
  const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return brazilTime.toISOString();
}

// Função para obter data/hora formatada em PT-BR
function getFormattedBrazilDateTime() {
  const now = new Date();
  return now.toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'full',
    timeStyle: 'medium'
  });
}

// Estado de API key removido — armazenamento/checagens centralizadas foram removidas.

let historico = {};

// Sistema de estado da conversa e preferências do usuário
let conversationStates = {};
let userPreferences = {};
let userInteractions = {};

// Compatibilidade para instalações que consultam o estado do gateway.
function updateApiKeyStatus() { return true; }
function getApiKeyStatus() { return { isValid: true }; }

async function makeNvidiaRequest(modelo, texto, systemPrompt = null, historico = [], retries = 3) {
  if (!texto) {
    throw new Error('Parâmetro obrigatório ausente: texto');
  }

  const messages = buildBoundedChatMessages({
    systemPrompt,
    history: historico,
    text: texto
  });
  const result = await createBunnyFyConversationClient().createChatCompletion(messages, {
    temperature: 0.7,
    maxOutputTokens: 2000,
    model: modelo || getBunnyFyConversationModelOverride()
  });
  return toLegacyChatResponse(result);
}

// Compatibilidade temporária com comandos legados que ainda usam o nome antigo.
const makeCognimaRequest = makeNvidiaRequest;

function cleanWhatsAppFormatting(texto) {
  if (!texto || typeof texto !== 'string') return texto;
  // Código é conteúdo da resposta; preservar seu texto e sua indentação.
  return texto.split(/(```[\s\S]*?```|`[^`\n]+`)/g).map(part => {
    if (part.startsWith('`')) return part;
    return part.replace(/\*\*([^*]+)\*\*/g, '*$1*')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '*$1*')
    .replace(/_{2,}([^_]+)_{2,}/g, '_$1_')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ');
  }).join('').trim();
}

function stripJsonComments(text) {
  // Remove comentários // fora de strings, sem mexer em // que apareçam dentro de valores (ex: URLs)
  return text.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*/g, (match, stringLiteral) => stringLiteral || '');
}

/**
 * Garante que a saída sempre tenha uma fala utilizável.
 *
 * JSON pode ser VÁLIDO e ainda assim não trazer `resp` — por exemplo quando o
 * modelo devolve só o bloco `aprender`. Sem esta normalização o consumidor lê
 * resp[0] de undefined e quebra depois do parse ter dado certo, que é o pior
 * lugar para falhar.
 */
function garantirResposta(parsed) {
  const lista = Array.isArray(parsed?.resp) ? parsed.resp : null;
  const primeira = lista?.find((item) => typeof item?.resp === 'string' && item.resp.trim());
  if (primeira) return parsed;
  return { ...parsed, resp: [{ resp: 'Me perdi no meio da resposta. Pergunta de novo?' }] };
}

function extractJSON(content) {
  if (!content || typeof content !== 'string') {
    console.warn('Conteúdo inválido para extração de JSON, retornando objeto vazio.');
    return { resp: [{ resp: content }] };
  }

  // Remover blocos de código markdown de forma mais robusta
  let cleanContent = content.trim();

  // Remover todos os tipos de marcadores de código markdown
  cleanContent = cleanContent.replace(/^```json\s*/gim, '');
  cleanContent = cleanContent.replace(/^```javascript\s*/gim, '');
  cleanContent = cleanContent.replace(/^```\s*/gm, '');
  cleanContent = cleanContent.replace(/```\s*$/gm, '');
  cleanContent = cleanContent.trim();

  // Tentar extrair JSON diretamente
  try {
    const parsed = JSON.parse(cleanContent);
    console.log('✅ JSON extraído com sucesso (parse direto)');
    return garantirResposta(parsed);
  } catch (e) {
    // Se falhar, tentar corrigir problemas comuns
  }

  // Tentar de novo sem comentários // (alguns modelos colocam comentário dentro do JSON, o que é inválido)
  try {
    const parsed = JSON.parse(stripJsonComments(cleanContent));
    console.log('✅ JSON extraído com sucesso (sem comentários)');
    return garantirResposta(parsed);
  } catch (e) {
    // Se falhar, continua para a extração via regex
  }

  // Tentar encontrar o JSON dentro do texto usando regex mais específico
  const jsonMatch = cleanContent.match(/\{(?:[^{}]|(\{(?:[^{}]|\{[^{}]*\})*\}))*\}/s);

  if (jsonMatch) {
    let jsonString = stripJsonComments(jsonMatch[0]);

    // Tentar corrigir quebras de linha dentro de strings JSON
    // Isso substitui quebras de linha literais por \n, mas apenas dentro de strings
    try {
      // Primeiro, vamos tentar um parse relaxado usando eval (cuidado!)
      // Substituir quebras de linha literais dentro de strings
      const fixedJson = jsonString.replace(/"([^"]*?)"/gs, (match, content) => {
        // Substituir quebras de linha dentro da string por \\n
        const fixed = content.replace(/\r?\n/g, '\\n');
        return `"${fixed}"`;
      });

      const parsed = JSON.parse(fixedJson);
      console.log('✅ JSON extraído com sucesso (com correção de quebras de linha)');
      return garantirResposta(parsed);
    } catch (e) {
      console.warn('Falha ao fazer parse do JSON encontrado:', e.message);
    }
  }

  const lookedLikeJson = /^[\[{]/.test(cleanContent);

  if (!lookedLikeJson) {
    console.log('ℹ️ Resposta textual recebida; normalizando para o formato interno da assistente.');
    return { resp: [{ resp: cleanWhatsAppFormatting(cleanContent) || 'Não entendi a resposta, pode tentar de novo?' }] };
  }

  // O payload parece JSON e nenhum parse pegou. A resposta de verdade quase
  // sempre continua lá dentro, no campo resp -- basta um caso como {s "resp":
  // (um caractere perdido depois da chave) para derrubar todos os parses.
  // Resgatar o campo entrega a fala correta em vez de despejar a estrutura.
  const resgate = cleanContent.match(/"resp"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (resgate) {
    console.warn('⚠️ JSON malformado da assistente; resposta resgatada do campo resp.');
    const texto = resgate[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    return { resp: [{ resp: cleanWhatsAppFormatting(texto) }] };
  }

  // Sem resgate possível, o usuário NUNCA pode receber o payload cru: antes
  // disso, a estrutura interna da assistente assistant inteira para a conversa.
  console.warn('⚠️ JSON malformado da assistente e sem campo resp recuperável; payload descartado.');
  return { resp: [{ resp: 'Me perdi no meio da resposta. Pergunta de novo?' }] };
}

function validateMessage(msg) {
  if (typeof msg === 'object' && msg !== null) {
    return {
      data_atual: msg.data_atual || getBrazilDateTime(),
      data_mensagem: msg.data_mensagem || getBrazilDateTime(),
      texto: String(msg.texto || '').trim(),
      id_enviou: String(msg.id_enviou || ''),
      nome_enviou: String(msg.nome_enviou || ''),
      id_grupo: String(msg.id_grupo || ''),
      nome_grupo: String(msg.nome_grupo || ''),
      tem_midia: Boolean(msg.tem_midia),
      marcou_mensagem: Boolean(msg.marcou_mensagem),
      marcou_sua_mensagem: Boolean(msg.marcou_sua_mensagem),
      mensagem_marcada: msg.mensagem_marcada || null,
      id_enviou_marcada: msg.id_enviou_marcada || null,
      tem_midia_marcada: Boolean(msg.tem_midia_marcada),
      id_mensagem: msg.id_mensagem || (() => {
        try {
          return crypto.randomBytes(8).toString('hex');
        } catch (error) {
          return Math.random().toString(16).substring(2, 18);
        }
      })()
    };
  }

  if (typeof msg === 'string') {
    const parts = msg.split('|');
    if (parts.length < 7) {
      throw new Error('Formato de mensagem inválido - poucos campos');
    }
    return {
      data_atual: parts[0] || getBrazilDateTime(),
      data_mensagem: parts[1] || getBrazilDateTime(),
      texto: String(parts[2] || '').trim(),
      id_enviou: String(parts[3] || ''),
      nome_enviou: String(parts[4] || ''),
      id_grupo: String(parts[5] || ''),
      nome_grupo: String(parts[6] || ''),
      tem_midia: parts[7] === 'true',
      marcou_mensagem: parts[8] === 'true',
      marcou_sua_mensagem: parts[9] === 'true',
      mensagem_marcada: parts[10] || null,
      id_enviou_marcada: parts[11] || null,
      tem_midia_marcada: parts[12] === 'true',
      id_mensagem: parts[13] || (() => {
        try {
          return crypto.randomBytes(8).toString('hex');
        } catch (error) {
          return Math.random().toString(16).substring(2, 18);
        }
      })()
    };
  }

  throw new Error('Formato de mensagem não suportado');
}

function updateHistorico(grupoUserId, role, content, nome = null) {
  if (!historico[grupoUserId]) {
    historico[grupoUserId] = [];
  }
  
  const entry = {
    role,
    content: cleanWhatsAppFormatting(content),
    timestamp: getBrazilDateTime()
  };
  
  if (nome) {
    entry.name = nome;
  }
  
  historico[grupoUserId].push(entry);
  
  // Manter as últimas 20 interações (10 trocas) para contexto
  if (historico[grupoUserId].length > 20) {
    historico[grupoUserId] = historico[grupoUserId].slice(-20);
  }
}

// Sistema de gerenciamento de estado da conversa
function updateConversationState(grupoUserId, state, data = {}) {
  if (!conversationStates[grupoUserId]) {
    conversationStates[grupoUserId] = {
      currentState: 'idle',
      previousStates: [],
      context: {},
      sessionStart: Date.now(),
      lastActivity: Date.now()
    };
  }
  
  const currentState = conversationStates[grupoUserId];
  currentState.previousStates.push(currentState.currentState);
  currentState.currentState = state;
  currentState.context = { ...currentState.context, ...data };
  currentState.lastActivity = Date.now();
  
  // Man histórico de estados
  if (currentState.previousStates.length > 5) {
    currentState.previousStates = currentState.previousStates.slice(-5);
  }
}

function getConversationState(grupoUserId) {
  return conversationStates[grupoUserId] || {
    currentState: 'idle',
    previousStates: [],
    context: {},
    sessionStart: Date.now(),
    lastActivity: Date.now()
  };
}

function updateUserPreferences(grupoUserId, preference, value) {
  if (!userPreferences[grupoUserId]) {
    userPreferences[grupoUserId] = {
      language: 'pt-BR',
      formality: 'casual',
      emojiUsage: 'high',
      topics: [],
      mood: 'neutral',
      lastInteraction: Date.now()
    };
  }
  
  userPreferences[grupoUserId][preference] = value;
  userPreferences[grupoUserId].lastInteraction = Date.now();
  
  // Atualizar tópicos de interesse
  if (preference === 'topic') {
    if (!userPreferences[grupoUserId].topics.includes(value)) {
      userPreferences[grupoUserId].topics.push(value);
      if (userPreferences[grupoUserId].topics.length > 10) {
        userPreferences[grupoUserId].topics = userPreferences[grupoUserId].topics.slice(-10);
      }
    }
  }
}

function getUserPreferences(grupoUserId) {
  return userPreferences[grupoUserId] || {
    language: 'pt-BR',
    formality: 'casual',
    emojiUsage: 'high',
    topics: [],
    mood: 'neutral',
    lastInteraction: Date.now()
  };
}

function trackUserInteraction(grupoUserId, interactionType, details = {}) {
  if (!userInteractions[grupoUserId]) {
    userInteractions[grupoUserId] = {
      totalInteractions: 0,
      interactionTypes: {},
      favoriteTopics: {},
      lastTopics: [],
      sentiment: 'neutral',
      sessionStats: {
        startTime: Date.now(),
        messagesCount: 0,
        commandsUsed: 0
      }
    };
  }
  
  const interactions = userInteractions[grupoUserId];
  interactions.totalInteractions++;
  interactions.sessionStats.messagesCount++;
  
  if (!interactions.interactionTypes[interactionType]) {
    interactions.interactionTypes[interactionType] = 0;
  }
  interactions.interactionTypes[interactionType]++;
  
  // Atualizar tópicos recentes
  if (details.topic) {
    interactions.lastTopics.push(details.topic);
    if (interactions.lastTopics.length > 5) {
      interactions.lastTopics = interactions.lastTopics.slice(-5);
    }
    
    // Atualizar tópicos favoritos
    if (!interactions.favoriteTopics[details.topic]) {
      interactions.favoriteTopics[details.topic] = 0;
    }
    interactions.favoriteTopics[details.topic]++;
  }
  
  interactions.sessionStats.lastUpdate = Date.now();
}

function getUserInteractionStats(grupoUserId) {
  return userInteractions[grupoUserId] || {
    totalInteractions: 0,
    interactionTypes: {},
    favoriteTopics: {},
    lastTopics: [],
    sentiment: 'neutral',
    sessionStats: {
      startTime: Date.now(),
      messagesCount: 0,
      commandsUsed: 0,
      lastUpdate: Date.now()
    }
  };
}

// Função para limpar dados antigos
function clearConversationData(maxAge = 7 * 24 * 60 * 60 * 1000) {
  const now = Date.now();
  const maxAgeMs = maxAge;
  
  // Limpar histórico de conversas
  Object.keys(historico).forEach(grupoUserId => {
    const conversa = historico[grupoUserId];
    if (conversa.length > 0) {
      const lastMsg = conversa[conversa.length - 1];
      const lastMsgTime = new Date(lastMsg.timestamp).getTime();
      
      if (now - lastMsgTime > maxAgeMs) {
        delete historico[grupoUserId];
      }
    }
  });
  
  // Limpar estados de conversa
  Object.keys(conversationStates).forEach(grupoUserId => {
    const state = conversationStates[grupoUserId];
    if (now - state.lastActivity > maxAgeMs) {
      delete conversationStates[grupoUserId];
    }
  });
  
  // Limpar preferências do usuário
  Object.keys(userPreferences).forEach(grupoUserId => {
    const pref = userPreferences[grupoUserId];
    if (now - pref.lastInteraction > maxAgeMs) {
      delete userPreferences[grupoUserId];
    }
  });
  
  // Limpiar estatísticas de interação
  Object.keys(userInteractions).forEach(grupoUserId => {
    const interaction = userInteractions[grupoUserId];
    if (now - interaction.sessionStats.lastUpdate > maxAgeMs) {
      delete userInteractions[grupoUserId];
    }
  });
}

async function processUserMessages(data, socket = null, ownerNumber = null, personality = 'shogun', modoAdulto = false) {
  personality = 'shogun';
  try {
    const { mensagens, model } = data;
    if (!mensagens || !Array.isArray(mensagens)) {
      throw new Error('Mensagens são obrigatórias e devem ser um array');
    }

    const mensagensValidadas = [];
    for (let i = 0; i < mensagens.length; i++) {
      try {
        const msgValidada = validateMessage(mensagens[i]);
        mensagensValidadas.push(msgValidada);
      } catch (msgError) {
        console.warn(`Erro ao processar mensagem ${i}:`, msgError.message);
        continue;
      }
    }

    if (mensagensValidadas.length === 0) {
      return { resp: [], erro: 'Nenhuma mensagem válida para processar' };
    }

    const respostas = [];
    
    // Contexto temporal - usando horário do Brasil
    const now = new Date();
    const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const hour = brazilTime.getHours();
    const isNightTime = hour >= 18 || hour < 6;
    
    for (const msgValidada of mensagensValidadas) {
      // Escopado por grupo: informação dita em um grupo não pode vazar para outro
      const userId = `${msgValidada.id_grupo || 'dm'}_${msgValidada.id_enviou}_${personality}`;
      
      // Registrar interação
      userContextDB.registerInteraction(userId, msgValidada.texto);
      userContextDB.updateUserInfo(userId, msgValidada.nome_enviou);
      
      // Obter contexto do usuário
      const userContext = userContextDB.getUserContextSummary(userId);
      
      updateHistorico(userId, 'user', msgValidada.texto, msgValidada.nome_enviou);
      
      const userInput = {
        mensagem_atual: msgValidada.texto,
        nome_usuario: msgValidada.nome_enviou,
        historico: historico[userId] || [],
        userContext,
        contexto_temporal: {
          horario: hour, noite: isNightTime,
          data: brazilTime.toLocaleDateString('pt-BR'),
          diaSemana: brazilTime.toLocaleDateString('pt-BR', { weekday: 'long' }),
        },
      };

      let result;
      try {
        const creatorVerified = await automacoesV9.recognizeCreator(
          msgValidada.id_enviou, automacoesV9.getConfig()?.creatorNumber, socket
        );
        const systemPrompt = automacoesV9.buildAssistantSystemPrompt('shogun', '', { modoAdulto, creatorVerified });
        // Chamada única para processamento com contexto
        const response = (await makeNvidiaRequest(
          model || getBunnyFyConversationModelOverride(),
          JSON.stringify(userInput),
          systemPrompt,
          historico[userId] || []
        )).data;

        if (!response || !response.choices || !response.choices[0]) {
          throw new Error("O gateway devolveu uma resposta vazia ou inválida.");
        }

        const content = response.choices[0].message.content;
        result = extractJSON(content);

        console.info(`[${personality}] Resposta processada`, {
          responseItems: Array.isArray(result?.resp) ? result.resp.length : 0,
          commandDetected: result?.isCommand === true
        });

        // Processar aprendizado se houver (suporta objeto único ou array)
        if (result.aprender) {
          if (Array.isArray(result.aprender)) {
            // Múltiplos aprendizados de uma vez
            result.aprender.forEach(aprend => {
              processLearning(userId, aprend, msgValidada.texto);
            });
          } else {
            // Aprendizado único
            processLearning(userId, result.aprender, msgValidada.texto);
          }
        }

        // Processar respostas
        // Verificar se result.resp existe e é um array válido
        if (result && result.resp && Array.isArray(result.resp) && result.resp.length > 0) {
          result.resp.forEach(resposta => {
            // Garantir que a resposta tem a estrutura esperada
            if (resposta && typeof resposta === 'object') {
              // Se resposta.resp existe e é string válida
              if (resposta.resp && typeof resposta.resp === 'string' && resposta.resp.trim().length > 0) {
                resposta.resp = cleanWhatsAppFormatting(resposta.resp);
                updateHistorico(userId, 'assistant', resposta.resp);
                
                // Garantir que tem react
                if (!resposta.react) {
                  resposta.react = getShogunReaction();
                }
                
                respostas.push(resposta);
              }
              // Se a resposta tem outro formato (ex: só texto direto no objeto)
              else if (resposta.text && typeof resposta.text === 'string' && resposta.text.trim().length > 0) {
                respostas.push({
                  resp: cleanWhatsAppFormatting(resposta.text),
                  react: resposta.react || getShogunReaction()
                });
              }
            }
            // Se a resposta é uma string diretamente
            else if (typeof resposta === 'string' && resposta.trim().length > 0) {
              respostas.push({
                resp: cleanWhatsAppFormatting(resposta),
                react: getShogunReaction()
              });
            }
          });
        } 
        // Se não tem respostas válidas, tentar criar uma resposta padrão
        else {
          console.warn(`⚠️ [${personality}] Resposta fora do formato esperado`, {
            resultType: Array.isArray(result) ? 'array' : typeof result,
            hasResp: typeof result?.resp === 'string',
            hasMessage: typeof result?.message === 'string',
            hasText: typeof result?.text === 'string'
          });
          
          // Tentar diferentes formatos de fallback
          if (result && result.resp && typeof result.resp === 'string' && result.resp.trim().length > 0) {
            respostas.push({
              resp: cleanWhatsAppFormatting(result.resp),
              react: getShogunReaction()
            });
          } else if (result && result.message && typeof result.message === 'string' && result.message.trim().length > 0) {
            respostas.push({
              resp: cleanWhatsAppFormatting(result.message),
              react: getShogunReaction()
            });
          } else if (result && result.text && typeof result.text === 'string' && result.text.trim().length > 0) {
            respostas.push({
              resp: cleanWhatsAppFormatting(result.text),
              react: getShogunReaction()
            });
          } else if (typeof result === 'string' && result.trim().length > 0) {
            respostas.push({
              resp: cleanWhatsAppFormatting(result),
              react: getShogunReaction()
            });
          } else {
            console.error(`❌ [${personality}] Não foi possível extrair resposta válida do resultado`);
          }
        }
      } catch (apiError) {
        console.error('[BUNNYFY_CONVERSATION] Erro na assistente:', {
          code: apiError.code,
          status: apiError.status,
          message: apiError.message
        });

        return {
          resp: [],
          erro: apiError.code || 'BUNNYFY_CONVERSATION_FAILED',
          status: apiError.status || null,
          message: apiError.userMessage || 'O Shogun não conseguiu responder agora. Tente novamente em instantes.'
        };
      }
    }

    return { resp: respostas };

  } catch (error) {
    console.error('Erro fatal ao processar mensagens:', error);
    return {
      resp: [],
      erro: 'Erro interno do processamento',
      message: 'Deu um problema ao ler a mensagem. Manda de novo em instantes.'
    };
  }
}

/**
 * Atualiza as preferências de conversa do usuário
 */
function processLearning(grupoUserId, aprender, mensagemOriginal) {
  try {
    const { tipo, valor, contexto, acao, valor_antigo } = aprender;
    
    if (!tipo || !valor) {
      console.warn('⚠️ Aprendizado inválido (faltam campos):', aprender);
      return;
    }
    
    // Normalizar o tipo para lowercase para evitar problemas de case
    const tipoNormalizado = tipo.toLowerCase().trim();
    
    // Ações suportadas: adicionar (padrão), editar, excluir
    const acaoNormalizada = (acao || 'adicionar').toLowerCase().trim();
    
    // Processar EDIÇÃO de memória
    if (acaoNormalizada === 'editar' || acaoNormalizada === 'atualizar' || acaoNormalizada === 'modificar') {
      if (!valor_antigo) {
        console.warn('⚠️ Ação de edição precisa do campo "valor_antigo"');
        return;
      }
      
      const sucesso = userContextDB.updateMemory(grupoUserId, tipoNormalizado, valor_antigo, valor);
      
      if (sucesso) {
        console.log(`✏️ Shogun EDITOU: ${tipo} de "${valor_antigo}" para "${valor}" (${grupoUserId})`);
      } else {
        console.warn(`⚠️ Shogun não encontrou "${valor_antigo}" em ${tipo} para editar`);
      }
      return;
    }
    
    // Processar EXCLUSÃO de memória
    if (acaoNormalizada === 'excluir' || acaoNormalizada === 'remover' || acaoNormalizada === 'deletar') {
      const sucesso = userContextDB.deleteMemory(grupoUserId, tipoNormalizado, valor);
      
      if (sucesso) {
        console.log(`🗑️ Shogun EXCLUIU: ${tipo} = "${valor}" (${grupoUserId})`);
      } else {
        console.warn(`⚠️ Shogun não encontrou "${valor}" em ${tipo} para excluir`);
      }
      return;
    }
    
    // Processar ADIÇÃO de memória (padrão)
    
    switch (tipoNormalizado) {
      case 'gosto':
      case 'gostos':
        userContextDB.addUserPreference(grupoUserId, 'gostos', valor);
        console.log(`✅ Shogun aprendeu: ${grupoUserId} gosta de "${valor}"`);
        break;
        
      case 'nao_gosto':
      case 'nao_gostos':
      case 'não_gosto':
      case 'não_gostos':
        userContextDB.addUserPreference(grupoUserId, 'nao_gostos', valor);
        console.log(`✅ Shogun aprendeu: ${grupoUserId} não gosta de "${valor}"`);
        break;
        
      case 'hobby':
      case 'hobbies':
        userContextDB.addUserPreference(grupoUserId, 'hobbies', valor);
        console.log(`✅ Shogun aprendeu: hobby de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'assunto_favorito':
      case 'assuntos_favoritos':
      case 'assunto':
      case 'topico':
      case 'tópico':
        userContextDB.addUserPreference(grupoUserId, 'assuntos_favoritos', valor);
        userContextDB.addRecentTopic(grupoUserId, valor);
        console.log(`✅ Shogun aprendeu: assunto favorito de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'nota_importante':
      case 'nota':
      case 'informacao_importante':
      case 'informação_importante':
      case 'lembrete':
        userContextDB.addImportantNote(grupoUserId, valor);
        console.log(`✅ Shogun anotou: "${valor}" sobre ${grupoUserId}`);
        break;
        
      case 'memoria_especial':
      case 'memoria':
      case 'memória_especial':
      case 'memória':
      case 'momento_especial':
        userContextDB.addSpecialMemory(grupoUserId, valor);
        console.log(`✅ Shogun guardou memória especial: "${valor}" com ${grupoUserId}`);
        break;
        
      case 'nome':
        // Atualizar o nome do usuário
        userContextDB.updateUserInfo(grupoUserId, valor, null);
        console.log(`✅ Shogun aprendeu o nome: ${grupoUserId} se chama "${valor}"`);
        break;
        
      case 'apelido':
      case 'apelidos':
      case 'nickname':
        // Adicionar apelido
        userContextDB.updateUserInfo(grupoUserId, null, valor);
        console.log(`✅ Shogun aprendeu apelido: ${grupoUserId} gosta de ser chamado de "${valor}"`);
        break;
        
      case 'idade':
        userContextDB.updatePersonalInfo(grupoUserId, 'idade', valor);
        console.log(`✅ Shogun aprendeu: ${grupoUserId} tem ${valor} anos`);
        break;
        
      case 'localizacao':
      case 'localização':
      case 'local':
      case 'cidade':
      case 'lugar':
        userContextDB.updatePersonalInfo(grupoUserId, 'localizacao', valor);
        console.log(`✅ Shogun aprendeu: ${grupoUserId} mora em "${valor}"`);
        break;
        
      case 'profissao':
      case 'profissão':
      case 'trabalho':
      case 'emprego':
      case 'ocupacao':
      case 'ocupação':
        userContextDB.updatePersonalInfo(grupoUserId, 'profissao', valor);
        console.log(`✅ Shogun aprendeu: ${grupoUserId} trabalha como "${valor}"`);
        break;
        
      case 'relacionamento':
      case 'status_relacionamento':
      case 'status':
        userContextDB.updatePersonalInfo(grupoUserId, 'relacionamento', valor);
        console.log(`✅ Shogun aprendeu: status de relacionamento de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'familia':
      case 'família':
      case 'parente':
      case 'parentes':
        // Adicionar membro da família
        const contextoAtual = userContextDB.getUserContext(grupoUserId);
        if (!contextoAtual.informacoes_pessoais.familia.includes(valor)) {
          contextoAtual.informacoes_pessoais.familia.push(valor);
          userContextDB.data[grupoUserId] = contextoAtual;
          userContextDB.saveDatabase();
          console.log(`✅ Shogun aprendeu sobre família de ${grupoUserId}: "${valor}"`);
        }
        break;
        
      case 'info_pessoal':
      case 'informacao_pessoal':
      case 'informação_pessoal':
        // Tentar identificar o campo correto baseado no contexto
        const camposValidos = ['idade', 'localizacao', 'profissao', 'relacionamento'];
        const campo = contexto ? contexto.toLowerCase() : null;
        
        if (campo && camposValidos.includes(campo)) {
          userContextDB.updatePersonalInfo(grupoUserId, campo, valor);
          console.log(`✅ Shogun aprendeu info pessoal de ${grupoUserId}: ${campo} = "${valor}"`);
        } else {
          // Se não souber o campo, adicionar como nota importante
          userContextDB.addImportantNote(grupoUserId, valor);
          console.log(`✅ Shogun anotou info pessoal: "${valor}" sobre ${grupoUserId}`);
        }
        break;
        
      case 'sentimento':
      case 'humor':
      case 'mood':
      case 'estado_emocional':
        // Atualizar humor comum do usuário
        const userContext = userContextDB.getUserContext(grupoUserId);
        userContext.padroes_comportamento.humor_comum = valor;
        userContextDB.data[grupoUserId] = userContext;
        userContextDB.saveDatabase();
        console.log(`✅ Shogun percebeu o humor de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'estilo_conversa':
      case 'estilo':
      case 'jeito':
        // Atualizar estilo de conversa
        const userCtx = userContextDB.getUserContext(grupoUserId);
        userCtx.preferencias.estilo_conversa = valor;
        userContextDB.data[grupoUserId] = userCtx;
        userContextDB.saveDatabase();
        console.log(`✅ Shogun identificou estilo de conversa de ${grupoUserId}: "${valor}"`);
        break;
        
      // NOVOS TIPOS DE APRENDIZADO
      case 'sonho':
      case 'sonhos':
      case 'objetivo':
      case 'objetivos':
      case 'meta':
      case 'metas':
      case 'aspiracao':
      case 'aspiração':
        userContextDB.addImportantNote(grupoUserId, `[SONHO/OBJETIVO] ${valor}`);
        console.log(`✅ Shogun anotou sonho/objetivo de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'medo':
      case 'medos':
      case 'fobia':
      case 'fobias':
      case 'receio':
        userContextDB.addImportantNote(grupoUserId, `[MEDO] ${valor}`);
        console.log(`✅ Shogun anotou medo de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'rotina':
      case 'habito':
      case 'hábito':
      case 'costume':
        userContextDB.addImportantNote(grupoUserId, `[ROTINA] ${valor}`);
        console.log(`✅ Shogun anotou rotina de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'pet':
      case 'animal':
      case 'animal_estimacao':
      case 'animal_de_estimação':
        userContextDB.addImportantNote(grupoUserId, `[PET] ${valor}`);
        console.log(`✅ Shogun anotou sobre pet de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'musica':
      case 'música':
      case 'musica_favorita':
      case 'banda':
      case 'artista':
        userContextDB.addUserPreference(grupoUserId, 'gostos', `[MÚSICA] ${valor}`);
        console.log(`✅ Shogun anotou gosto musical de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'filme':
      case 'filmes':
      case 'serie':
      case 'série':
      case 'anime':
        userContextDB.addUserPreference(grupoUserId, 'gostos', `[FILME/SÉRIE] ${valor}`);
        console.log(`✅ Shogun anotou filme/série favorito de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'jogo':
      case 'jogos':
      case 'game':
      case 'games':
        userContextDB.addUserPreference(grupoUserId, 'gostos', `[JOGO] ${valor}`);
        console.log(`✅ Shogun anotou jogo favorito de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'comida':
      case 'comida_favorita':
      case 'prato':
      case 'culinaria':
      case 'culinária':
        userContextDB.addUserPreference(grupoUserId, 'gostos', `[COMIDA] ${valor}`);
        console.log(`✅ Shogun anotou comida favorita de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'bebida':
      case 'bebida_favorita':
      case 'drink':
        userContextDB.addUserPreference(grupoUserId, 'gostos', `[BEBIDA] ${valor}`);
        console.log(`✅ Shogun anotou bebida favorita de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'cor':
      case 'cor_favorita':
      case 'cores':
        userContextDB.addUserPreference(grupoUserId, 'gostos', `[COR] ${valor}`);
        console.log(`✅ Shogun anotou cor favorita de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'esporte':
      case 'esportes':
      case 'time':
      case 'time_futebol':
      case 'clube':
        userContextDB.addUserPreference(grupoUserId, 'gostos', `[ESPORTE] ${valor}`);
        console.log(`✅ Shogun anotou sobre esporte de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'livro':
      case 'livros':
      case 'autor':
      case 'leitura':
        userContextDB.addUserPreference(grupoUserId, 'gostos', `[LIVRO] ${valor}`);
        console.log(`✅ Shogun anotou livro favorito de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'viagem':
      case 'viagens':
      case 'lugar_visitado':
      case 'destino':
        userContextDB.addImportantNote(grupoUserId, `[VIAGEM] ${valor}`);
        console.log(`✅ Shogun anotou sobre viagem de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'estudo':
      case 'estudos':
      case 'curso':
      case 'faculdade':
      case 'universidade':
      case 'formacao':
      case 'formação':
        userContextDB.updatePersonalInfo(grupoUserId, 'profissao', `${valor} (estudante)`);
        console.log(`✅ Shogun anotou sobre estudos de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'idioma':
      case 'idiomas':
      case 'lingua':
      case 'língua':
        userContextDB.addImportantNote(grupoUserId, `[IDIOMA] ${valor}`);
        console.log(`✅ Shogun anotou idioma de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'talento':
      case 'habilidade':
      case 'skill':
      case 'dom':
        userContextDB.addImportantNote(grupoUserId, `[TALENTO] ${valor}`);
        console.log(`✅ Shogun anotou talento de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'problema':
      case 'dificuldade':
      case 'desafio':
      case 'preocupacao':
      case 'preocupação':
        userContextDB.addImportantNote(grupoUserId, `[PROBLEMA] ${valor}`);
        console.log(`✅ Shogun anotou preocupação de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'conquista':
      case 'realizacao':
      case 'realização':
      case 'vitoria':
      case 'vitória':
      case 'sucesso':
        userContextDB.addSpecialMemory(grupoUserId, `[CONQUISTA] ${valor}`);
        console.log(`✅ Shogun celebrou conquista de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'aniversario':
      case 'aniversário':
      case 'data_nascimento':
      case 'birthday':
        userContextDB.addImportantNote(grupoUserId, `[ANIVERSÁRIO] ${valor}`);
        console.log(`✅ Shogun anotou aniversário de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'signo':
      case 'zodiaco':
      case 'zodíaco':
        userContextDB.addImportantNote(grupoUserId, `[SIGNO] ${valor}`);
        console.log(`✅ Shogun anotou signo de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'personalidade':
      case 'jeito_de_ser':
      case 'caracteristica':
      case 'característica':
        userContextDB.addImportantNote(grupoUserId, `[PERSONALIDADE] ${valor}`);
        console.log(`✅ Shogun anotou sobre personalidade de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'saude':
      case 'saúde':
      case 'condicao':
      case 'condição':
      case 'alergia':
        userContextDB.addImportantNote(grupoUserId, `[SAÚDE] ${valor}`);
        console.log(`✅ Shogun anotou sobre saúde de ${grupoUserId}: "${valor}"`);
        break;
        
      case 'plano':
      case 'planos':
      case 'intencao':
      case 'intenção':
      case 'futuro':
        userContextDB.addImportantNote(grupoUserId, `[PLANOS] ${valor}`);
        console.log(`✅ Shogun anotou planos de ${grupoUserId}: "${valor}"`);
        break;
        
      default:
        // Sistema inteligente para tipos não pré-definidos
        console.warn(`⚠️ Tipo de aprendizado não reconhecido: "${tipo}"`);
        
        // Tentar categorizar automaticamente baseado no tipo
        const tipoLower = tipoNormalizado;
        
        // Tentar identificar se é uma preferência (contém palavras-chave)
        if (tipoLower.includes('gost') || tipoLower.includes('adora') || tipoLower.includes('ama') || 
            tipoLower.includes('prefere') || tipoLower.includes('curte')) {
          userContextDB.addUserPreference(grupoUserId, 'gostos', `[${tipo}] ${valor}`);
          console.log(`📝 Shogun categorizou como GOSTO: "${tipo}: ${valor}"`);
        }
        // Tentar identificar se é algo que não gosta
        else if (tipoLower.includes('odeia') || tipoLower.includes('detesta') || 
                 tipoLower.includes('nao_gosta') || tipoLower.includes('desgosto')) {
          userContextDB.addUserPreference(grupoUserId, 'nao_gostos', `[${tipo}] ${valor}`);
          console.log(`📝 Shogun categorizou como NÃO GOSTA: "${tipo}: ${valor}"`);
        }
        // Tentar identificar se é uma atividade/hobby
        else if (tipoLower.includes('atividade') || tipoLower.includes('faz') || 
                 tipoLower.includes('pratica') || tipoLower.includes('joga')) {
          userContextDB.addUserPreference(grupoUserId, 'hobbies', `[${tipo}] ${valor}`);
          console.log(`📝 Shogun categorizou como HOBBY: "${tipo}: ${valor}"`);
        }
        // Tentar identificar se é informação pessoal
        else if (tipoLower.includes('pessoal') || tipoLower.includes('info') || 
                 tipoLower.includes('dado') || tipoLower.includes('caracteristica')) {
          // Criar um campo personalizado nas informações pessoais
          const userCtx = userContextDB.getUserContext(grupoUserId);
          if (!userCtx.informacoes_pessoais.outros) {
            userCtx.informacoes_pessoais.outros = {};
          }
          userCtx.informacoes_pessoais.outros[tipo] = valor;
          userContextDB.data[grupoUserId] = userCtx;
          userContextDB.saveDatabase();
          console.log(`📝 Shogun salvou INFO PERSONALIZADA: "${tipo}: ${valor}"`);
        }
        // Se não conseguir categorizar, salvar como nota importante com o tipo original
        else {
          userContextDB.addImportantNote(grupoUserId, `[${tipo}] ${valor}`);
          console.log(`📝 Shogun anotou (tipo personalizado): "${tipo}: ${valor}" sobre ${grupoUserId}`);
        }
    }
  } catch (error) {
    console.error('❌ Erro ao processar aprendizado:', error);
    console.error('Dados do aprendizado:', aprender);
  }
}

// Preferências de conversa
// Sem reação sorteada: deixa o contexto escolher o emoji.
function getShogunReaction() { return ''; }

function getHistoricoStats() {
  const stats = {
    totalConversas: Object.keys(historico).length,
    conversasAtivas: 0,
    totalMensagens: 0
  };
  
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000);
  
  Object.values(historico).forEach(conversa => {
    stats.totalMensagens += conversa.length;
    const lastMsg = conversa[conversa.length - 1];
    if (lastMsg && new Date(lastMsg.timestamp).getTime() > hourAgo) {
      stats.conversasAtivas++;
    }
  });
  
  return stats;
}

function clearOldHistorico(maxAge = 24 * 60 * 60 * 1000) {
  const now = Date.now();
  
  Object.keys(historico).forEach(grupoUserId => {
    const conversa = historico[grupoUserId];
    if (conversa.length > 0) {
      const lastMsg = conversa[conversa.length - 1];
      const lastMsgTime = new Date(lastMsg.timestamp).getTime();
      
      if (now - lastMsgTime > maxAge) {
        delete historico[grupoUserId];
      }
    }
  });
}

// Sistema de logging e análise de conversas
let conversationLogs = {};
let responseAnalytics = {};

function logConversation(grupoUserId, message, response, timestamp, metadata = {}) {
  if (!conversationLogs[grupoUserId]) {
    conversationLogs[grupoUserId] = [];
  }
  
  const logEntry = {
    timestamp,
    message,
    response,
    metadata: {
      ...metadata,
      responseLength: response ? response.length : 0,
      hasEmojis: response ? /[🌸🌙🦇💕😊😳😅😠🌟✨🌺🌷🌹❄️🎂🎄🎊🎃🍂🍁☀️🌅🌊🔥]/.test(response) : false,
      sentiment: analyzeSentiment(response),
      ...metadata
    }
  };
  
  conversationLogs[grupoUserId].push(logEntry);
  
  // Manter apenas os últimos 100 logs por usuário
  if (conversationLogs[grupoUserId].length > 100) {
    conversationLogs[grupoUserId] = conversationLogs[grupoUserId].slice(-100);
  }
  
  // Atualizar analytics
  updateResponseAnalytics(grupoUserId, logEntry);
}

function updateResponseAnalytics(grupoUserId, logEntry) {
  if (!responseAnalytics[grupoUserId]) {
    responseAnalytics[grupoUserId] = {
      totalResponses: 0,
      averageResponseLength: 0,
      emojiUsage: 0,
      sentimentDistribution: {
        positive: 0,
        neutral: 0,
        negative: 0
      },
      responseTypes: {},
      hourlyActivity: {},
      dailyActivity: {},
      favoriteTopics: {}
    };
  }
  
  const analytics = responseAnalytics[grupoUserId];
  analytics.totalResponses++;
  
  // Atualizar comprimento médio
  const currentLength = logEntry.metadata.responseLength;
  analytics.averageResponseLength =
    (analytics.averageResponseLength * (analytics.totalResponses - 1) + currentLength) / analytics.totalResponses;
  
  // Atualizar uso de emojis
  if (logEntry.metadata.hasEmojis) {
    analytics.emojiUsage++;
  }
  
  // Atualizar distribuição de sentimentos
  analytics.sentimentDistribution[logEntry.metadata.sentiment]++;
  
  // Atualizar tipos de resposta
  const responseType = logEntry.metadata.type || 'general';
  analytics.responseTypes[responseType] = (analytics.responseTypes[responseType] || 0) + 1;
  
  // Atualizar atividade horária
  const hour = new Date(logEntry.timestamp).getHours();
  analytics.hourlyActivity[hour] = (analytics.hourlyActivity[hour] || 0) + 1;
  
  // Atualizar atividade diária
  const day = new Date(logEntry.timestamp).toLocaleDateString('pt-BR');
  analytics.dailyActivity[day] = (analytics.dailyActivity[day] || 0) + 1;
  
  // Atualizar tópicos favoritos
  if (logEntry.metadata.topic) {
    analytics.favoriteTopics[logEntry.metadata.topic] = (analytics.favoriteTopics[logEntry.metadata.topic] || 0) + 1;
  }
}

function analyzeSentiment(text) {
  if (!text) return 'neutral';
  
  const positiveWords = ['amor', 'gostar', 'feliz', 'alegre', 'maravilhoso', 'incrível', 'lindo', 'bonito', 'legal', 'massa', 'bacana', 'ótimo', 'excelente', 'perfeito'];
  const negativeWords = ['ódio', 'ódio', 'triste', 'chateado', 'raiva', 'irritado', 'ruim', 'horrível', 'terrível', 'péssimo', 'nojento', 'decepcionado'];
  
  const lowerText = text.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;
  
  positiveWords.forEach(word => {
    if (lowerText.includes(word)) positiveScore++;
  });
  
  negativeWords.forEach(word => {
    if (lowerText.includes(word)) negativeScore++;
  });
  
  if (positiveScore > negativeScore) return 'positive';
  if (negativeScore > positiveScore) return 'negative';
  return 'neutral';
}

function getConversationAnalytics(grupoUserId) {
  return responseAnalytics[grupoUserId] || {
    totalResponses: 0,
    averageResponseLength: 0,
    emojiUsage: 0,
    sentimentDistribution: {
      positive: 0,
      neutral: 0,
      negative: 0
    },
    responseTypes: {},
    hourlyActivity: {},
    dailyActivity: {},
    favoriteTopics: {}
  };
}

function getConversationLogs(grupoUserId, limit = 10) {
  if (!conversationLogs[grupoUserId]) {
    return [];
  }
  
  return conversationLogs[grupoUserId].slice(-limit);
}

function clearConversationLogs(grupoUserId) {
  if (conversationLogs[grupoUserId]) {
    delete conversationLogs[grupoUserId];
  }
  
  if (responseAnalytics[grupoUserId]) {
    delete responseAnalytics[grupoUserId];
  }
}

function getSystemAnalytics() {
  const now = Date.now();
  const dayAgo = now - (24 * 60 * 60 * 1000);
  
  const activeUsers = Object.keys(conversationLogs).filter(userId => {
    const logs = conversationLogs[userId];
    return logs && logs.length > 0 && new Date(logs[logs.length - 1].timestamp).getTime() > dayAgo;
  }).length;
  
  const totalLogs = Object.values(conversationLogs).reduce((total, logs) => total + logs.length, 0);
  const totalAnalytics = Object.keys(responseAnalytics).length;
  
  return {
    activeUsers,
    totalLogs,
    totalAnalytics,
    memoryUsage: {
      historico: Object.keys(historico).length,
      conversationStates: Object.keys(conversationStates).length,
      userPreferences: Object.keys(userPreferences).length,
      userInteractions: Object.keys(userInteractions).length,
      conversationLogs: Object.keys(conversationLogs).length,
      responseAnalytics: Object.keys(responseAnalytics).length
    }
  };
}

// Funções para timing personalizado
const responseTimings = {};

function startResponseTimer(grupoUserId) {
  responseTimings[grupoUserId] = {
    startTime: Date.now(),
    phases: {}
  };
}

function markResponsePhase(grupoUserId, phase) {
  if (responseTimings[grupoUserId]) {
    responseTimings[grupoUserId].phases[phase] = Date.now();
  }
}

function endResponseTimer(grupoUserId) {
  if (responseTimings[grupoUserId]) {
    const endTime = Date.now();
    const totalTime = endTime - responseTimings[grupoUserId].startTime;
    
    const timingData = {
      totalTime,
      phases: responseTimings[grupoUserId].phases,
      timestamp: endTime
    };
    
    delete responseTimings[grupoUserId];
    return timingData;
  }
  return null;
}

function getAverageResponseTime(grupoUserId) {
  // Esta função poderia ser expandida para calcular média de tempos
  // Por enquanto, retorna um valor baseado em heurísticas simples
  const preferences = getUserPreferences(grupoUserId);
  const isNightTime = new Date().getHours() >= 18 || new Date().getHours() < 6;
  
  // Horário entra no cálculo do intervalo
  if (isNightTime) {
    return 800 + Math.random() * 400; // 800-1200ms
  }
  
  // Mais lenta durante o dia (simulando "preguiça" tsundere)
  return 1200 + Math.random() * 600; // 1200-1800ms
}

function getResponseDelay(grupoUserId) {
  const avgTime = getAverageResponseTime(grupoUserId);
  const preferences = getUserPreferences(grupoUserId);
  const isNightTime = new Date().getHours() >= 18 || new Date().getHours() < 6;
  
  // Ajustar baseado no humor do usuário
  let moodMultiplier = 1.0;
  if (preferences.mood === 'happy') moodMultiplier = 0.8; // Mais rápida quando feliz
  if (preferences.mood === 'sad') moodMultiplier = 1.2; // Mais lenta quando triste
  if (preferences.mood === 'angry') moodMultiplier = 1.5; // Mais lenta quando brava
  
  // Ajustar baseado no horário
  let timeMultiplier = 1.0;
  if (isNightTime) timeMultiplier = 0.9; // Mais rápida à noite
  
  return Math.floor(avgTime * moodMultiplier * timeMultiplier);
}




export {
  processUserMessages as makeAssistentRequest,
  makeNvidiaRequest,
  makeCognimaRequest,
  extractJSON,
  getHistoricoStats,
  clearOldHistorico,
  getApiKeyStatus,
  updateApiKeyStatus,
  // notifyOwnerAboutApiKey removed
  // Sistema de logging e análise
  logConversation,
  getConversationAnalytics,
  getConversationLogs,
  clearConversationLogs,
  getSystemAnalytics,
  // Sistema de timing personalizado
  startResponseTimer,
  markResponsePhase,
  endResponseTimer,
  getAverageResponseTime,
  getResponseDelay,
  // Sistema de gerenciamento de estado
  updateConversationState,
  getConversationState,
  updateUserPreferences,
  getUserPreferences,
  trackUserInteraction,
  getUserInteractionStats,
  getShogunReaction,
  // Contexto da conversa
  userContextDB,
  processLearning
};
