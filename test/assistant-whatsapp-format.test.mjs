import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../dados/src/funcs/private/assistant.js', import.meta.url), 'utf8');
const start = source.indexOf('function cleanWhatsAppFormatting(');
const end = source.indexOf('function stripJsonComments(', start);
assert.ok(start >= 0 && end > start);
const format = new Function(`${source.slice(start, end)}\nreturn cleanWhatsAppFormatting;`)();

test('uma explicação técnica conserva o código e sua indentação no WhatsApp', () => {
  const code = '```\nconst items = [1, 2];\nfor (const item of items) {\n  console.log(item);\n}\n```';
  assert.equal(format(`**Exemplo:**\n\n${code}\n\nExecute no terminal.`), `*Exemplo:*\n\n${code}\n\nExecute no terminal.`);
});

test('trechos de código inline conservam caracteres especiais sem reinterpretar a expressão', () => {
  assert.equal(format('Use `a ** b` para a potência.'), 'Use `a ** b` para a potência.');
});

test('a proteção de código não junta as palavras ao redor do trecho', () => {
  assert.equal(format('Leia **com atenção** o campo `user_name` antes de continuar.'), 'Leia *com atenção* o campo `user_name` antes de continuar.');
});

test('texto comum continua convertido para negrito e itálico de WhatsApp', () => {
  assert.equal(format('**Pronto**\n\n__Resultado__'), '*Pronto*\n\n_Resultado_');
});
