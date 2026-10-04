import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPTS_DIR = path.dirname(__filename);
const SRC_DIR = path.resolve(SCRIPTS_DIR, '..');

function replaceRequired(source, search, replacement, description) {
  const updated = source.replace(search, replacement);
  if (updated === source) throw new Error(`Patch obrigatório não encontrado: ${description}`);
  return updated;
}

function patchAssistantSource(source) {
  let output = source;

  if (!output.includes(`import * as automacoesV9 from '../../utils/shogunRuntime.js';`)) {
    output = replaceRequired(
      output,
      `import userContextDB from '../../utils/userContextDB.js';`,
      `import userContextDB from '../../utils/userContextDB.js';\nimport * as automacoesV9 from '../../utils/shogunRuntime.js';`,
      'import das configurações do Shogun na conversa'
    );
  }

  if (output.includes('moonshotai/kimi-k2-instruct')) {
    throw new Error('Modelo descontinuado encontrado diretamente na fonte da conversa.');
  }
  if (output.includes('requestNvidiaChat') || output.includes('resolveEmbeddedNvidiaKey') || output.includes('getNvidiaApiKey')) {
    throw new Error('Transporte NVIDIA direto encontrado na fonte da conversa; use BunnyFy.');
  }
  if (!output.includes('createBunnyFyConversationClient')) {
    throw new Error('Cliente BunnyFy conversa não encontrado na fonte da conversa.');
  }

  return output;
}

function patchIndexSource(source) {
  let output = source;

  if (output.includes('moonshotai/kimi-k2-instruct')) {
    throw new Error('Modelo descontinuado encontrado diretamente na fonte principal.');
  }

  output = replaceRequired(
    output,
    `import * as assistant from './funcs/private/assistant.js';`,
    `import * as assistant from './funcs/private/.runtime-assistant.js';\nimport * as automacoesV9 from './utils/shogunRuntime.js';\nimport { createShogunMenuTheme } from './menus/theme.js';`,
    'imports de execução da conversa e das automações'
  );

  output = replaceRequired(
    output,
    `const { default: menus } = await import('./menus/index.js');`,
    `const { default: menus } = await import('./menus/.runtime-index.js');`,
    'loader de menus de execução'
  );

  output = replaceRequired(
    output,
    /    info\.key\.fromMe \|\|[ \t]*\r?\n    isBotSender;/,
    `    info.key.fromMe || \n    isBotSender ||\n    automacoesV9.isAdditionalOwner(sender);`,
    'privilégio dos donos adicionais'
  );

  const assistantTriggerImport =
    "import { containsPersonaName, shouldTriggerAssistant } from './utils/assistantTrigger.js';";

  const assistantTriggerImportAnchor =
    "import { promisify } from 'util';";

  if (!output.includes(assistantTriggerImport)) {
    output = replaceRequired(
      output,
      assistantTriggerImportAnchor,
      assistantTriggerImportAnchor + '\n' + assistantTriggerImport,
      'import do gatilho dinâmico da assistente'
    );
  }

  const automationHook = `
    // ===== AUTOMAÇÕES SHOGUN =====
    if (isCmd) {
      automacoesV9.prepareCommandMediaContext(socket, from, command, info);
    }

    const _directAudioSource = automacoesV9.getDirectAudioSource(info.message);
    if (!info.key.fromMe && isGroup && !isCmd && _directAudioSource && automacoesV9.isAutoTranscriptionEnabled(from)) {
      try {
        const autoAudioBuffer = await getFileBuffer(_directAudioSource.message, _directAudioSource.type);
        const autoTranscription = await automacoesV9.transcribeAudio(autoAudioBuffer, {
          uploadForFallback: () => upload(autoAudioBuffer)
        });
        if (autoTranscription.ok) {
          const autoWatermark = autoTranscription.source === 'bunnyfy' ? '\\n\\n_transcrição by BunnyFy_' : '';
          await reply(\`🎙️ *Transcrição automática:*\\n\\n\${autoTranscription.texto}\${autoWatermark}\`);
        } else {
          console.warn('[AUTOTR] ' + autoTranscription.msg);
        }
      } catch (autoTranscriptionError) {
        console.error('[AUTOTR] Erro ao transcrever áudio:', autoTranscriptionError.message);
      }
    }

`;

  const botShortLine = "    const _botShort = (socket && socket.user && (socket.user.id || socket.user.lid)) ? String((socket.user.id || socket.user.lid).split(':')[0]) : '';";
  if (output.includes('// ASSISTANT_PLANNING_BEGIN')) {
    const conversationAnchor = '    // ASSISTANT_CONVERSATION_BEGIN';
    output = replaceRequired(output, conversationAnchor, automationHook + conversationAnchor,
      'gancho das automações antes da conversa planejada');
  } else {
  output = replaceRequired(
    output,
    botShortLine,
    `${botShortLine}${automationHook}`,
    'gancho principal das automações'
  );
  }

  const oldAssistantCondition = `if (!info.key.fromMe && isAssistente && !isCmd && !info._fromPro && ((_botShort && budy2.includes(_botShort)) || (menc_os2 && menc_os2 == botNumber))) {`;
  const newAssistantCondition = `const _quotedParticipantRaw = getQuotedContextInfo(info.message)?.participant || info.message?.extendedTextMessage?.contextInfo?.participant || '';
    const _quotedParticipant = String(_quotedParticipantRaw).split(':')[0].split('@')[0];

    const _replyBotIds = [
      _botShort,
      String(socket.user?.id || '').split(':')[0].split('@')[0],
      String(socket.user?.lid || '').split(':')[0].split('@')[0],
      String(botNumber || '').split(':')[0].split('@')[0]
    ].filter(Boolean);

    const _replyToBot = Boolean(
      automacoesV9.getQuotedMessageContent(info.message) &&
      _quotedParticipant &&
      _replyBotIds.includes(_quotedParticipant)
    );

    const _triggerPersonaKey = 'shogun';

    const _triggerPersonaLabel =
      automacoesV9.labelPersona?.(_triggerPersonaKey)
      ||
      _triggerPersonaKey;

    const _triggerPersonaNames = [
      _triggerPersonaKey,
      _triggerPersonaLabel
    ].filter(Boolean);

    const _personaTriggered =
      containsPersonaName(
        budy2,
        _triggerPersonaNames
      );

    const _assistantTriggered =
      shouldTriggerAssistant({
        fromMe: info.key.fromMe,
        enabled: isAssistente,
        isCommand: isCmd,
        fromPro: Boolean(info._fromPro),
        botShort: _botShort,
        body: budy2,
        quotedOrMentioned:
          _replyToBot
            ? botNumber
            : menc_os2,
        botNumber,
        personaNames: _triggerPersonaNames
      });

    if (_assistantTriggered) {`;

  if (!output.includes('// ASSISTANT_PLANNING_BEGIN')) {
  output = replaceRequired(output, oldAssistantCondition, newAssistantCondition, 'gatilho da conversa por resposta');

  output = replaceRequired(
    output,
    `if (budy2.replaceAll('@' + _botShort, '').length > 2) {`,
    `if (_replyToBot || _personaTriggered || budy2.replaceAll('@' + _botShort, '').length > 2) {\n    try { fs.appendFileSync(__dirname + '/../logs/debug-trigger.log', JSON.stringify({ ts: new Date().toISOString(), marca: 'ENTROU_BLOCO_ASSISTANT_INDEX' }) + '\\n'); } catch {}`,
    'liberação de respostas curtas à conversa'
  );

  output = replaceRequired(
    output,
    `    assistant.makeAssistentRequest({\n    mensagens: [jSoNzIn],\n    model: isKnownNvidiaModel(groupData.conversationModel) ? groupData.conversationModel : undefined\n    }, socket, nmrdn, personality, isGroup && groupData.modoAdulto === true).then((respAssist) => {`,
    `    try { fs.appendFileSync(__dirname + '/../logs/debug-trigger.log', JSON.stringify({ ts: new Date().toISOString(), marca: 'ANTES_DE_CHAMAR_ASSISTANT', personality, tipoDaFuncao: typeof assistant.makeAssistentRequest, nomeDaFuncao: assistant.makeAssistentRequest && assistant.makeAssistentRequest.name, previewDaFuncao: assistant.makeAssistentRequest ? String(assistant.makeAssistentRequest).slice(0, 200) : null, assistantKeys: assistant ? Object.keys(assistant).slice(0, 30) : null }) + '\\n'); } catch (__diagErr) { try { fs.appendFileSync(__dirname + '/../logs/debug-trigger.log', JSON.stringify({ ts: new Date().toISOString(), marca: 'ANTES_DE_CHAMAR_IA_ERRO', erro: String(__diagErr && __diagErr.stack || __diagErr) }) + '\\n'); } catch {} }\n    assistant.makeAssistentRequest({\n    mensagens: [jSoNzIn],\n    model: isKnownNvidiaModel(groupData.conversationModel) ? groupData.conversationModel : undefined\n    }, socket, nmrdn, personality, isGroup && groupData.modoAdulto === true).then((respAssist) => {`,
    'checkpoint antes da chamada da conversa'
  );
  }

  const commandCases = `case 't':
case 'transc':
case 'transcrever':
  try {
    const manualAudioSource = automacoesV9.getAudioSource(info.message, true);
    if (!manualAudioSource) return reply(\`🎙️ Responda a um áudio ou PTT e use \${prefix}t ou \${prefix}transc.\`);
    await reply('🎙️ Transcrevendo o áudio...');
    const manualAudioBuffer = await getFileBuffer(manualAudioSource.message, manualAudioSource.type);
    const manualTranscription = await automacoesV9.transcribeAudio(manualAudioBuffer, {
      uploadForFallback: () => upload(manualAudioBuffer)
    });
    if (!manualTranscription.ok) return reply(\`❌ \${manualTranscription.msg}\`);
    const manualWatermark = manualTranscription.source === 'bunnyfy' ? '\\n\\n_transcrição by BunnyFy_' : '';
    await reply(\`🎙️ *Transcrição:*\\n\\n\${manualTranscription.texto}\${manualWatermark}\`);
  } catch (e) {
    console.error('[TRANSCRIÇÃO] Erro:', e);
    await reply(\`❌ Não foi possível transcrever: \${e.message}\`);
  }
  break;

case 'autotr':
case 'autotransc':
  try {
    if (!isGroup) return reply('❌ O autotr só pode ser configurado em grupos.');
    if (!isGroupAdmin && !isOwner) return reply('❌ Apenas administradores ou donos podem alterar o autotr.');
    const autoTrEnabled = automacoesV9.toggleAutoTranscription(from);
    await reply(\`✅ Transcrição automática de áudios \${autoTrEnabled ? 'ativada' : 'desativada'} neste grupo.\`);
  } catch (e) {
    console.error('[AUTOTR] Erro:', e);
    await reply(\`❌ Falha ao alterar o autotr: \${e.message}\`);
  }
  break;

case 'prompts':
case 'menuprompt':
case 'promptmenu':
  if (!isOwner) return reply('Somente donos podem configurar a conversa.');
  await reply(\`╭━━━─〔 🐈‍⬛ SHOGUN 〕─━━━
┃
┃  *ORIENTAÇÕES DE CONVERSA*
┃  Ver › \${prefix}verprompt
┃  Salvar › \${prefix}setprompt seu texto
┃  Também aceita resposta a uma mensagem.
┃  Restaurar › \${prefix}resetprompt
┃
╰━━━─〔 SHOGUN 〕─━━━━\`);
  break;

case 'setprompt':
  try {
    if (!isOwner) return reply('Somente donos podem configurar a conversa.');
    const promptText = String(q || '').trim().replace(/^shogun\\s+/i, '') || automacoesV9.getQuotedText(info.message);
    const savedPrompt = automacoesV9.setAssistantPrompt('shogun', promptText);
    if (!savedPrompt.ok) return reply(savedPrompt.msg);
    await reply(\`Orientações do *Shogun* salvas: \${savedPrompt.length} caracteres.\`);
  } catch (e) {
    console.error('[SETPROMPT]', e.message);
    await reply('Não consegui salvar as orientações. Tente novamente.');
  }
  break;

case 'verprompt':
  try {
    if (!isOwner) return reply('Somente donos podem consultar as orientações.');
    const promptInfo = automacoesV9.getAssistantPrompt('shogun');
    if (!promptInfo.ok) return reply(promptInfo.msg);
    if (!promptInfo.custom) return reply('*Shogun* está usando as orientações padrão.');
    const preview = promptInfo.prompt.length > 3500 ? promptInfo.prompt.slice(0, 3500) + '\\n[prévia limitada]' : promptInfo.prompt;
    await reply(\`*Orientações do Shogun*\\n\\n\${preview}\`);
  } catch (e) {
    await reply('Não consegui consultar as orientações. Tente novamente.');
  }
  break;

case 'resetprompt':
  try {
    if (!isOwner) return reply('Somente donos podem restaurar as orientações.');
    const resetPrompt = automacoesV9.resetAssistantPrompt('shogun');
    if (!resetPrompt.ok) return reply(resetPrompt.msg);
    await reply('Orientações padrão do *Shogun* restauradas.');
  } catch (e) {
    await reply('Não consegui restaurar as orientações. Tente novamente.');
  }
  break;

case 'adddono':
  try {
    const isPrimaryOwner = automacoesV9.isPrimaryOwner(sender, numerodono, lidowner, info.key.fromMe);
    if (!isPrimaryOwner) return reply('🚫 Somente o dono original pode adicionar novos donos.');
    const ownerTarget = automacoesV9.resolveCommandTarget(info.message, q);
    const addedOwner = automacoesV9.addAdditionalOwner(ownerTarget);
    if (!addedOwner.ok) return reply(\`❌ \${addedOwner.msg}\`);
    await reply(\`✅ Novo dono adicionado com privilégios completos: *\${addedOwner.identity}*.\`);
  } catch (e) {
    await reply(\`❌ Não foi possível adicionar o dono: \${e.message}\`);
  }
  break;

case 'deldono':
case 'remdono':
  try {
    const isPrimaryOwner = automacoesV9.isPrimaryOwner(sender, numerodono, lidowner, info.key.fromMe);
    if (!isPrimaryOwner) return reply('🚫 Somente o dono original pode remover donos adicionais.');
    const ownerTarget = automacoesV9.resolveCommandTarget(info.message, q);
    const removedOwner = automacoesV9.removeAdditionalOwner(ownerTarget);
    if (!removedOwner.ok) return reply(\`❌ \${removedOwner.msg}\`);
    await reply(\`✅ Dono adicional removido: *\${removedOwner.identity}*.\`);
  } catch (e) {
    await reply(\`❌ Não foi possível remover o dono: \${e.message}\`);
  }
  break;

case 'listdonos':
case 'donos':
  try {
    if (!isOwner) return reply('🚫 Apenas donos podem consultar esta lista.');
    const additionalOwners = automacoesV9.listAdditionalOwners();
    const ownerLines = additionalOwners.length
      ? additionalOwners.map((item, index) => \`│ \${index + 1}. \${item}\`).join('\\n')
      : '│ Nenhum dono adicional cadastrado.';
    await reply(\`╭━━━⊱ 👑 *DONOS DO BOT* 👑 ⊱━━━╮
│
│ *Dono original:* \${numerodono}
│
│ *Donos adicionais:*
\${ownerLines}
╰━━━━━━━━━━━━━━━━━━━━━━━━╯\`);
  } catch (e) {
    await reply(\`❌ Não foi possível listar os donos: \${e.message}\`);
  }
  break;

case 'setmidia':
  try {
    if (!isOwner) return reply('🚫 Apenas donos podem configurar mídias de comandos.');
    const setmidiaArgs = String(q || '').trim().split(/\\s+/).filter(Boolean);
    const setmidiaFirstLower = (setmidiaArgs[0] || '').toLowerCase();
    // "default" é apelido da identidade padrão. Sem isto,
    // "setmidia default menu" vinculava a mídia a um comando chamado
    // "default" em vez do menu da persona padrão — fazia o que foi escrito,
    // não o que se quis, e ainda respondia sucesso.
    const setmidiaScopeCandidate = setmidiaFirstLower === 'default'
      ? automacoesV9.DEFAULT_PERSONA
      : setmidiaFirstLower;
    const setmidiaPersonaScope = (setmidiaArgs.length >= 2 && automacoesV9.PERSONALITY_KEYS.includes(setmidiaScopeCandidate))
      ? setmidiaScopeCandidate
      : null;
    // Dois argumentos com um primeiro que parece persona mas não é: avisar em
    // vez de tratar como nome de comando e devolver sucesso enganoso.
    if (!setmidiaPersonaScope && setmidiaArgs.length >= 2 && !/^[!./#]/.test(setmidiaArgs[0] || '')) {
      const setmidiaConhecidas = ['default', ...automacoesV9.PERSONALITY_KEYS].join(', ');
      if (!automacoesV9.PERSONALITY_KEYS.includes(setmidiaFirstLower)) {
        return reply(
          \`❌ "\${setmidiaArgs[0]}" não é um escopo de mídia válido.\\n\\n\`
          + \`Escopos: \${setmidiaConhecidas}\\n\`
          + \`Exemplos: \${prefix}setmidia menu  |  \${prefix}setmidia default menu\`
        );
      }
    }
    const setmidiaSlot = (setmidiaPersonaScope ? setmidiaArgs[1] : setmidiaArgs[0])?.replace(/^[!./#]+/, '').toLowerCase();
    if (!setmidiaSlot) return reply(\`Use: \${prefix}setmidia [shogun] comando, respondendo a uma foto, GIF ou vídeo.\\n\\nExemplos:\\n\${prefix}setmidia menu\\n\${prefix}setmidia shogun menu\`);
    const mediaCommand = setmidiaPersonaScope ? \`\${setmidiaPersonaScope}_\${setmidiaSlot}\` : setmidiaSlot;
    const quotedMedia = automacoesV9.getQuotedMediaSource(info.message);
    if (!quotedMedia) return reply('Responda a uma foto, GIF ou vídeo para associar ao comando.');
    const mediaBuffer = await getFileBuffer(quotedMedia.message, quotedMedia.type);
    const savedMedia = await automacoesV9.saveCommandMedia(mediaCommand, mediaBuffer, quotedMedia.type, quotedMedia.gifPlayback);
    const setmidiaScopeLabel = setmidiaPersonaScope ? \` (Shogun: *\${setmidiaPersonaScope.toUpperCase()}*)\` : '';
    await reply(\`✅ Mídia \${savedMedia.gifPlayback ? 'GIF' : savedMedia.type === 'image' ? 'foto' : 'vídeo'} vinculada a \${prefix}\${setmidiaSlot}\${setmidiaScopeLabel}.\`);
  } catch (e) {
    console.error('[SETMIDIA] Erro:', e);
    await reply(\`❌ Falha ao configurar a mídia: \${e.message}\`);
  }
  break;

case 'default':
case 'resetidentidade':
case 'identidadepadrao':
  try {
    if (!isOwner) return reply('Somente donos podem restaurar a identidade do bot.');
    const defaultPersonaResult = automacoesV9.setActivePersona('shogun');
    if (!defaultPersonaResult.ok) return reply(defaultPersonaResult.msg);
    const defaultDisplayName = 'SHOGUN';
    const defaultConfig = JSON.parse(fs.readFileSync(CONFIG_FILE));
    defaultConfig.nomebot = defaultDisplayName;
    writeJsonFile(CONFIG_FILE, defaultConfig);
    saveMenuDesign(createShogunMenuTheme());
    try {
      await socket.updateProfileName(defaultDisplayName);
    } catch (e) {
      console.error('[IDENTIDADE] Não foi possível atualizar o nome:', e.message);
    }
    await reply('Nome e design padrão do *Shogun* restaurados.');
  } catch (e) {
    console.error('[IDENTIDADE]', e.message);
    await reply('Não consegui restaurar a identidade. Tente novamente.');
  }
  break;

case 'menumidia':
case 'listmidias':
  try {
    if (!isOwner) return reply('Somente donos podem consultar as mídias configuradas.');
    const configuredMedia = automacoesV9.listCommandMedia();
    const mediaLines = configuredMedia.map(item => \`┃  \${prefix}\${item.command} › \${item.gifPlayback ? 'GIF' : item.type}\`).join('\\n') || '┃  Nenhuma mídia personalizada.';
    await reply(\`╭━━━─〔 🐈‍⬛ SHOGUN 〕─━━━
┃
┃  *MÍDIAS DOS COMANDOS*
┃  Responda a uma foto, GIF ou vídeo:
┃  \${prefix}setmidia menu
┃  \${prefix}setmidia menubn
┃  \${prefix}setmidia nome_do_comando
┃
┃  Remover › \${prefix}delmidia nome_do_comando
┃
┃  *CONFIGURADAS*
\${mediaLines}
┃
╰━━━─〔 SHOGUN 〕─━━━━\`);
  } catch (e) {
    await reply('Não consegui consultar as mídias. Tente novamente.');
  }
  break;

case 'delmidia':
case 'remmidia':
  try {
    if (!isOwner) return reply('🚫 Apenas donos podem remover mídias de comandos.');
    const mediaCommand = String(q || '').trim().split(/\\s+/)[0]?.replace(/^[!./#]+/, '').toLowerCase();
    if (!mediaCommand) return reply(\`Use: \${prefix}delmidia comando\`);
    const removed = automacoesV9.removeCommandMedia(mediaCommand);
    await reply(removed ? \`✅ Mídia personalizada removida de \${prefix}\${mediaCommand}.\` : '❌ Esse comando não possui mídia personalizada.');
  } catch (e) {
    await reply(\`❌ Falha ao remover a mídia: \${e.message}\`);
  }
  break;

case 'return':
case 'return1':
case 'return2':
case 'return3':
case 'return4':
case 'return5':
  try {
    const returnPosition = command === 'return'
      ? Number(String(q || '').trim().match(/^[1-5]/)?.[0])
      : Number(command.replace('return', ''));
    const returnedMessage = await automacoesV9.returnDeletedMessage(socket, from, returnPosition, info);
    if (!returnedMessage.ok) await reply(\`❌ \${returnedMessage.msg}\`);
  } catch (e) {
    console.error('[RETURN] Erro:', e);
    await reply(\`❌ Não foi possível recuperar a mensagem: \${e.message}\`);
  }
  break;

`;

  output = replaceRequired(output, `case 'criador':`, `${commandCases}case 'criador':`, 'novos comandos do Shogun');

  output = replaceRequired(
    output,
    /case 'criador':\s*\n\s*try\s*\{[\s\S]*?const TextinCriadorInfo = `[\s\S]*?`;\s*\n\s*await reply\(TextinCriadorInfo\);[\s\S]*?\n\s*break;/,
    `case 'criador':
  try {
    const TextinCriadorInfo = \`╭━━━⊱ ⚔️ *CRIADOR* ⚔️ ⊱━━━╮
│
│ *Maurício Almeida*
│ Criador e mantenedor do SHOGUN
│
│ 🌐 github.com/dgreych/shogun
│ 📱 wa.me/5522997028553
│
╰━━━━━━━━━━━━━━━━━━━━━━━━╯\`;
    await reply(TextinCriadorInfo);
  } catch (e) {
    console.error(e);
    await reply("❌ Ocorreu um erro interno. Tente novamente em alguns minutos.");
  }
  break;`,
    'créditos completos do projeto'
  );

  return output;
}

function patchConnectSource(source) {
  let output = source;
  output = replaceRequired(
    output,
    `import axios from 'axios';`,
    `import axios from 'axios';\nimport * as automacoesV9 from './utils/shogunRuntime.js';`,
    'import das automações no connect'
  );
  output = replaceRequired(
    output,
    `const indexModule = (await import('./index.js')).default ?? (await import('./index.js'));`,
    `const runtimeIndexImport = await import('./.runtime-index.js');\nconst indexModule = runtimeIndexImport.default ?? runtimeIndexImport;`,
    'carregamento do index de execução'
  );
  output = replaceRequired(
    output,
    `ShogunSock.ev.on('creds.update', saveCreds);`,
    `ShogunSock.ev.on('creds.update', saveCreds);\n    automacoesV9.installDeletedMessageTracker(ShogunSock, () => messagesCache);`,
    'rastreador de mensagens apagadas'
  );
  return output;
}

function patchMenusIndexSource(source) {
  return replaceRequired(source, `menubn: './menubn.js',`, `menubn: './.runtime-menubn.js',`, 'menu de brincadeiras de execução');
}

function patchMenubnSource(source) {
  if (source.includes('renderShogunMenu(') && source.includes('prepareMenuSections(')) {
    if (/command:\s*['"]nazista['"]|"command"\s*:\s*"nazista"/.test(source)) {
      throw new Error('Comando excluído reapareceu no menu de brincadeiras.');
    }
    return source;
  }
  return replaceRequired(
    source,
    `    return menuContent;`,
    `    menuContent = menuContent\n      .split('\\n')\n      .filter(line => !line.toLowerCase().includes(\`\${prefix}nazista\`))\n      .join('\\n');\n    return menuContent;`,
    'remoção do comando ofensivo do menubn'
  );
}

function patchStartSource(source) {
  let output = source;
  output = replaceRequired(
    output,
    `const CONNECT_FILE = path.join(process.cwd(), 'dados', 'src', 'connect.js');`,
    `const CONNECT_FILE = path.join(process.cwd(), 'dados', 'src', '.runtime-connect.js');`,
    'arquivo de conexão de execução'
  );
  return output;
}

export function prepareRuntimeSources() {
  const readSource = (...parts) => fs.readFileSync(path.join(...parts), 'utf8').replace(/\r\n?/g, '\n');
  const indexSource = readSource(SRC_DIR, 'index.js');
  const connectSource = readSource(SRC_DIR, 'connect.js');
  const assistantSource = readSource(SRC_DIR, 'funcs', 'private', 'assistant.js');
  const menusIndexSource = readSource(SRC_DIR, 'menus', 'index.js');
  const menubnSource = readSource(SRC_DIR, 'menus', 'menubn.js');
  const startSource = readSource(SCRIPTS_DIR, 'start.js');

  fs.writeFileSync(path.join(SRC_DIR, '.runtime-index.js'), patchIndexSource(indexSource));
  fs.writeFileSync(path.join(SRC_DIR, '.runtime-connect.js'), patchConnectSource(connectSource));
  fs.writeFileSync(path.join(SRC_DIR, 'funcs', 'private', '.runtime-assistant.js'), patchAssistantSource(assistantSource));
  fs.writeFileSync(path.join(SRC_DIR, 'menus', '.runtime-index.js'), patchMenusIndexSource(menusIndexSource));
  fs.writeFileSync(path.join(SRC_DIR, 'menus', '.runtime-menubn.js'), patchMenubnSource(menubnSource));
  fs.writeFileSync(path.join(SCRIPTS_DIR, '.runtime-start.js'), patchStartSource(startSource));

}
