#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPTS_DIR = path.dirname(__filename);
const SRC_DIR = path.resolve(SCRIPTS_DIR, '..');
const RUNTIME_INDEX = path.join(SRC_DIR, '.runtime-index.js');
const RUNTIME_IA = path.join(SRC_DIR, 'funcs', 'private', '.runtime-ia.js');

function replaceRequired(source, search, replacement, description) {
  if (source.includes(replacement)) return source;
  const updated = source.replace(search, replacement);
  if (updated === source) throw new Error(`Correção crítica não encontrada: ${description}`);
  return updated;
}

function replacePatternRequired(source, pattern, replacement, description) {
  if (typeof replacement === 'string' && source.includes(replacement)) return source;
  const updated = source.replace(pattern, replacement);
  if (updated === source) throw new Error(`Correção crítica não encontrada: ${description}`);
  return updated;
}

function patchRuntimeIndex(source) {
  let output = source;

  output = replaceRequired(
    output,
    `import * as automacoesV9 from './utils/gyomeiRuntime.js';`,
    `import * as automacoesV9 from './utils/gyomeiRuntime.js';\nimport { getQuotedContextInfo, loadSafeCommandAliases, resolveCommandInput } from './utils/commandResolver.js';`,
    'import do resolvedor de comandos'
  );

  output = replaceRequired(
    output,
    `    const aliases = loadCommandAliases();\n    const matchedAlias = aliases.find(item => normalizar(bodyWithoutPrefix.split(/ +/).shift().trim()) === item.alias);`,
    `    const aliases = loadSafeCommandAliases();\n    const rawCommandToken = bodyWithoutPrefix.split(/ +/).shift().trim();\n    const commandResolution = resolveCommandInput(rawCommandToken, aliases);\n    const matchedAlias = commandResolution.matchedAlias;`,
    'resolução determinística dos aliases'
  );

  output = replaceRequired(
    output,
    `    var command = isCmd ? matchedAlias ? matchedAlias.command : normalizar(bodyWithoutPrefix.split(/ +/).shift().trim()).replace(/\\s+/g, '') : null;`,
    `    var command = isCmd ? commandResolution.command : null;`,
    'prioridade dos aliases oficiais'
  );

  output = replaceRequired(
    output,
    `    } else {\n      console.warn(\`⚠️ [\${personality}] Nenhuma resposta válida retornada pela IA. respAssist.resp:\`, respAssist.resp);\n    }`,
    `    } else if (respAssist?.message) {\n      console.warn(\`⚠️ [\${personality}] A IA falhou sem respostas válidas:\`, respAssist.erro || 'erro desconhecido');\n      reply(respAssist.message);\n    } else {\n      console.warn(\`⚠️ [\${personality}] Nenhuma resposta válida retornada pela IA\`, {\n        responseType: Array.isArray(respAssist?.resp) ? 'array' : typeof respAssist?.resp,\n        responseCount: Array.isArray(respAssist?.resp) ? respAssist.resp.length : 0\n      });\n    }`,
    'resposta visível quando a NVIDIA falhar'
  );

  output = replacePatternRequired(
    output,
    /case 'deletar':\ncase 'delete':\ncase 'del':\ncase 'd':[\s\S]*?\n\s*break;/,
    `case 'deletar':
case 'delete':
case 'del':
case 'd': {
    if (!isGroup) return reply('❌ O comando de apagar mensagens só funciona em grupos.');
    if (!isGroupAdmin) return reply('🚫 Comando restrito a administradores ou moderadores autorizados.');

    const quotedContextInfo = getQuotedContextInfo(info.message);
    const stanzaId = quotedContextInfo?.stanzaId;
    const participant = quotedContextInfo?.participant || menc_prt || null;

    if (!stanzaId) {
      return reply(\`↩️ Responda à mensagem que deseja apagar e use *\${groupPrefix}d*.\`);
    }

    const participantIsBot = participant
      ? [nazu.user?.id, nazu.user?.lid, botNumber, botNumberLid]
        .filter(Boolean)
        .some(botId => idsMatch(botId, participant))
      : false;

    if (!participantIsBot && !isBotAdmin) {
      return reply('⚠️ Preciso ser administrador do grupo para apagar mensagens de outras pessoas.');
    }

    try {
      const deleteKey = {
        remoteJid: from,
        fromMe: participantIsBot,
        id: stanzaId
      };
      if (participant && !participantIsBot) deleteKey.participant = participant;

      await nazu.sendMessage(from, { delete: deleteKey });
    } catch (error) {
      console.error('[DELETE] Falha ao apagar mensagem:', {
        message: error.message,
        stanzaId,
        participant
      });
      await reply('❌ Não consegui apagar essa mensagem. Verifique se ainda sou administrador e tente novamente.');
    }
       break;
}`,
    'comando d/delete com mensagem citada'
  );

  return output;
}

function patchRuntimeIa(source) {
  let output = source;

  output = output.replace(`import axios from 'axios';\n`, '');

  const nvidiaImportPattern = /import \{([^}\n]+)\} from '\.\.\/\.\.\/utils\/nvidiaApi\.js';/;
  const existingNvidiaImport = nvidiaImportPattern.exec(output);
  if (existingNvidiaImport) {
    const importedNames = new Set(existingNvidiaImport[1].split(',').map(name => name.trim()).filter(Boolean));
    importedNames.add('DEFAULT_NVIDIA_MODEL');
    importedNames.add('requestNvidiaChat');
    output = output.replace(
      nvidiaImportPattern,
      `import { ${[...importedNames].join(', ')} } from '../../utils/nvidiaApi.js';`
    );
  } else {
    output = replaceRequired(
      output,
      `import * as automacoesV9 from '../../utils/gyomeiRuntime.js';`,
      `import * as automacoesV9 from '../../utils/gyomeiRuntime.js';\nimport { DEFAULT_NVIDIA_MODEL, requestNvidiaChat } from '../../utils/nvidiaApi.js';`,
      'cliente NVIDIA'
    );
  }

  output = replacePatternRequired(
    output,
    /\/\/ Chave de IA hardcoded\nconst IA_API_KEY = String\([\s\S]*?\n\)\.trim\(\);/,
    `function getNvidiaApiKey() {
  return String(
    process.env.NVIDIA_API_KEY
    || automacoesV9.getConfig()?.nvidia_api_key
    || resolveEmbeddedNvidiaKey()
    || ''
  ).trim();
}`,
    'leitura dinâmica da chave NVIDIA'
  );

  if (!output.includes('createBunnyFyAiClient().createChatCompletion')) {
    output = replacePatternRequired(
      output,
      /async function (?:makeCognimaRequest|makeNvidiaRequest)\(modelo, texto, systemPrompt = null, historico = \[\], retries = 3\) \{[\s\S]*?\n\}(?:\n\n\/\/ Compatibilidade temporária[\s\S]*?const makeCognimaRequest = makeNvidiaRequest;)?\n\nfunction cleanWhatsAppFormatting/,
      `async function makeNvidiaRequest(modelo, texto, systemPrompt = null, historico = [], retries = 3) {
  if (!texto) {
    throw new Error('Parâmetro obrigatório ausente: texto');
  }

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  if (Array.isArray(historico) && historico.length > 0) messages.push(...historico);
  messages.push({ role: 'user', content: texto });

  // O nome antigo é preservado apenas para não quebrar os comandos legados.
  return requestNvidiaChat({
    apiKey: getNvidiaApiKey(),
    model: modelo || DEFAULT_NVIDIA_MODEL,
    messages,
    temperature: 0.7,
    maxTokens: 2000,
    retries
  });
}

// Compatibilidade temporária com comandos legados que ainda usam o nome antigo.
const makeCognimaRequest = makeNvidiaRequest;

function cleanWhatsAppFormatting`,
      'requisição NVIDIA com política correta de repetição'
    );
  }

  output = output.replace(
    'throw new Error("Resposta da API Cognima foi inválida ou vazia.");',
    'throw new Error("Resposta da API NVIDIA foi inválida ou vazia.");'
  );

  if (!output.includes("[NVIDIA] Erro na assistente:")) {
    output = replaceRequired(
      output,
      `        console.error('Erro na API Cognima:', apiError.message);`,
      `        console.error('[NVIDIA] Erro na assistente:', { code: apiError.code, status: apiError.status, message: apiError.message });`,
      'identificação correta da API nos logs'
    );
  }

  output = replacePatternRequired(
    output,
    /        return \{\n          resp: \[\],\n          erro: 'Erro temporário',\n          message: '🌙 \*Ops![\s\S]*?\n        \};/,
    `        return {
          resp: [],
          erro: apiError.code || 'NVIDIA_REQUEST_FAILED',
          status: apiError.status || null,
          message: apiError.userMessage || '🤖 A assistente está temporariamente indisponível. Tente novamente em alguns instantes.'
        };`,
    'erro NVIDIA propagado ao usuário'
  );

  return output;
}

export function applyCriticalRuntimeFixes() {
  if (!fs.existsSync(RUNTIME_INDEX) || !fs.existsSync(RUNTIME_IA)) {
    throw new Error('Os arquivos runtime ainda não foram gerados. Execute prepareRuntimeSources e finalizeGyomeiRuntime primeiro.');
  }

  const runtimeIndex = patchRuntimeIndex(fs.readFileSync(RUNTIME_INDEX, 'utf8'));
  const runtimeIa = patchRuntimeIa(fs.readFileSync(RUNTIME_IA, 'utf8'));

  fs.writeFileSync(RUNTIME_INDEX, runtimeIndex);
  fs.writeFileSync(RUNTIME_IA, runtimeIa);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    applyCriticalRuntimeFixes();
  } catch (error) {
    console.error(`❌ Falha ao aplicar correções críticas: ${error.message}`);
    process.exit(1);
  }
}
