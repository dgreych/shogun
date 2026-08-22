import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EXTERNAL_TOOLS_NATIVE_COMMAND_TOKENS,
  ExternalToolsDomainDispatchTarget,
} from '../../dist-vnext/tools/external-domain.js';

function baseContext(overrides = {}) {
  const replies = [];
  const sent = [];
  return {
    prefix: '!',
    query: '',
    sender: '5511999999999@s.whatsapp.net',
    groupId: '120363000000000000@g.us',
    pushName: 'Mauricio',
    isGroup: true,
    groupData: {},
    message: { key: { id: 'quoted-message' } },
    socket: {
      sendMessage: async (...args) => { sent.push(args); },
    },
    reply: async (text) => { replies.push(text); },
    replies,
    sent,
    ...overrides,
  };
}

test('catálogo externo possui duas famílias e seis tokens sem duplicata', () => {
  assert.equal(EXTERNAL_TOOLS_NATIVE_COMMAND_TOKENS.length, 6);
  assert.equal(new Set(EXTERNAL_TOOLS_NATIVE_COMMAND_TOKENS).size, 6);
  for (const token of ['clima', 'tempo', 'weather', 'previsao', 'horoscopo', 'signo']) {
    assert.ok(EXTERNAL_TOOLS_NATIVE_COMMAND_TOKENS.includes(token), `token externo ausente: ${token}`);
  }
});

test('clima preserva endpoint wttr, timeout, user-agent e formatação da previsão', async () => {
  const calls = [];
  const httpGet = async (...args) => {
    calls.push(args);
    return {
      data: {
        current_condition: [{
          temp_C: '24',
          FeelsLikeC: '25',
          humidity: '70',
          windspeedKmph: '11',
          winddir16Point: 'NE',
          uvIndex: '5',
          visibility: '10',
          cloudcover: '60',
          lang_pt: [{ value: 'Parcialmente nublado' }],
          weatherDesc: [{ value: 'Partly cloudy' }],
        }],
        nearest_area: [{
          areaName: [{ value: 'São Paulo' }],
          region: [{ value: 'São Paulo' }],
          country: [{ value: 'Brazil' }],
        }],
        weather: [
          { date: '2026-08-19', mintempC: '17', maxtempC: '26' },
          { date: '2026-08-20', mintempC: '18', maxtempC: '27' },
          { date: '2026-08-21', mintempC: '19', maxtempC: '28' },
          { date: '2026-08-22', mintempC: '20', maxtempC: '29' },
        ],
      },
    };
  };
  const domain = new ExternalToolsDomainDispatchTarget(httpGet);
  const context = baseContext({ query: 'São Paulo' });

  assert.equal(await domain.dispatch('weather', context), true);
  assert.deepEqual(calls, [[
    'https://wttr.in/S%C3%A3o%20Paulo?format=j1&lang=pt',
    { timeout: 120000, headers: { 'User-Agent': 'curl/7.68.0' } },
  ]]);
  assert.equal(context.replies[0], '🌤️ Consultando previsão do tempo... ⏳');
  assert.match(context.replies[1], /^⛅ \*Clima em São Paulo\*/);
  assert.match(context.replies[1], /🌡️ \*Temperatura:\* 24°C/);
  assert.match(context.replies[1], /• 19\/08\/2026: 17°C - 26°C/);
  assert.match(context.replies[1], /• 21\/08\/2026: 19°C - 28°C/);
  assert.doesNotMatch(context.replies[1], /22\/08\/2026/);
});

test('clima sem cidade e falha HTTP preservam mensagens legadas', async () => {
  const domain = new ExternalToolsDomainDispatchTarget(async () => { throw new Error('offline'); });
  const missing = baseContext();
  assert.equal(await domain.dispatch('clima', missing), true);
  assert.match(missing.replies[0], /Previsão do Tempo/);
  assert.match(missing.replies[0], /!clima São Paulo/);

  const failed = baseContext({ query: 'Cidade X' });
  assert.equal(await domain.dispatch('tempo', failed), true);
  assert.deepEqual(failed.replies, [
    '🌤️ Consultando previsão do tempo... ⏳',
    '❌ Não consegui encontrar informações do clima para essa cidade. Verifique o nome e tente novamente!',
  ]);
});

test('horoscopo normaliza acentos, consulta endpoint legado e envia imagem com legenda', async () => {
  const calls = [];
  const httpGet = async (...args) => {
    calls.push(args);
    return {
      data: {
        resultado: {
          signo: 'aries',
          dia: '19/08/2026',
          previsao: 'Dia favorável para projetos.',
          url: 'https://horoscopo.example/aries',
          imagem: 'https://horoscopo.example/aries.png',
        },
      },
    };
  };
  const domain = new ExternalToolsDomainDispatchTarget(httpGet);
  const context = baseContext({ query: 'Áries' });

  assert.equal(await domain.dispatch('signo', context), true);
  assert.deepEqual(calls, [['https://apisnodz.com.br/api/pesquisas/horoscopo?query=aries']]);
  assert.deepEqual(context.replies, []);
  assert.equal(context.sent.length, 1);
  assert.equal(context.sent[0][0], context.groupId);
  assert.deepEqual(context.sent[0][1].image, { url: 'https://horoscopo.example/aries.png' });
  assert.match(context.sent[0][1].caption, /^🔮 \*HORÓSCOPO\* 🔮/);
  assert.match(context.sent[0][1].caption, /♈ \*Signo:\* Aries/);
  assert.match(context.sent[0][1].caption, /Dia favorável para projetos\./);
  assert.deepEqual(context.sent[0][2], { quoted: context.message });
});

test('horoscopo recusa signo inválido e não chama rede', async () => {
  let calls = 0;
  const domain = new ExternalToolsDomainDispatchTarget(async () => { calls += 1; return { data: {} }; });
  const context = baseContext({ query: 'serpentário' });

  assert.equal(await domain.dispatch('horoscopo', context), true);
  assert.equal(calls, 0);
  assert.match(context.replies[0], /Signo inválido!/);
});

test('domínio externo recusa comando fora da superfície', async () => {
  const domain = new ExternalToolsDomainDispatchTarget(async () => ({ data: {} }));
  const context = baseContext();
  assert.equal(await domain.dispatch('qrcode', context), false);
  assert.deepEqual(context.replies, []);
  assert.deepEqual(context.sent, []);
});
