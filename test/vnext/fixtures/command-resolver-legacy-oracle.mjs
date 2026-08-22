import fs from 'node:fs';

import * as legacy from '../../../dados/src/utils/commandResolver.js';

const input = fs.readFileSync(0, 'utf8');
const payload = JSON.parse(input || '{}');

const result = {
  tokenCases: (payload.tokenCases || []).map(value => legacy.normalizeCommandToken(value)),
  aliasFixtures: (payload.aliasFixtures || []).map(value => legacy.normalizeCommandAliases(value)),
  resolveCases: (payload.resolveCases || []).map(({ token, aliases }) => legacy.resolveCommandInput(token, aliases || [])),
};

// helpers.js mantém timers de runtime no topo do módulo. Este oráculo roda em
// processo isolado para que o teste de paridade não herde esses handles.
fs.writeFileSync(1, JSON.stringify(result));
process.exit(0);
