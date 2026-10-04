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
  mentions = [], configAfter = {}, response, duringRequest, extraCode = '', policyAfter = {}, initialOwner = false, additionalOwnerAfter = false } = {}) {
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
    info, from: info.key.remoteJid, sender: '123@lid', pushname: 'Pessoa', isGroup: group,
    socket: { user: { id: '999:1@s.whatsapp.net', lid: '888@lid' },
      sendMessage: async (...args) => { sent.push(args); return { key: { id: 'sent' } }; },
      groupMetadata: async () => { reads.push('metadata'); return metadataAfter; },
      groupParticipantsUpdate: async (...args) => { effects.push(['participants', ...args]); },
      groupSettingUpdate: async (...args) => { effects.push(['setting', ...args]); },
      groupUpdateSubject: async (...args) => { effects.push(['subject', ...args]); } },
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
    getValidCommandSet: () => new Set(['ping', 'ban', 'grupo']),
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
};

function executeRealHandler(handler, { admin = true } = {}) {
  return `
    const isRealGroupAdmin=${admin},isGroupAdmin=${admin},isBotAdmin=true;
    const validateModerationTarget=async()=>({allowed:true,targetId:menc_os2});
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
