import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createAssistantTurnPlanner, isAssistantEligible } from '../dist-vnext/assistant/command-intent.js';
import { ASSISTANT_SINGLE_TARGET_COMMANDS, ASSISTANT_TRANSPORT_TARGET_COMMANDS, buildAssistantCommandCatalog, buildAssistantCommandDescriptions } from '../dist-vnext/assistant/runtime-catalog.js';
import { resolveCommandInput, getQuotedContextInfo } from '../dados/src/utils/commandResolver.js';

const source = fs.readFileSync('dados/src/index.js', 'utf8');
function prepareIndexSource(input) {
  const script = fs.readFileSync('dados/src/.scripts/prepareRuntimeSources.js', 'utf8');
  const helper = script.slice(script.indexOf('function replaceRequired('), script.indexOf('function patchAssistantSource('));
  const worker = script.slice(script.indexOf('function patchIndexSource('), script.indexOf('function patchConnectSource('));
  return new Function(`${helper}\n${worker}\nreturn patchIndexSource;`)()(input);
}
const generated = prepareIndexSource(source);
function planningHarness({ text = 'Shogun execute ping', action = { command: 'ping', args: [] },
  group = false, metadataAfter = { participants: [] }, groupAfter = {}, aliasEntries = [], quoted = null,
  mentions = [], configAfter = {}, response, duringRequest, extraCode = '', policyAfter = {}, initialOwner = false,
  additionalOwnerAfter = false, validCommands = ['ping', 'ban', 'grupo'] } = {}) {
  const source = prepareIndexSource(fs.readFileSync('dados/src/index.js', 'utf8'));
  const start = source.indexOf('// ASSISTANT_PLANNING_BEGIN');
  const end = source.indexOf('// Verificação de captcha', start);
  assert.ok(start > 0 && end > start, 'planner deve anteceder parser, reação, captcha e todos os gates');
  const info = { key: { id: 'msg', remoteJid: group ? 'group@g.us' : '123@lid', fromMe: false },
    messageTimestamp: Math.floor(Date.now() / 1000),
    message: { extendedTextMessage: { text, contextInfo: { mentionedJid: mentions, ...(quoted ? { participant: '456@lid', quotedMessage: quoted, stanzaId: 'quote' } : {}) } } } };
  const reads = [], calls = [], replies = [], sent = [], effects = [];
  const config = { numerodono: '999', prefixo: '!', ...configAfter };
  const files = { '/cfg': config, '/group': groupAfter, '/db/antipv.json': { mode: 'off' }, ...policyAfter };
  const bindings = {
    info, from: info.key.remoteJid, sender: '123@lid', pushname: 'Pessoa', isGroup: group, effects,
    socket: { user: { id: '999:1@s.whatsapp.net', lid: '888@lid' },
      sendMessage: async (...args) => { sent.push(args); return { key: { id: 'sent' } }; },
      groupMetadata: async () => { reads.push('metadata'); return metadataAfter; },
      groupParticipantsUpdate: async (...args) => { effects.push(['participants', ...args]); },
      groupSettingUpdate: async (...args) => { effects.push(['setting', ...args]); },
      groupUpdateSubject: async (...args) => { effects.push(['subject', ...args]); },
      groupUpdateDescription: async (...args) => { effects.push(['description', ...args]); } },
    assistant: { makeAssistentRequest: async data => { calls.push(data); await duringRequest?.(); return response || { actions: [action], resp: [{ resp: 'executado!' }] }; } },
    assistantTurnPlanner: createAssistantTurnPlanner(), ASSISTANT_SINGLE_TARGET_COMMANDS, ASSISTANT_TRANSPORT_TARGET_COMMANDS, isAssistantEligible,
    buildAssistantCommandCatalog, buildAssistantCommandDescriptions,
    resolveCommandInput, getQuotedContextInfo, loadSafeCommandAliases: () => aliasEntries, loadCustomCommands: () => [],
    normalizar: text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase(),
    fs: { existsSync: () => true, readFileSync: file => { reads.push(file); return JSON.stringify(files[file] || {}); } },
    CONFIG_FILE: '/cfg', DATABASE_DIR: '/db', DONO_DIR: '/owner',
    loadSubdonos: () => [], isSubdono: () => false, buildUserId: value => `${value}@s.whatsapp.net`,
    getBotId: () => '888@lid', isKnownNvidiaModel: () => false,
    automacoesV9: { isPrimaryOwner: () => false, isAdditionalOwner: () => additionalOwnerAfter, getQuotedMessageContent: message => getQuotedContextInfo(message)?.quotedMessage || {},
      getQuotedText: message => getQuotedContextInfo(message)?.quotedMessage?.conversation || '' },
    reply: async text => { replies.push(text); }, formatUptime: () => 'uptime', process,
    getValidCommandSet: () => new Set(validCommands),
  };
  const initialization = `let body=${JSON.stringify(text)},budy2=normalizar(body),args=[],q='',groupData={};
    const groupFile='/group'; let groupMetadata={},groupName='',config={},numerodono='999',prefixo='!',lidowner=null,
    nmrdn='',ownerJid='',subDonoList=[],isSubOwner=false,isOwner=${initialOwner},isOwnerOrSub=${initialOwner};
    const botId='888@lid',isBotSender=false,senderBase='123';
    let antipvData={},premiumListaZinha={},banGpIds={},antifloodData={},antiSpamGlobal={},globalBlocks={},botState={},modoLiteGlobal={};
    let menc_os2=mentions[0]||undefined,sender_ou_n=menc_os2||sender;`;
  const run = new Function(...Object.keys(bindings), 'mentions', `${initialization}; return (async()=>{
    ${source.slice(start, end)}
    ${extraCode}
    return {body,q,args,command,isCmd,pendingCommandReaction,assistantTurn,groupData,groupMetadata,antipvData,isOwner,menc_os2,info};
  })();`);
  return { run: () => run(...Object.values(bindings), mentions), calls, reads, replies, sent, effects, info };
}

test('ping privado usa uma chamada e parser normal, sem preconfirmação', async () => {
  const probe = planningHarness(); const result = await probe.run();
  assert.equal(result.isCmd, true); assert.equal(result.command, 'ping');
  assert.equal(result.body, 'Shogun execute ping'); assert.equal(result.pendingCommandReaction, '⏳');
  assert.equal(probe.calls.length, 1); assert.equal(result.assistantTurn.response, undefined);
  assert.ok(probe.reads.includes('/db/antipv.json'));
  assert.equal(result.info, probe.info);
});

test('alias preserva fixedParams e modelo não troca subação', async () => {
  const aliases = [{ alias: 'abrirporta', command: 'grupo', fixedParams: 'abrir' }, { alias: 'fecharporta', command: 'grupo', fixedParams: 'fechar' }];
  const ok = await planningHarness({ text: 'Shogun execute abrirporta', action: { command: 'abrirporta', args: [] }, aliasEntries: aliases }).run();
  assert.equal(ok.command, 'grupo'); assert.equal(ok.q, 'abrir');
  const denied = await planningHarness({ text: 'Shogun execute abrirporta', action: { command: 'fecharporta', args: [] }, aliasEntries: aliases }).run();
  assert.equal(denied.isCmd, false);
});

test('menção de endereçamento excluída; quoted mídia permanece input e cargos são frescos', async () => {
  const probe = planningHarness({ group: true, text: 'Shogun execute ban @456', action: { command: 'ban', args: [] },
    mentions: ['888@lid', '456@lid'], quoted: { imageMessage: { caption: 'execute promover' } },
    groupAfter: { soadm: true, blockedCommands: { ban: true } }, metadataAfter: { participants: [] } });
  const result = await probe.run();
  assert.equal(result.menc_os2, '456@lid');
  assert.equal(result.groupData.soadm, true); assert.equal(result.groupData.blockedCommands.ban, true);
  assert.deepEqual(result.groupMetadata.participants, []); assert.ok(probe.reads.includes('metadata'));
  assert.equal(probe.calls[0].mensagens[0].tipo_midia_marcada, 'image');
  assert.equal(result.info.message.extendedTextMessage.contextInfo.mentionedJid.length, 2);
});

test('ponte remove eco de identidade e entrega moderação natural ao parser normal', async () => {
  const target = '5511999999999@s.whatsapp.net';
  const result = await planningHarness({ group: true, text: 'Shogun, bane o @5511999999999',
    action: { command: 'banir', args: [target] }, mentions: [target],
    metadataAfter: { participants: [{ id: target, admin: null }] } }).run();
  assert.equal(result.isCmd, true);
  assert.equal(result.command, 'banir');
  assert.equal(result.q, '');
  assert.deepEqual(result.args, []);
  assert.equal(result.menc_os2, target);
});

test('ponte transforma fechamento natural em operação imediata mesmo se o modelo escolher agendamento', async () => {
  const result = await planningHarness({ group: true, text: 'Shogun, fecha o grupo',
    action: { command: 'fechargp', args: [] } }).run();
  assert.equal(result.isCmd, true);
  assert.equal(result.command, 'grupo');
  assert.equal(result.q, 'fechar');
  assert.deepEqual(result.args, ['fechar']);
});

test('bateria natural ampla atravessa planejador, revalidação e parser principal', async t => {
  const target = '5511999999999@s.whatsapp.net';
  const scenarios = [
    ['QR code', 'Shogun, cria um QR code com https://example.com', { command: 'qrcode', args: ['https://example.com'] }, 'qrcode', 'https://example.com'],
    ['pesquisa', 'Shogun, pesquisa por melhores filmes de samurai', { command: 'pesquisar', args: ['melhores filmes de samurai'] }, 'pesquisar', 'melhores filmes de samurai'],
    ['pesquisa de imagem', 'Shogun, busca uma imagem de um gato preto', { command: 'pinterest', args: ['um gato preto'] }, 'pinterest', 'um gato preto'],
    ['geração de imagem', 'Shogun, gera uma imagem de um gato samurai', { command: 'imagem', args: ['um gato samurai'] }, 'imagem', 'um gato samurai'],
    ['perfil', 'Shogun, mostra meu perfil', { command: 'perfil', args: [] }, 'perfil', ''],
    ['carteira', 'Shogun, consulta minha carteira', { command: 'carteira', args: [] }, 'carteira', ''],
    ['regras', 'Shogun, mostra as regras', { command: 'regras', args: [] }, 'regras', '', true],
    ['aviso geral', 'Shogun, avisa todo mundo que a reunião começou', { command: 'hidetag', args: ['a reunião começou'] }, 'hidetag', 'a reunião começou', true],
    ['descrição do grupo', 'Shogun, altera a descrição do grupo para Base dos Samurais', { command: 'setdesc', args: ['Base dos Samurais'] }, 'setdesc', 'Base dos Samurais', true],
    ['advertência', 'Shogun, adverte o @5511999999999 por spam', { command: 'adv', args: [target, 'spam'] }, 'adv', 'spam', true, true],
    ['transferência', 'Shogun, transfere 100 moedas para @5511999999999', { command: 'pix', args: [target, '100'] }, 'pix', '100', true, true],
    ['recompensa diária', 'Shogun, pega minha recompensa diária', { command: 'daily', args: [] }, 'daily', '', true],
    ['loja', 'Shogun, abre a loja', { command: 'loja', args: [] }, 'loja', '', true],
    ['inventário', 'Shogun, lista meu inventário', { command: 'inventario', args: [] }, 'inventario', '', true],
    ['mineração', 'Shogun, minera agora', { command: 'minerar', args: [] }, 'minerar', '', true],
    ['dados', 'Shogun, rola dados apostando 100 moedas', { command: 'dados', args: ['100'] }, 'dados', '100', true],
    ['lembrete', 'Shogun, cria um lembrete em 30m para beber água', { command: 'lembrete', args: ['em 30m para beber água'] }, 'lembrete', 'em 30m para beber água'],
    ['nota', 'Shogun, salva uma nota comprar café', { command: 'nota', args: ['comprar café'] }, 'nota', 'add comprar café'],
    ['lista de notas', 'Shogun, lista minhas notas', { command: 'notas', args: [] }, 'notas', ''],
  ];
  for (const [name, text, action, expectedCommand, expectedQ, group = false, targeted = false] of scenarios) {
    await t.test(name, async () => {
      const probe = planningHarness({ text, action, group, mentions: targeted ? [target] : [],
        metadataAfter: { participants: targeted ? [{ id: target, admin: null }] : [] },
        validCommands: [expectedCommand] });
      const result = await probe.run();
      assert.equal(result.isCmd, true);
      assert.equal(result.command, expectedCommand);
      assert.equal(result.q, expectedQ);
      assert.equal(probe.calls.length, 1);
      assert.equal(result.pendingCommandReaction, '⏳');
    });
  }
});

function actualHandlerCases(startMarker, endMarker) {
  const start = generated.indexOf(startMarker);
  const end = generated.indexOf(endMarker, start);
  assert.ok(start > 0 && end > start, `handler real ausente: ${startMarker}`);
  return generated.slice(start, end);
}

const realHandlers = {
  ban: actualHandlerCases("case 'banir':", "case 'ban2':"),
  promote: actualHandlerCases("case 'promover':", "case 'rebaixar':"),
  demote: actualHandlerCases("case 'rebaixar':", "case 'setname':"),
  setname: actualHandlerCases("case 'setname':", "case 'setdesc':"),
  group: actualHandlerCases("case 'grupo':", "case 'opengp':"),
  ping: actualHandlerCases("case 'ping':", "case 'toimg':"),
  qrcode: actualHandlerCases("case 'qrcode':", "case 'wikipedia':"),
  setdesc: actualHandlerCases("case 'setdesc':", "case 'setfoto':"),
  rules: actualHandlerCases("case 'regras':", "case 'addregra':"),
  note: actualHandlerCases("case 'nota':", "case 'notas':"),
};

function executeRealHandler(handler, { admin = true, prelude = '' } = {}) {
  return `
    const isRealGroupAdmin=${admin},isGroupAdmin=${admin},isBotAdmin=true;
    const validateModerationTarget=async()=>({allowed:true,targetId:menc_os2});
    ${prelude}
    switch(command){${handler}}
  `;
}

test('matriz ponta a ponta chega aos handlers reais e produz cada efeito solicitado', async t => {
  const target = '5511999999999@s.whatsapp.net';
  const scenarios = [
    { name: 'banimento natural', text: 'Shogun, bane o @5511999999999', action: { command: 'banir', args: [target] }, handler: realHandlers.ban,
      expected: ['participants', 'group@g.us', [target], 'remove'] },
    { name: 'promoção natural', text: 'Shogun, promova o @5511999999999', action: { command: 'promover', args: [target] }, handler: realHandlers.promote,
      expected: ['participants', 'group@g.us', [target], 'promote'] },
    { name: 'rebaixamento natural', text: 'Shogun, rebaixe o @5511999999999', action: { command: 'rebaixar', args: [target] }, handler: realHandlers.demote,
      expected: ['participants', 'group@g.us', [target], 'demote'] },
    { name: 'fechamento imediato', text: 'Shogun, fecha o grupo', action: { command: 'fechargp', args: [] }, handler: realHandlers.group,
      expected: ['setting', 'group@g.us', 'announcement'], noTarget: true },
    { name: 'alteração de nome com argumento', text: 'Shogun, execute setname Base Lunar', action: { command: 'setname', args: ['Base', 'Lunar'] }, handler: realHandlers.setname,
      expected: ['subject', 'group@g.us', 'Base Lunar'], noTarget: true },
  ];
  for (const scenario of scenarios) await t.test(scenario.name, async () => {
    const probe = planningHarness({ group: true, text: scenario.text, action: scenario.action,
      mentions: scenario.noTarget ? [] : [target], metadataAfter: { subject: 'Antes', participants: [{ id: target, admin: null }] },
      extraCode: executeRealHandler(scenario.handler) });
    await probe.run();
    assert.deepEqual(probe.effects, [scenario.expected]);
  });

  await t.test('ping privado', async () => {
    const probe = planningHarness({ extraCode: executeRealHandler(realHandlers.ping) });
    await probe.run();
    assert.equal(probe.sent.length, 1);
    assert.match(probe.sent[0][1].text, /STATUS DA CONEXÃO/);
    assert.equal(probe.sent[0][2].quoted, probe.info);
  });
});

test('utilidades e organização natural chegam a mais handlers reais', async t => {
  await t.test('QR code envia mídia com o conteúdo solicitado', async () => {
    const probe = planningHarness({ text: 'Shogun, cria um QR code com https://example.com',
      action: { command: 'qrcode', args: ['https://example.com'] }, validCommands: ['qrcode'],
      extraCode: executeRealHandler(realHandlers.qrcode, { prelude: "const pickLoadingMessage=()=> 'carregando';" }) });
    await probe.run();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(probe.sent.length, 1);
    assert.match(probe.sent[0][1].image.url, /api\.qrserver\.com/);
    assert.match(probe.sent[0][1].caption, /https:\/\/example\.com/);
  });

  await t.test('descrição do grupo produz a mutação autenticada', async () => {
    const probe = planningHarness({ group: true, text: 'Shogun, altera a descrição do grupo para Base dos Samurais',
      action: { command: 'setdesc', args: ['Base dos Samurais'] }, validCommands: ['setdesc'],
      extraCode: executeRealHandler(realHandlers.setdesc) });
    await probe.run();
    assert.deepEqual(probe.effects, [['description', 'group@g.us', 'Base dos Samurais']]);
  });

  await t.test('regras consulta os dados frescos do grupo', async () => {
    const probe = planningHarness({ group: true, text: 'Shogun, mostra as regras',
      action: { command: 'regras', args: [] }, validCommands: ['regras'], groupAfter: { rules: ['Sem spam', 'Respeite os membros'] },
      metadataAfter: { subject: 'Dojo', participants: [] }, extraCode: executeRealHandler(realHandlers.rules) });
    await probe.run();
    assert.match(probe.replies.at(-1), /1\. Sem spam/);
    assert.match(probe.replies.at(-1), /2\. Respeite os membros/);
  });

  await t.test('nota natural injeta add e grava somente o texto informado', async () => {
    const probe = planningHarness({ text: 'Shogun, salva uma nota comprar café',
      action: { command: 'nota', args: ['add', 'comprar café'] }, validCommands: ['nota'],
      extraCode: executeRealHandler(realHandlers.note, { prelude: `const prefix='!'; const notes={
        addNote:(...values)=>{effects.push(['note',...values]);return {message:'nota salva'};}};` }) });
    await probe.run();
    assert.deepEqual(probe.effects, [['note', '123@lid', 'comprar café', null, '!']]);
    assert.equal(probe.replies.at(-1), 'nota salva');
  });
});

test('mesmo fluxo real recusa banimento quando o autor não é administrador', async () => {
  const target = '5511999999999@s.whatsapp.net';
  const probe = planningHarness({ group: true, text: 'Shogun, bane o @5511999999999',
    action: { command: 'ban', args: [target] }, mentions: [target],
    metadataAfter: { participants: [{ id: target, admin: null }] },
    extraCode: executeRealHandler(realHandlers.ban, { admin: false }) });
  await probe.run();
  assert.deepEqual(probe.effects, []);
  assert.match(probe.replies[0], /restrito a administradores/i);
});

test('disable depois do modelo, alvos ambíguos e pergunta não viram comandos', async () => {
  for (const options of [{ group: true, groupAfter: { assistente: false } },
    { group: true, text: 'Shogun execute ban @456 @789', action: { command: 'ban', args: [] }, mentions: ['456@lid', '789@lid'] },
    { group: true, text: 'Shogun execute promote @456 @789', action: { command: 'promote', args: [] }, mentions: ['456@lid', '789@lid'] },
    { text: 'Shogun como funciona ban?', action: { command: 'ban', args: [] } }]) {
    assert.equal((await planningHarness(options).run()).isCmd, false);
  }
});

test('preparo real do runtime conserva planner e automações sem segunda chamada do modelo', () => {
  const script = fs.readFileSync('dados/src/.scripts/prepareRuntimeSources.js', 'utf8');
  const helper = script.slice(script.indexOf('function replaceRequired('), script.indexOf('function patchAssistantSource('));
  const worker = script.slice(script.indexOf('function patchIndexSource('), script.indexOf('function patchConnectSource('));
  const prepare = new Function(`${helper}\n${worker}\nreturn patchIndexSource;`)();
  const result = prepare(source);
  assert.ok(result.includes('ASSISTANT_PLANNING_BEGIN'));
  assert.ok(result.includes('automacoesV9.prepareCommandMediaContext(socket, from, command, info)'));
  assert.ok(result.includes('automacoesV9.isAutoTranscriptionEnabled(from)'));
  assert.equal((result.match(/assistant\.makeAssistentRequest\(/g) || []).length, 1);
});

const antiPVGate = generated.slice(generated.indexOf('    if (!isGroup) {\n      // Exceção para comandos'), generated.indexOf('    // Enhanced participant ID extraction'));
const pingCase = generated.slice(generated.indexOf("case 'ping':"), generated.indexOf("case 'toimg':", generated.indexOf("case 'ping':")));
const pingHandler = `switch(command) { ${pingCase} }`;

test('gate antiPV real no gerado impede handler; dono adicional fresco funciona e revogação é respeitada', async () => {
  const denied = planningHarness({ policyAfter: { '/db/antipv.json': { mode: 'antipv2' } }, extraCode: antiPVGate + pingHandler });
  assert.equal(await denied.run(), undefined); assert.equal(denied.sent.length, 0); assert.match(denied.replies[0], /grupos/);
  const owner = planningHarness({ additionalOwnerAfter: true, policyAfter: { '/db/antipv.json': { mode: 'antipv2' } }, extraCode: antiPVGate + pingHandler });
  const result = await owner.run(); assert.equal(result.isOwner, true); assert.equal(owner.sent.length, 1);
  assert.match(owner.sent[0][1].text, /STATUS DA CONEXÃO/); assert.equal(owner.sent[0][2].quoted, owner.info);
  const revoked = planningHarness({ initialOwner: true, additionalOwnerAfter: false, policyAfter: { '/db/antipv.json': { mode: 'antipv2' } }, extraCode: antiPVGate + pingHandler });
  assert.equal(await revoked.run(), undefined); assert.equal(revoked.sent.length, 0);
});

test('filtro antilink real usa mensagem original mesmo quando modelo omite URL dos argumentos', async () => {
  const gate = generated.slice(generated.indexOf('    if (isGroup && isAntiLinkSoft'), generated.indexOf('    // AntiLink Hard'));
  const probe = planningHarness({ group: true, text: 'Shogun execute ping https://example.invalid', extraCode:
    `const isAntiLinkSoft=true,isGroupAdmin=false,isParceiro=false; const isUserWhitelisted=()=>false; ${gate} ${pingHandler}` });
  assert.equal(await probe.run(), undefined);
  assert.equal(probe.sent.length, 1); assert.ok(probe.sent[0][1].delete);
  assert.equal(probe.sent.some(call => call[1].text?.includes('STATUS DA CONEXÃO')), false);
});

test('soadm e bloqueio de comando reais recusam ação após modelo sem tocar handler', async () => {
  const soadm = generated.slice(generated.indexOf('    if (isGroup && isCmd && isOnlyAdmin'), generated.indexOf('    if (isGroup && info.message.protocolMessage', generated.indexOf('    if (isGroup && isCmd && isOnlyAdmin')));
  const blocked = generated.slice(generated.indexOf('    if (isGroup && isCmd && !isGroupAdmin && groupData.blockedCommands'), generated.indexOf('    if (isCmd && antiSpamGlobal'));
  for (const [gate, groupAfter] of [[soadm, { soadm: true }], [blocked, { blockedCommands: { ping: true } }]]) {
    const probe = planningHarness({ group: true, groupAfter, extraCode: `const isGroupAdmin=false,isOnlyAdmin=groupData.soadm,soadmBypassCommands=[]; ${gate} ${pingHandler}` });
    assert.equal(await probe.run(), undefined); assert.equal(probe.sent.length, 0); assert.equal(probe.replies.length, 1);
  }
});

function runConversation({ limit = false, delivered = true } = {}) {
  const begin = source.indexOf('    //ANTI FLOOD DE MENSAGENS');
  const end = source.indexOf('    if (!isCmd) {\n      // Se modo soadm ativo', begin);
  const code = source.slice(begin, end);
  const sent = [], commits = [], removals = [];
  const now = Date.now();
  const bindings = { isGroup: true, isGroupAdmin: false, isOwnerOrSub: false, isBotAdmin: true, sender: '123@lid', from: 'group',
    info: { key: { id: 'msg', fromMe: false }, message: {} }, groupFile: '/virtual',
    groupData: limit ? { messageLimit: { enabled: true, limit: 1, interval: 60, action: 'ban', users: { '123@lid': { count: 1, lastReset: now } } } } : {},
    getUserName: () => 'Pessoa', writeJsonFile() {}, optimizer: { invalidateGroup() {} },
    socket: { groupParticipantsUpdate: async (...args) => { removals.push(args); } }, parceriasData: { active: false }, type: 'text',
    reply: async text => { sent.push(text); return delivered ? { key: { id: 'sent' } } : null; }, reagir: async () => {},
    normalizar: value => value, console, assistantMentions: [], isAssistente: true,
    assistantTurn: { kind: 'conversation', response: { resp: [{ resp: 'Resposta planejada.' }], commitConversation: () => commits.push(true) } },
  };
  const run = new Function(...Object.keys(bindings), `return(async()=>{let isCmd=false,assistantEligible=true,assistantBlockedByFilters=false,assistantCommandBody=null,body='Shogun oi',budy2=body;${code}})();`);
  return { run: () => run(...Object.values(bindings)), sent, commits, removals };
}

test('conversa só envia/aprende depois do limite real e apenas com entrega comprovada', async () => {
  const blocked = runConversation({ limit: true }); await blocked.run();
  assert.equal(blocked.removals.length, 1); assert.equal(blocked.sent.includes('Resposta planejada.'), false); assert.equal(blocked.commits.length, 0);
  const failed = runConversation({ delivered: false }); await failed.run(); assert.equal(failed.commits.length, 0);
  const delivered = runConversation(); await delivered.run(); assert.deepEqual(delivered.sent, ['Resposta planejada.']); assert.equal(delivered.commits.length, 1);
});

test('menção autenticada do bot no privado permite pedido sem nome literal', async () => {
  const result = await planningHarness({ text: '@888 execute ping', mentions: ['888@lid'] }).run();
  assert.equal(result.isCmd, true); assert.equal(result.command, 'ping');
});
