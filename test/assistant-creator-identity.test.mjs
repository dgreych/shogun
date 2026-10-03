import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const compiled = new URL('../dist-vnext/assistant/creator-identity.js', import.meta.url);
const identity = fs.existsSync(compiled) ? await import(compiled.href) : {};
const creator = '5521999990001'; // fictício: nunca usar o contato privado nos testes públicos.
const pn = `${creator}@s.whatsapp.net`;
const lid = '987654321098765@lid';
async function recognize(sender, socket = null, configured = creator) {
  assert.equal(typeof identity.recognizeCreator, 'function', 'reconhecimento ainda não implementado');
  return identity.recognizeCreator(sender, configured, socket);
}

test('reconhece PN autenticado com sufixo de dispositivo e configuração formatada', async () => {
  assert.equal(await recognize(pn), true);
  assert.equal(await recognize('5521999990001:7@s.whatsapp.net', null, '+55 (21) 99999-0001'), true);
  assert.equal(await recognize(pn, null, '21999990001'), true);
});

test('não confunde os dígitos de um LID com um número e não aceita nomes', async () => {
  for (const sender of [`${creator}@lid`, creator, 'Alaska Dev', 'Maurício Almeida', '123@g.us']) {
    assert.equal(await recognize(sender), false, sender);
  }
  assert.equal(await recognize(pn, null, ''), false);
  assert.equal(await recognize(pn, null, `${creator}@lid`), false);
});

test('reconhece LID pelo mapeamento de identidade do socket', async () => {
  const socket = { signalRepository: { lidMapping: {
    async getPNForLID(value) { return value === lid ? pn : '5521888880002@s.whatsapp.net'; }
  } } };
  assert.equal(await recognize(lid, socket), true);
  assert.equal(await recognize('987654321098765:3@lid', socket), true);
  assert.equal(await recognize('222222222222222@lid', socket), false);
});

test('um LID não herda o limite E164 de tamanho do número de telefone', async () => {
  const socket = { signalRepository: { lidMapping: {
    async getPNForLID(value) { return value === '12345678901234567890@lid' ? pn : null; }
  } } };
  assert.equal(await recognize('12345678901234567890@lid', socket), true);
  assert.equal(await recognize('12345678901234567890@s.whatsapp.net', socket), false);
});

test('reconhece LID pelo lookup inverso e recusa outro participante', async () => {
  const socket = { signalRepository: { lidMapping: {
    async getLIDForPN(value) { return value === pn ? lid : null; }
  } } };
  assert.equal(await recognize(lid, socket), true);
  assert.equal(await recognize('222222222222222@lid', socket), false);
});

test('fallback aceita somente correspondência PN/LID verificada pelo WhatsApp', async () => {
  const socket = { async onWhatsApp(value) {
    return value === pn ? [{ exists: true, jid: pn, lid }] : [];
  } };
  assert.equal(await recognize(lid, socket), true);
  assert.equal(await recognize('222222222222222@lid', socket), false);
  assert.equal(await recognize(lid, { async onWhatsApp() {
    return [{ exists: true, jid: '5521888880002@s.whatsapp.net', lid }];
  } }), false);
  assert.equal(await recognize(lid, { async onWhatsApp() {
    return [{ exists: false, jid: pn, lid }];
  } }), false);
});

test('falhas no mapeamento não inventam reconhecimento nem interrompem conversa', async () => {
  const broken = async () => { throw Error('indisponível'); };
  assert.equal(await recognize(lid, {
    signalRepository: { lidMapping: { getPNForLID: broken, getLIDForPN: broken } },
    onWhatsApp: broken,
  }), false);
});

test('trocar a configuração troca o reconhecimento sem promover outra conta', async () => {
  const socket = { async onWhatsApp(value) {
    return [{ exists: true, jid: value, lid: value === pn ? lid : '333333333333333@lid' }];
  } };
  assert.equal(await recognize(lid, socket), true);
  assert.equal(await recognize(lid, socket, '5521888880002'), false);
  assert.equal(await recognize('333333333333333@lid', socket, '5521888880002'), true);
});

test('uma consulta travada tem prazo e não bloqueia indefinidamente a conversa', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const pending = recognize(lid, { signalRepository: { lidMapping: {
    getPNForLID: () => new Promise(() => {}),
  } } });
  await Promise.resolve();
  await Promise.resolve();
  t.mock.timers.tick(2500);
  assert.equal(await pending, false);
});
