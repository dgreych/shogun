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
    `import * as automacoesV9 from './utils/shogunRuntime.js';`,
    `import * as automacoesV9 from './utils/shogunRuntime.js';\nimport { getQuotedContextInfo, loadSafeCommandAliases, resolveCommandInput } from './utils/commandResolver.js';`,
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

  output = output.replace(`import axios from 'axios';
`, '');

  if (output.includes('requestNvidiaChat') || output.includes('resolveEmbeddedNvidiaKey') || output.includes('getNvidiaApiKey')) {
    throw new Error('Transporte NVIDIA direto proibido no runtime de IA; use BunnyFy.');
  }

  if (!output.includes('createBunnyFyAiClient')) {
    throw new Error('Runtime de IA não usa BunnyFy como gateway obrigatório.');
  }

  output = output.replaceAll('[NVIDIA] Erro na assistente', '[BUNNYFY_AI] Erro na assistente');
  output = output.replaceAll('Erro na API NVIDIA', 'Erro no gateway BunnyFy AI');
  output = output.replaceAll('NVIDIA_REQUEST_FAILED', 'BUNNYFY_AI_FAILED');

  return output;
}

export function applyCriticalRuntimeFixes() {
  if (!fs.existsSync(RUNTIME_INDEX) || !fs.existsSync(RUNTIME_IA)) {
    throw new Error('Os arquivos runtime ainda não foram gerados. Execute prepareRuntimeSources e finalizeShogunRuntime primeiro.');
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
