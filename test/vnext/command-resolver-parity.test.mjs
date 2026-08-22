import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import * as vnext from '../../dist-vnext/commands/input-resolver.js';

const tokenCases = [' D ', 'DÉLÉTAR', ' a  b ', '', null, undefined, 0, false, 'Áudio'];

const aliasFixtures = [
  [],
  {
    aliases: [
      { alias: 'Atálho', command: ' Cômando ', fixedParams: ' x y ', extra: 7 },
      { alias: 'atalho', command: 'segundo', fixedParams: 'z' },
      { alias: 'd', command: 'perigoso' },
      { alias: '', command: 'vazio' },
      null,
    ],
  },
  [
    { alias: 'Teste Um', command: 'Destino Um' },
    { alias: 'Outro', command: 'Destino Dois', fixedParams: 123 },
  ],
];

const resolveCases = [
  { token: 'DÉLÉTAR', aliases: [] },
  { token: ' ÓI ', aliases: [{ alias: 'oi', command: 'menu', fixedParams: '  abc  ' }] },
  { token: ' Áudio ', aliases: [] },
];

const oraclePath = fileURLToPath(new URL('./fixtures/command-resolver-legacy-oracle.mjs', import.meta.url));
const legacy = JSON.parse(execFileSync(process.execPath, [oraclePath], {
  input: JSON.stringify({ tokenCases, aliasFixtures, resolveCases }),
  encoding: 'utf8',
  timeout: 10_000,
}));

for (const [index, value] of tokenCases.entries()) {
  test(`normalizeCommandToken parity: ${String(value)}`, () => {
    assert.equal(vnext.normalizeCommandToken(value), legacy.tokenCases[index]);
  });
}

for (const [index, fixture] of aliasFixtures.entries()) {
  test(`normalizeCommandAliases parity: ${index}`, () => {
    assert.deepEqual(vnext.normalizeCommandAliases(fixture), legacy.aliasFixtures[index]);
  });
}

test('resolveCommandInput parity: builtin', () => {
  assert.deepEqual(vnext.resolveCommandInput(resolveCases[0].token, resolveCases[0].aliases), legacy.resolveCases[0]);
});

test('resolveCommandInput parity: custom', () => {
  assert.deepEqual(vnext.resolveCommandInput(resolveCases[1].token, resolveCases[1].aliases), legacy.resolveCases[1]);
});

test('resolveCommandInput parity: direct', () => {
  assert.deepEqual(vnext.resolveCommandInput(resolveCases[2].token, resolveCases[2].aliases), legacy.resolveCases[2]);
});
