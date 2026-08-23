import assert from 'node:assert/strict';
import test from 'node:test';

import { ALASKA } from '../../dist-vnext/voice/personas/alaska.js';
import { NAZUNA } from '../../dist-vnext/voice/personas/nazuna.js';
import { aplicarFloreio, obterPersona, personasRegistradas } from '../../dist-vnext/voice/persona.js';
import { OBRIGACOES, resolveBotName, NOME_PADRAO } from '../../dist-vnext/voice/contract.js';

/**
 * O !changeperso troca a persona POR COMPLETO. A arquitetura anterior errava
 * nisso: a identidade base carregava traços de personalidade, então escolher
 * outra persona devolvia a nova com o sotaque da antiga — o defeito que existe
 * hoje, em que trocar para Zenitsu ainda dá menus falando como Gyomei.
 */

test('nenhum marcador de uma persona aparece nos floreios de outra', () => {
  const personas = personasRegistradas();
  assert.ok(personas.length >= 2, 'o teste precisa de ao menos duas personas');

  for (const persona of personas) {
    for (const outra of personas) {
      if (outra.chave === persona.chave) continue;
      const texto = outra.floreios.join(' ').toLowerCase();
      for (const marcador of persona.marcadores) {
        assert.equal(
          texto.includes(marcador.toLowerCase()),
          false,
          `marcador "${marcador}" de ${persona.nome} vazou para ${outra.nome}`,
        );
      }
    }
  }
});

test('trocar de persona troca o floreio inteiro, sem resquício', () => {
  const comAlaska = aplicarFloreio('🔍 Procurando "gatos".', ALASKA, () => 0);
  const comNazuna = aplicarFloreio('🔍 Procurando "gatos".', NAZUNA, () => 0);

  assert.notEqual(comAlaska, comNazuna);
  for (const marcador of ALASKA.marcadores) {
    assert.equal(comNazuna.toLowerCase().includes(marcador.toLowerCase()), false);
  }
});

test('o conteúdo verdadeiro sobrevive à troca de persona', () => {
  // A persona acrescenta, nunca reescreve: o assunto do pedido não pode sumir
  // no meio do enfeite.
  for (const persona of personasRegistradas()) {
    const texto = aplicarFloreio('🔍 Procurando "zenitsu wallpaper 4k".', persona, () => 0);
    assert.match(texto, /zenitsu wallpaper 4k/);
    assert.match(texto, /Procurando/);
  }
});

test('SHOGUN é o nome padrão e Alaska continua uma persona fantasma isolada', () => {
  assert.equal(ALASKA.chave, 'alaska');
  assert.equal(ALASKA.natureza, 'fantasma');
  assert.equal(resolveBotName({}), NOME_PADRAO);
  assert.equal(NOME_PADRAO, '𝖘𝖍𝖔𝖌𝖚𝖓');
  assert.ok(!/SHOGUN|Shogun/.test(NOME_PADRAO), 'o nome nunca sai em letra comum');
});

test('cada persona declara sua natureza, que nem sempre é sobrenatural', () => {
  for (const persona of personasRegistradas()) {
    assert.ok(persona.natureza, `${persona.nome} sem natureza declarada`);
  }
  assert.equal(NAZUNA.natureza, 'vampira');
});

test('o contrato de qualidade existe e não carrega voz', () => {
  assert.ok(OBRIGACOES.length >= 5);
  // Se o contrato citasse termo de persona, teria virado voz compartilhada —
  // que é exatamente o que não pode acontecer.
  const texto = OBRIGACOES.join(' ').toLowerCase();
  for (const persona of personasRegistradas()) {
    for (const marcador of persona.marcadores) {
      assert.equal(texto.includes(marcador.toLowerCase()), false, `contrato contaminado por ${persona.nome}`);
    }
  }
});

test('persona desconhecida não devolve outra por engano', () => {
  assert.equal(obterPersona('inexistente'), null);
  assert.equal(obterPersona('alaska')?.chave, 'alaska');
});
