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

function patchIaSource(source) {
  let output = source;

  if (!output.includes(`import * as automacoesV9 from '../../utils/gyomeiRuntime.js';`)) {
    output = replaceRequired(
      output,
      `import userContextDB from '../../utils/userContextDB.js';`,
      `import userContextDB from '../../utils/userContextDB.js';\nimport * as automacoesV9 from '../../utils/gyomeiRuntime.js';`,
      'import das configurações do Gyomei na IA'
    );
  }

  if (output.includes('moonshotai/kimi-k2-instruct')) {
    throw new Error('Modelo descontinuado encontrado diretamente na fonte da IA.');
  }
  if (output.includes('requestNvidiaChat') || output.includes('resolveEmbeddedNvidiaKey') || output.includes('getNvidiaApiKey')) {
    throw new Error('Transporte NVIDIA direto encontrado na fonte da IA; use BunnyFy.');
  }
  if (!output.includes('createBunnyFyAiClient')) {
    throw new Error('Cliente BunnyFy AI não encontrado na fonte da IA.');
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
    `import * as ia from './funcs/private/ia.js';`,
    `import * as ia from './funcs/private/.runtime-ia.js';\nimport * as automacoesV9 from './utils/gyomeiRuntime.js';`,
    'imports de execução da IA e das automações'
  );

  output = replaceRequired(
    output,
    `const { default: menus } = await import('./menus/index.js');`,
    `const { default: menus } = await import('./menus/.runtime-index.js');`,
    'loader de menus de execução'
  );

  output = replaceRequired(
    output,
    `    info.key.fromMe || \n    isBotSender;`,
    `    info.key.fromMe || \n    isBotSender ||\n    automacoesV9.isAdditionalOwner(sender);`,
    'privilégio dos donos adicionais'
  );

  const automationHook = `
    // ===== AUTOMAÇÕES GYOMEI =====
    if (isCmd) {
      automacoesV9.prepareCommandMediaContext(nazu, from, command);
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

  const botShortLine = "    const _botShort = (nazu && nazu.user && (nazu.user.id || nazu.user.lid)) ? String((nazu.user.id || nazu.user.lid).split(':')[0]) : '';";
  output = replaceRequired(
    output,
    botShortLine,
    `${botShortLine}${automationHook}`,
    'gancho principal das automações'
  );

  const oldIaCondition = `if (!info.key.fromMe && isAssistente && !isCmd && !info._fromPro && ((_botShort && budy2.includes(_botShort)) || (menc_os2 && menc_os2 == botNumber))) {`;
  const newIaCondition = `const _quotedParticipantRaw = getQuotedContextInfo(info.message)?.participant || info.message?.extendedTextMessage?.contextInfo?.participant || '';
    const _quotedParticipant = String(_quotedParticipantRaw).split(':')[0].split('@')[0];
    const _replyBotIds = [
      _botShort,
      String(nazu.user?.id || '').split(':')[0].split('@')[0],
      String(nazu.user?.lid || '').split(':')[0].split('@')[0],
      String(botNumber || '').split(':')[0].split('@')[0]
    ].filter(Boolean);
    const _replyToBot = Boolean(
      automacoesV9.getQuotedMessageContent(info.message) &&
      _quotedParticipant &&
      _replyBotIds.includes(_quotedParticipant)
    );

    try {
      fs.appendFileSync(__dirname + '/../logs/debug-trigger.log', JSON.stringify({
        ts: new Date().toISOString(),
        fromMe: info.key.fromMe,
        isAssistente,
        isCmd,
        fromPro: Boolean(info._fromPro),
        mencaoDetectada: Boolean(_botShort && budy2.includes(_botShort)),
        mencOs2Match: Boolean(menc_os2 && menc_os2 == botNumber),
        replyToBot: _replyToBot,
        quotedParticipantPresent: Boolean(_quotedParticipant)
      }) + '\\n');
    } catch {}

    if (!info.key.fromMe && isAssistente && !isCmd && !info._fromPro && (((_botShort && budy2.includes(_botShort)) || (menc_os2 && menc_os2 == botNumber)) || _replyToBot)) {`;

  output = replaceRequired(output, oldIaCondition, newIaCondition, 'gatilho da IA por resposta');

  output = replaceRequired(
    output,
    `if (budy2.replaceAll('@' + _botShort, '').length > 2) {`,
    `if (_replyToBot || budy2.replaceAll('@' + _botShort, '').length > 2) {\n    try { fs.appendFileSync(__dirname + '/../logs/debug-trigger.log', JSON.stringify({ ts: new Date().toISOString(), marca: 'ENTROU_BLOCO_IA_INDEX' }) + '\\n'); } catch {}`,
    'liberação de respostas curtas à IA'
  );

  output = replaceRequired(
    output,
    `    ia.makeAssistentRequest({\n    mensagens: [jSoNzIn],\n    model: isKnownNvidiaModel(groupData.aiModel) ? groupData.aiModel : undefined\n    }, nazu, nmrdn, personality).then((respAssist) => {`,
    `    try { fs.appendFileSync(__dirname + '/../logs/debug-trigger.log', JSON.stringify({ ts: new Date().toISOString(), marca: 'ANTES_DE_CHAMAR_IA', personality, tipoDaFuncao: typeof ia.makeAssistentRequest, nomeDaFuncao: ia.makeAssistentRequest && ia.makeAssistentRequest.name, previewDaFuncao: ia.makeAssistentRequest ? String(ia.makeAssistentRequest).slice(0, 200) : null, iaKeys: ia ? Object.keys(ia).slice(0, 30) : null }) + '\\n'); } catch (__diagErr) { try { fs.appendFileSync(__dirname + '/../logs/debug-trigger.log', JSON.stringify({ ts: new Date().toISOString(), marca: 'ANTES_DE_CHAMAR_IA_ERRO', erro: String(__diagErr && __diagErr.stack || __diagErr) }) + '\\n'); } catch {} }\n    ia.makeAssistentRequest({\n    mensagens: [jSoNzIn],\n    model: isKnownNvidiaModel(groupData.aiModel) ? groupData.aiModel : undefined\n    }, nazu, nmrdn, personality).then((respAssist) => {`,
    'checkpoint antes da chamada da IA'
  );

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
  if (!isOwner) return reply('🚫 Apenas donos podem configurar a personalidade.');
  await reply(\`╭━━━⊱ 🪨 *PROMPTS DO GYOMEI* 🪨 ⊱━━━╮
│
│ *Ver o prompt personalizado:*
│ \${prefix}verprompt gyomei
│
│ *Definir por texto:*
│ \${prefix}setprompt gyomei seu texto
│
│ *Definir respondendo a uma mensagem:*
│ responda ao texto com \${prefix}setprompt gyomei
│
│ *Restaurar o padrão:*
│ \${prefix}resetprompt gyomei
│
│ Também disponíveis: humana e ia.
│ As regras de identidade, interação e JSON continuam protegidas.
╰━━━━━━━━━━━━━━━━━━━━━━━━╯\`);
  break;

case 'setprompt':
  try {
    if (!isOwner) return reply('🚫 Apenas donos podem configurar a personalidade.');
    const promptArgs = String(q || '').trim().split(/\\s+/).filter(Boolean);
    const possibleKey = String(promptArgs[0] || 'gyomei').toLowerCase();
    const knownPromptKeys = ['gyomei', 'nazuna', 'humana', 'ia'];
    const promptKey = knownPromptKeys.includes(possibleKey) ? promptArgs.shift() : 'gyomei';
    const promptText = promptArgs.join(' ').trim() || automacoesV9.getQuotedText(info.message);
    const savedPrompt = automacoesV9.setAssistantPrompt(promptKey, promptText);
    if (!savedPrompt.ok) return reply(\`❌ \${savedPrompt.msg}\`);
    await reply(\`✅ Prompt de *\${savedPrompt.key === 'nazuna' ? 'GYOMEI' : savedPrompt.key}* atualizado com \${savedPrompt.length} caracteres.\`);
  } catch (e) {
    console.error('[SETPROMPT] Erro:', e);
    await reply(\`❌ Não foi possível salvar o prompt: \${e.message}\`);
  }
  break;

case 'verprompt':
  try {
    if (!isOwner) return reply('🚫 Apenas donos podem consultar os prompts.');
    const promptInfo = automacoesV9.getAssistantPrompt(String(q || 'gyomei').trim());
    if (!promptInfo.ok) return reply(\`❌ \${promptInfo.msg}\`);
    if (!promptInfo.custom) return reply(\`🪨 *\${promptInfo.key === 'nazuna' ? 'GYOMEI' : promptInfo.key}* está usando o prompt padrão protegido.\`);
    const preview = promptInfo.prompt.length > 3500 ? promptInfo.prompt.slice(0, 3500) + '\\n[prévia limitada]' : promptInfo.prompt;
    await reply(\`🪨 *Prompt personalizado — \${promptInfo.key === 'nazuna' ? 'GYOMEI' : promptInfo.key}:*\\n\\n\${preview}\`);
  } catch (e) {
    await reply(\`❌ Não foi possível ler o prompt: \${e.message}\`);
  }
  break;

case 'resetprompt':
  try {
    if (!isOwner) return reply('🚫 Apenas donos podem restaurar os prompts.');
    const resetPrompt = automacoesV9.resetAssistantPrompt(String(q || 'gyomei').trim());
    if (!resetPrompt.ok) return reply(\`❌ \${resetPrompt.msg}\`);
    await reply(\`✅ Prompt de *\${resetPrompt.key === 'nazuna' ? 'GYOMEI' : resetPrompt.key}* restaurado para o padrão.\`);
  } catch (e) {
    await reply(\`❌ Não foi possível restaurar o prompt: \${e.message}\`);
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
    const setmidiaPersonaScope = (setmidiaArgs.length >= 2 && automacoesV9.PERSONALITY_KEYS.includes(setmidiaFirstLower))
      ? setmidiaFirstLower
      : null;
    const setmidiaSlot = (setmidiaPersonaScope ? setmidiaArgs[1] : setmidiaArgs[0])?.replace(/^[!./#]+/, '').toLowerCase();
    if (!setmidiaSlot) return reply(\`Use: \${prefix}setmidia [personalidade] comando, respondendo a uma foto, GIF ou vídeo.\\n\\nExemplos:\\n\${prefix}setmidia menu\\n\${prefix}setmidia gyomei menu\`);
    const mediaCommand = setmidiaPersonaScope ? \`\${setmidiaPersonaScope}_\${setmidiaSlot}\` : setmidiaSlot;
    const quotedMedia = automacoesV9.getQuotedMediaSource(info.message);
    if (!quotedMedia) return reply('Responda a uma foto, GIF ou vídeo para associar ao comando.');
    const mediaBuffer = await getFileBuffer(quotedMedia.message, quotedMedia.type);
    const savedMedia = await automacoesV9.saveCommandMedia(mediaCommand, mediaBuffer, quotedMedia.type, quotedMedia.gifPlayback);
    const setmidiaScopeLabel = setmidiaPersonaScope ? \` (personalidade *\${setmidiaPersonaScope.toUpperCase()}*)\` : '';
    await reply(\`✅ Mídia \${savedMedia.gifPlayback ? 'GIF' : savedMedia.type === 'image' ? 'foto' : 'vídeo'} vinculada a \${prefix}\${setmidiaSlot}\${setmidiaScopeLabel}.\`);
  } catch (e) {
    console.error('[SETMIDIA] Erro:', e);
    await reply(\`❌ Falha ao configurar a mídia: \${e.message}\`);
  }
  break;

case 'setmidia-profilep':
case 'setperfilpersona':
  try {
    if (!isOwner) return reply('🚫 Apenas donos podem configurar mídias de personalidade.');
    const profilepPersona = String(q || '').trim().split(/\\s+/)[0]?.toLowerCase();
    if (!profilepPersona || !automacoesV9.PERSONALITY_KEYS.includes(profilepPersona)) {
      return reply(\`Use: \${prefix}setmidia-profilep <personalidade>, respondendo a uma foto.\\n\\nPersonalidades: \${automacoesV9.PERSONALITY_KEYS.join(', ')}\`);
    }
    const profilepMedia = await automacoesV9.downloadQuotedCommandMedia(info.message);
    if (!profilepMedia.ok) return reply(\`❌ \${profilepMedia.msg}\`);
    if (profilepMedia.type !== 'image') return reply('❌ A foto de perfil precisa ser uma imagem (não vídeo/GIF).');
    await automacoesV9.saveCommandMedia(\`\${profilepPersona}_profilep\`, profilepMedia.buffer, 'image', false);
    await reply(\`✅ Foto de perfil da personalidade *\${profilepPersona.toUpperCase()}* configurada. Ative com \${prefix}changeperso \${profilepPersona}.\`);
  } catch (e) {
    console.error('[SETMIDIA-PROFILEP] Erro:', e);
    await reply(\`❌ Falha ao configurar a foto de perfil: \${e.message}\`);
  }
  break;

case 'changeperso':
case 'mudarpersona':
  try {
    if (!isOwner) return reply('🚫 Apenas donos podem trocar a identidade do bot.');
    const changepersoKey = String(q || '').trim().toLowerCase();
    if (!changepersoKey || !automacoesV9.PERSONALITY_KEYS.includes(changepersoKey)) {
      return reply(\`Use: \${prefix}changeperso <personalidade>\\n\\nPersonalidades disponíveis: \${automacoesV9.PERSONALITY_KEYS.join(', ')}\`);
    }

    const changepersoResult = automacoesV9.setActivePersona(changepersoKey);
    if (!changepersoResult.ok) return reply(\`❌ \${changepersoResult.msg}\`);

    const changepersoDisplayName = changepersoKey.charAt(0).toUpperCase() + changepersoKey.slice(1);
    let changepersoConfig = JSON.parse(fs.readFileSync(CONFIG_FILE));
    changepersoConfig.nomebot = changepersoDisplayName;
    writeJsonFile(CONFIG_FILE, changepersoConfig);

    const changepersoDesign = automacoesV9.PERSONA_MENU_DESIGNS[changepersoKey];
    if (changepersoDesign && !saveMenuDesign({ ...changepersoDesign })) {
      console.error('[CHANGEPERSO] Falha ao salvar o tema visual do menu.');
    }

    const changepersoFotoMedia = automacoesV9.getCommandMedia(\`\${changepersoKey}_profilep\`);
    if (changepersoFotoMedia?.path && fs.existsSync(changepersoFotoMedia.path)) {
      try {
        const changepersoFotoBuffer = fs.readFileSync(changepersoFotoMedia.path);
        const changepersoProcessedBuffer = await processImageForProfile(changepersoFotoBuffer);
        await nazu.updateProfilePicture(nazu.user.id, changepersoProcessedBuffer);
      } catch (changepersoFotoError) {
        console.error('[CHANGEPERSO] Erro ao trocar a foto:', changepersoFotoError);
      }
    }

    try {
      await nazu.updateProfileName(changepersoDisplayName);
    } catch (changepersoNomeError) {
      console.error('[CHANGEPERSO] Erro ao trocar o nome:', changepersoNomeError);
    }

    await reply(\`✅ Personalidade e temática do bot mudaram para *\${changepersoKey.toUpperCase()}*.\`);
  } catch (e) {
    console.error('[CHANGEPERSO] Erro:', e);
    await reply(\`❌ Falha ao trocar a identidade do bot: \${e.message}\`);
  }
  break;

case 'default':
case 'resetidentidade':
case 'identidadepadrao':
  try {
    if (!isOwner) return reply('🚫 Apenas donos podem restaurar a identidade padrão do bot.');

    const defaultPersonaResult = automacoesV9.setActivePersona('gyomei');
    if (!defaultPersonaResult.ok) return reply(\`❌ \${defaultPersonaResult.msg}\`);

    const defaultDisplayName = 'NAZUNA BOT • GYOMEI';
    let defaultConfig = JSON.parse(fs.readFileSync(CONFIG_FILE));
    defaultConfig.nomebot = defaultDisplayName;
    writeJsonFile(CONFIG_FILE, defaultConfig);

    const defaultFactoryDesign = {
      header: \`╭┈⊰ 🌸 『 *{botName}* 』\\n┊Olá, {userName}!\\n╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯\`,
      menuTopBorder: '╭┈',
      bottomBorder: '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯',
      menuTitleIcon: '🍧ฺꕸ▸',
      menuItemIcon: '•.̇𖥨֗🍓⭟',
      separatorIcon: '❁',
      middleBorder: '┊'
    };
    saveMenuDesign(defaultFactoryDesign);

    const defaultFotoMedia = automacoesV9.getCommandMedia('default_profilep') || automacoesV9.getCommandMedia('gyomei_profilep');
    if (defaultFotoMedia?.path && fs.existsSync(defaultFotoMedia.path)) {
      try {
        const defaultFotoBuffer = fs.readFileSync(defaultFotoMedia.path);
        const defaultProcessedBuffer = await processImageForProfile(defaultFotoBuffer);
        await nazu.updateProfilePicture(nazu.user.id, defaultProcessedBuffer);
      } catch (defaultFotoError) {
        console.error('[DEFAULT] Erro ao trocar a foto:', defaultFotoError);
      }
    }

    try {
      await nazu.updateProfileName(defaultDisplayName);
    } catch (defaultNomeError) {
      console.error('[DEFAULT] Erro ao trocar o nome:', defaultNomeError);
    }

    await reply('✅ Personalidade e temática do bot voltaram ao padrão: *NAZUNA BOT • GYOMEI*.');
  } catch (e) {
    console.error('[DEFAULT] Erro:', e);
    await reply(\`❌ Falha ao restaurar a identidade padrão: \${e.message}\`);
  }
  break;

case 'menumidia':
case 'listmidias':
  try {
    if (!isOwner) return reply('🚫 Apenas donos podem consultar as mídias configuradas.');
    const configuredMedia = automacoesV9.listCommandMedia();
    const personaMediaLines = [];
    const globalMediaLines = [];
    for (const item of configuredMedia) {
      const personaMatch = automacoesV9.PERSONALITY_KEYS.find(key => item.command.startsWith(\`\${key}_\`));
      if (personaMatch && item.command === \`\${personaMatch}_profilep\`) {
        personaMediaLines.push(\`│ • [\${personaMatch.toUpperCase()}] foto de perfil\`);
      } else if (personaMatch) {
        personaMediaLines.push(\`│ • [\${personaMatch.toUpperCase()}] \${item.command.slice(personaMatch.length + 1)} — \${item.gifPlayback ? 'GIF' : item.type}\`);
      } else {
        globalMediaLines.push(\`│ • \${prefix}\${item.command} — \${item.gifPlayback ? 'GIF' : item.type}\`);
      }
    }
    const mediaLines = [...personaMediaLines, ...globalMediaLines].join('\\n') || '│ Nenhuma mídia personalizada configurada.';
    await reply(\`╭━━━⊱ 🖼️ *MÍDIAS DOS MENUS* 🖼️ ⊱━━━╮
│
│ Mídia global (vale pra qualquer personalidade):
│ \${prefix}setmidia menu
│ \${prefix}setmidia menubn
│ \${prefix}setmidia qualquercomando
│
│ Mídia só de uma personalidade (tem prioridade sobre a global):
│ \${prefix}setmidia <personalidade> menu
│ \${prefix}setmidia <personalidade> menubn
│ \${prefix}setmidia-profilep <personalidade>
│
│ Trocar a identidade ativa do bot:
│ \${prefix}changeperso <personalidade>
│
│ Para remover:
│ \${prefix}delmidia comando (mídia global) ou \${prefix}delmidia <personalidade>_<comando>
│
│ *Configuradas:*
\${mediaLines}
╰━━━━━━━━━━━━━━━━━━━━━━━━╯\`);
  } catch (e) {
    await reply(\`❌ Não foi possível abrir o menu de mídias: \${e.message}\`);
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
    const returnedMessage = await automacoesV9.returnDeletedMessage(nazu, from, returnPosition, info);
    if (!returnedMessage.ok) await reply(\`❌ \${returnedMessage.msg}\`);
  } catch (e) {
    console.error('[RETURN] Erro:', e);
    await reply(\`❌ Não foi possível recuperar a mensagem: \${e.message}\`);
  }
  break;

`;

  output = replaceRequired(output, `case 'criador':`, `${commandCases}case 'criador':`, 'novos comandos do Gyomei');

  output = replaceRequired(
    output,
    /case 'criador':\s*\n\s*try\s*\{[\s\S]*?const TextinCriadorInfo = `[\s\S]*?`;\s*\n\s*await reply\(TextinCriadorInfo\);[\s\S]*?\n\s*break;/,
    `case 'criador':
  try {
    const TextinCriadorInfo = \`╭━━━━⊱ 👨‍💻 *CRÉDITOS DO PROJETO* 👨‍💻 ⊱━━━━╮
│
│ ⭐ *CRIADOR ORIGINAL — HIUDY (HIDUY)*
│ Este projeto existe graças ao trabalho original dele.
│ 📱 WhatsApp: https://wa.me/553391967445
│ 🌐 GitHub: https://github.com/hiudyy
│ 📸 Instagram: https://instagram.com/hiudyyy_
│
│ 🧩 *NAZUNA ATUAL — DEVTOKYO*
│ Responsável pela base moderna usada nesta versão.
│ 🌐 Projeto: https://github.com/DevTokyoVx/nazuna
│
│ 🛠️ *ADAPTAÇÃO GYOMEI — ALASKA_DEV*
│ Automações, personalidade e ajustes desta distribuição.
│ 📱 WhatsApp: https://wa.me/5522997028553
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\`;
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
    `import axios from 'axios';\nimport * as automacoesV9 from './utils/gyomeiRuntime.js';`,
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
    `NazunaSock.ev.on('creds.update', saveCreds);`,
    `NazunaSock.ev.on('creds.update', saveCreds);\n    automacoesV9.installDeletedMessageTracker(NazunaSock, () => messagesCache);`,
    'rastreador de mensagens apagadas'
  );
  return output;
}

function patchMenusIndexSource(source) {
  return replaceRequired(source, `menubn: './menubn.js',`, `menubn: './.runtime-menubn.js',`, 'menu de brincadeiras de execução');
}

function patchMenubnSource(source) {
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
  output = replaceRequired(
    output,
    `    \`\${colors.bold}🚀 Nazuna - Conexão WhatsApp\${colors.reset}\`,\n    \`\${colors.bold}📦 Versão: \${version}\${colors.reset}\`,`,
    `    \`\${colors.bold}🪨 GYOMEI — O guardião despertou\${colors.reset}\`,\n    \`\${colors.bold}🙏 Força, serenidade e disciplina em cada mensagem\${colors.reset}\`,\n    \`\${colors.bold}📦 Base Nazuna: \${version}\${colors.reset}\`,`,
    'cabeçalho de inicialização do Gyomei'
  );
  output = output.replace('🛑 Encerrando o Nazuna... Até logo!', '🛑 GYOMEI recolhe suas contas de oração. Encerrando com segurança...');
  return output;
}

export function prepareRuntimeSources() {
  const indexSource = fs.readFileSync(path.join(SRC_DIR, 'index.js'), 'utf8');
  const connectSource = fs.readFileSync(path.join(SRC_DIR, 'connect.js'), 'utf8');
  const iaSource = fs.readFileSync(path.join(SRC_DIR, 'funcs', 'private', 'ia.js'), 'utf8');
  const menusIndexSource = fs.readFileSync(path.join(SRC_DIR, 'menus', 'index.js'), 'utf8');
  const menubnSource = fs.readFileSync(path.join(SRC_DIR, 'menus', 'menubn.js'), 'utf8');
  const startSource = fs.readFileSync(path.join(SCRIPTS_DIR, 'start.js'), 'utf8');

  fs.writeFileSync(path.join(SRC_DIR, '.runtime-index.js'), patchIndexSource(indexSource));
  fs.writeFileSync(path.join(SRC_DIR, '.runtime-connect.js'), patchConnectSource(connectSource));
  fs.writeFileSync(path.join(SRC_DIR, 'funcs', 'private', '.runtime-ia.js'), patchIaSource(iaSource));
  fs.writeFileSync(path.join(SRC_DIR, 'menus', '.runtime-index.js'), patchMenusIndexSource(menusIndexSource));
  fs.writeFileSync(path.join(SRC_DIR, 'menus', '.runtime-menubn.js'), patchMenubnSource(menubnSource));
  fs.writeFileSync(path.join(SCRIPTS_DIR, '.runtime-start.js'), patchStartSource(startSource));

}
