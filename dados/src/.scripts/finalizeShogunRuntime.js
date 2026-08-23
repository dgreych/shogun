import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildMacrotrancheLegacyBridge } from './vnextMacrotrancheBridge.js';

const __filename = fileURLToPath(import.meta.url);
const SCRIPTS_DIR = path.dirname(__filename);
const RUNTIME_INDEX = path.resolve(SCRIPTS_DIR, '..', '.runtime-index.js');
const RUNTIME_IA = path.resolve(SCRIPTS_DIR, '..', 'funcs', 'private', '.runtime-ia.js');
const RUNTIME_START = path.join(SCRIPTS_DIR, '.runtime-start.js');
const MEMBERS_SCOPE_MANIFEST = path.join(SCRIPTS_DIR, 'vnextMembersDomainScope.json');

function replaceRequired(source, search, replacement, description) {
  const updated = source.replace(search, replacement);
  if (updated === source) throw new Error(`Patch final obrigatório não encontrado: ${description}`);
  return updated;
}

function replacePatternRequired(source, pattern, replacement, description) {
  const updated = source.replace(pattern, replacement);
  if (updated === source) throw new Error(`Patch final obrigatório não encontrado: ${description}`);
  return updated;
}

function buildCommandNotFoundCard() {
  return [
    "    const typedCommand = `${groupPrefix}${commandName}`;",
    "    let notFoundMessage = `╭━━⊱ ⛩️ *SHOGUN* ⛩️ ⊰━━╮",
    "│",
    "│ ❌ *Comando não reconhecido*",
    "│ Você digitou: *${typedCommand}*",
    "│`;",
    "",
    "    if (topSimilar.length > 0) {",
    "      notFoundMessage += `",
    "│ 🔎 *Talvez você procurasse:*",
    "│`;",
    "",
    "      topSimilar.forEach((cmd, index) => {",
    "        const proximity = cmd.similarity >= 80",
    "          ? 'muito próximo'",
    "          : cmd.similarity >= 60",
    "            ? 'próximo'",
    "            : 'possível';",
    "        const filledBars = Math.max(0, Math.min(10, Math.round(cmd.similarity / 10)));",
    "        const proximityBar = '▰'.repeat(filledBars) + '▱'.repeat(10 - filledBars);",
    "",
    "        notFoundMessage += `│ ${index + 1}. *${groupPrefix}${cmd.command}* · ${cmd.similarity}% (${proximity})",
    "│    ${proximityBar}",
    "`;",
    "      });",
    "",
    "      notFoundMessage += `│",
    "│ Copie uma das opções acima e tente novamente.",
    "`;",
    "    } else {",
    "      notFoundMessage += `",
    "│ Nenhuma sugestão segura foi encontrada.",
    "│ Use *${groupPrefix}menu* para consultar os comandos.",
    "`;",
    "    }",
    "",
    "    notFoundMessage += `│",
    "╰━━ *${totalCommands} comandos disponíveis* ━━╯`;"
  ].join('\n');
}

function assertNoDirectNvidiaTransport(source) {
  const forbidden = ['requestNvidiaChat', 'resolveEmbeddedNvidiaKey', 'getNvidiaApiKey'];
  const found = forbidden.filter(item => source.includes(item));
  if (found.length) {
    throw new Error(`Transporte NVIDIA direto proibido no runtime: ${found.join(', ')}`);
  }
  return source;
}

function countOccurrences(source, needle) {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const index = source.indexOf(needle, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + needle.length;
  }
}

function buildMembersScopeFactorySource() {
  const manifest = JSON.parse(fs.readFileSync(MEMBERS_SCOPE_MANIFEST, 'utf8'));
  const selected = manifest?.selected || {};
  const freeBindings = Array.isArray(manifest?.freeBindings) ? manifest.freeBindings : [];
  const writeBindings = new Set(Array.isArray(manifest?.writeBindings) ? manifest.writeBindings : []);

  if (manifest?.schemaVersion !== 2 || manifest?.strategy !== 'atomic-domain-cutover') {
    throw new Error('Manifesto Members inválido para montagem da scope lazy.');
  }
  if (selected.families !== 32 || selected.tokens !== 152) {
    throw new Error(
      `Manifesto Members fora do cutover esperado: ${selected.families}/${selected.tokens}.`
    );
  }
  if (freeBindings.length === 0) {
    throw new Error('Manifesto Members não possui bindings de runtime.');
  }

  const invalid = freeBindings.filter(name => !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name));
  if (invalid.length) {
    throw new Error(`Bindings Members inválidos: ${invalid.join(', ')}`);
  }

  const unsupportedWrites = [...writeBindings].filter(name => name !== 'i6');
  if (unsupportedWrites.length) {
    throw new Error(`Writes Members ainda não suportados: ${unsupportedWrites.join(', ')}`);
  }

  const lines = [
    '          buildMembersScope: () => ({',
    '            command,',
  ];

  for (const name of freeBindings) {
    if (writeBindings.has(name)) {
      lines.push(`            get ${name}() { return ${name}; },`);
      lines.push(`            set ${name}(__value) { ${name} = __value; },`);
    } else {
      lines.push(`            ${name},`);
    }
  }
  lines.push('          }),');
  return lines.join('\n');
}

/**
 * Insere o seam vNext no ponto seguro do executor legado: depois de todas as
 * políticas/gates pré-dispatch e imediatamente antes do switch(command).
 *
 * O source versionado continua intacto. A alteração é aplicada somente ao
 * .runtime-index.js gerado no boot, pela mesma camada de patches já usada pelo
 * Gyomei. O gate estrutural exige exatamente um anchor para evitar injeção em
 * switch interno ou drift silencioso do monólito.
 *
 * A montagem do contexto é deliberadamente separada do dispatch. Se um binding
 * estrutural deixar de existir após algum patch de runtime, o erro acontece
 * antes de qualquer domínio vNext executar. Nesse caso o comando segue para o
 * switch legado original. ReferenceError abre um circuit breaker para o resto
 * do processo, mantendo o bot disponível até a próxima reinicialização/hotfix.
 * Erros lançados depois que o dispatch começou continuam fail-closed para nunca
 * repetir efeitos no legado.
 *
 * Members usa uma segunda camada lazy. Seus ~100 bindings só são lidos quando
 * um token do domínio realmente chega ao target Members. Assim um drift em um
 * binding exclusivo de Members não derruba Menu/Tools/Admin. A boundary Members
 * captura falha pré-handler e preserva o caminho legado uma única vez.
 */
export function patchVNextOwnershipHook(source) {
  const importAnchor = "import { MessageReplayGuard, createMessageReplayKey } from './security/MessageReplayGuard.js';";
  const hookImport = "import { dispatchLegacySwitchVNext } from '../../dist-vnext/runtime/legacy-switch-hook.js';";
  const circuitDeclaration = 'let __gyomeiVNextContextCircuitOpen = false;';
  const switchAnchor = '    switch (command) {';
  const hookMarker = '    // ===== VNEXT OWNERSHIP SEAM: PRE-SWITCH =====';

  if (source.includes(hookImport) || source.includes(hookMarker) || source.includes(circuitDeclaration)) {
    if (
      source.includes(hookImport)
      && source.includes(hookMarker)
      && source.includes(circuitDeclaration)
    ) return source;
    throw new Error('Patch vNext pré-switch encontrado parcialmente; recusando runtime inconsistente.');
  }

  if (countOccurrences(source, importAnchor) !== 1) {
    throw new Error('Anchor do import para o seam vNext não é único no runtime.');
  }
  if (countOccurrences(source, switchAnchor) !== 1) {
    throw new Error('switch(command) principal não é único no runtime; seam vNext recusado.');
  }

  let output = replaceRequired(
    source,
    importAnchor,
    `${importAnchor}\n${hookImport}\n${circuitDeclaration}`,
    'import e circuit breaker do seam vNext'
  );

  const membersScopeFactory = buildMembersScopeFactorySource();
  const hook = `${hookMarker}
    if (isCmd && command && !__gyomeiVNextContextCircuitOpen) {
      let __vnextContext;
      try {
        __vnextContext = {
          socket: nazu,
          message: info,
          mediaPath: store,
          messagesCache,
          rentalExpirationManager,
          prefix: groupPrefix,
          botName: nomebot,
          pushName: pushname,
          isOwner,
          isLiteMode: isModoLite,
          reply,
          rejectInLiteMode,
          isGroup,
          isModoBn,
          sender,
          mentionedUser: menc_os2,
          groupId: from,
          groupMembers: AllgroupMembers,
          getUserName,
          buildGroupFilePath,
          isGroupAdmin,
          isRealGroupAdmin,
          isBotAdmin,
          query: q,
          groupName,
          groupFile,
          groupData,
          quotedContextInfo: getQuotedContextInfo(info.message),
          quotedParticipant: menc_prt,
          botIds: [nazu.user?.id, nazu.user?.lid, botNumber, botNumberLid].filter(Boolean),
          identitiesMatch: idsMatch,
          validateModerationTarget,
          removeUserFromMap,
          notes,
          calculator,
          loadReminders,
          saveReminders,
          optimizer,
          parseReminderInput,
          tzFormat,
          pickLoadingMessage,
          styleText,
          qrReader: qrcode,
          downloadContentFromMessage,
          messageType: type,
          dictionary: Dicionary,
          ai: ia,
          defaultAiModel: DEFAULT_NVIDIA_MODEL,
          formatAIResponse,
          getFileBuffer,
          uploadMedia: upload,
          isQuotedImage,
          isQuotedVideo,
          isQuotedDocument,
          isQuotedAudio,
${membersScopeFactory}
          isMacrotrancheOwnedCommand: (__command) => __gyomeiMacrotrancheOwnedCommands.has(String(__command || '').trim().toLowerCase()),
          executeLegacyOwnedCommand: __gyomeiExecuteMacrotrancheLegacy
        };
      } catch (__vnextContextError) {
        const __vnextStructuralFailure = __vnextContextError instanceof ReferenceError;
        if (__vnextStructuralFailure) __gyomeiVNextContextCircuitOpen = true;
        console.error(
          __vnextStructuralFailure
            ? '[VNEXT] Falha estrutural ao montar contexto; circuit breaker aberto e switch legado preservado.'
            : '[VNEXT] Falha transitória ao montar contexto; switch legado preservado para esta mensagem.',
          __vnextContextError
        );
      }

      if (__vnextContext) {
        const __vnextOwned = await dispatchLegacySwitchVNext(command, __vnextContext);
        if (__vnextOwned) return;
      }
    }

${switchAnchor}`;

  output = replaceRequired(
    output,
    switchAnchor,
    hook,
    'seam vNext imediatamente antes do switch(command)'
  );

  return output;
}

export function finalizeShogunRuntime() {
  let runtimeIndex = fs.readFileSync(RUNTIME_INDEX, 'utf8');
  let runtimeIa = fs.readFileSync(RUNTIME_IA, 'utf8');
  let runtimeStart = fs.readFileSync(RUNTIME_START, 'utf8');

  // Os patches históricos precisam ser aplicados antes da fotografia usada
  // pelo bridge. Assim o executor compatível e o fallback original partem do
  // mesmo comportamento já corrigido, sem duas versões do mesmo case.
  runtimeIndex = replaceRequired(
    runtimeIndex,
    `    const quotedMedia = automacoesV9.getQuotedMediaSource(info.message);\n    if (!quotedMedia) return reply('Responda a uma foto, GIF ou vídeo para associar ao comando.');\n    const mediaBuffer = await getFileBuffer(quotedMedia.message, quotedMedia.type);\n    const savedMedia = await automacoesV9.saveCommandMedia(mediaCommand, mediaBuffer, quotedMedia.type, quotedMedia.gifPlayback);`,
    `    const downloadedMedia = await automacoesV9.downloadQuotedCommandMedia(info.message);\n    if (!downloadedMedia.ok) return reply(\`❌ \${downloadedMedia.msg}\`);\n    const savedMedia = await automacoesV9.saveCommandMedia(\n      mediaCommand,\n      downloadedMedia.buffer,\n      downloadedMedia.type,\n      downloadedMedia.gifPlayback\n    );`,
    'download independente do setmidia'
  );

  runtimeIndex = replacePatternRequired(
    runtimeIndex,
    /case 'criador':\s*\n\s*try\s*\{[\s\S]*?const TextinCriadorInfo = `[\s\S]*?`;\s*\n\s*await reply\(TextinCriadorInfo\);[\s\S]*?\n\s*break;/,
    `case 'criador':
  try {
    const TextinCriadorInfo = \`╭━━━⊱ ⚔️ *CRIADOR* ⚔️ ⊱━━━╮
│
│ *Alaska dev* (Maurício)
│
│ 🌐 github.com/dgreych/shogun
│ 📱 wa.me/5522997028553
│
╰━━━━━━━━━━━━━━━━━━━━━━━━╯\`;
    await reply(TextinCriadorInfo);
  } catch (e) {
    console.error(e);
    await reply('❌ Não foi possível carregar os créditos agora.');
  }
  break;`,
    'créditos do produto'
  );

  runtimeIndex = replacePatternRequired(
    runtimeIndex,
    /    let notFoundMessage = `📊[\s\S]*?    notFoundMessage \+= `💭 \*Dica:\* Verifique se digitou o comando corretamente!`;/,
    buildCommandNotFoundCard(),
    'cartão de comandos similares'
  );

  runtimeIa = assertNoDirectNvidiaTransport(runtimeIa);

  runtimeIndex = buildMacrotrancheLegacyBridge(runtimeIndex);
  runtimeIndex = patchVNextOwnershipHook(runtimeIndex);

  fs.writeFileSync(RUNTIME_INDEX, runtimeIndex);
  fs.writeFileSync(RUNTIME_IA, runtimeIa);
  fs.writeFileSync(RUNTIME_START, runtimeStart);
}
