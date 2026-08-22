import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAtomicDomainOwnership } from './vnextDomainOwnershipOverlay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEEDS_FILE = path.join(__dirname, 'vnextMacrotrancheSeeds.json');
const CUTOVER_FILE = path.join(__dirname, 'vnextDomainCutoverPlan.json');
const MAIN_SWITCH_ANCHOR = '    switch (command) {';
export const MACROTRANCHE_BRIDGE_MARKER = '    // ===== VNEXT MACROTRANCHE LEGACY BRIDGE =====';

function readSeedConfig() {
  const parsed = JSON.parse(fs.readFileSync(SEEDS_FILE, 'utf8'));
  if (
    parsed?.schemaVersion !== 4
    || parsed?.selectionMode !== 'all-non-native'
    || !parsed?.expected
    || !Array.isArray(parsed?.nativeSeeds)
    || !parsed?.buckets
  ) {
    throw new Error('Contrato de ownership vNext inválido.');
  }
  return parsed;
}

function readCutoverConfig() {
  const parsed = JSON.parse(fs.readFileSync(CUTOVER_FILE, 'utf8'));
  if (parsed?.schemaVersion !== 2 || parsed?.strategy !== 'atomic-domain-cutover') {
    throw new Error('Contrato de cutover atômico inválido.');
  }
  return parsed;
}

function isIdentifierPart(char) {
  return /[A-Za-z0-9_$]/.test(char || '');
}

function skipQuoted(source, start, quote) {
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i + 1;
    i += 1;
  }
  throw new Error(`String ${quote} não terminada no runtime legado.`);
}

function skipComment(source, start) {
  if (source[start + 1] === '/') {
    const end = source.indexOf('\n', start + 2);
    return end === -1 ? source.length : end + 1;
  }
  if (source[start + 1] === '*') {
    const end = source.indexOf('*/', start + 2);
    if (end === -1) throw new Error('Comentário de bloco não terminado no runtime legado.');
    return end + 2;
  }
  return start;
}

const REGEX_PREFIX_KEYWORDS = new Set([
  'await', 'case', 'delete', 'do', 'else', 'in', 'instanceof', 'new',
  'of', 'return', 'throw', 'typeof', 'void', 'yield',
]);

function isRegexStart(source, start) {
  if (source[start] !== '/' || source[start + 1] === '/' || source[start + 1] === '*') return false;
  let i = start - 1;
  while (i >= 0 && /\s/.test(source[i])) i -= 1;
  if (i < 0) return true;
  const previous = source[i];
  if ('([{=,:;!?&|^~<>+-*%'.includes(previous) || previous === '>') return true;
  if (isIdentifierPart(previous)) {
    const end = i + 1;
    while (i >= 0 && isIdentifierPart(source[i])) i -= 1;
    return REGEX_PREFIX_KEYWORDS.has(source.slice(i + 1, end));
  }
  return false;
}

function skipRegex(source, start) {
  let i = start + 1;
  let inClass = false;
  while (i < source.length) {
    const char = source[i];
    if (char === '\\') {
      i += 2;
      continue;
    }
    if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) {
      i += 1;
      while (/[A-Za-z]/.test(source[i] || '')) i += 1;
      return i;
    }
    i += 1;
  }
  throw new Error('Literal regex não terminado no runtime legado.');
}

function skipTemplateExpression(source, openBraceIndex) {
  let depth = 1;
  for (let i = openBraceIndex + 1; i < source.length;) {
    const char = source[i];
    if (char === "'" || char === '"') {
      i = skipQuoted(source, i, char);
      continue;
    }
    if (char === '`') {
      i = skipTemplate(source, i);
      continue;
    }
    if (char === '/' && (source[i + 1] === '/' || source[i + 1] === '*')) {
      i = skipComment(source, i);
      continue;
    }
    if (char === '/' && isRegexStart(source, i)) {
      i = skipRegex(source, i);
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
  throw new Error('Expressão de template não terminada no runtime legado.');
}

function skipTemplate(source, start) {
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === '`') return i + 1;
    if (source[i] === '$' && source[i + 1] === '{') {
      i = skipTemplateExpression(source, i + 1);
      continue;
    }
    i += 1;
  }
  throw new Error('Template literal não terminado no runtime legado.');
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length;) {
    const char = source[i];
    if (char === "'" || char === '"') {
      i = skipQuoted(source, i, char);
      continue;
    }
    if (char === '`') {
      i = skipTemplate(source, i);
      continue;
    }
    if (char === '/' && (source[i + 1] === '/' || source[i + 1] === '*')) {
      i = skipComment(source, i);
      continue;
    }
    if (char === '/' && isRegexStart(source, i)) {
      i = skipRegex(source, i);
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  throw new Error('switch(command) principal não terminou corretamente.');
}

function findMainSwitch(source) {
  const occurrences = source.split(MAIN_SWITCH_ANCHOR).length - 1;
  if (occurrences !== 1) {
    throw new Error(`switch(command) principal precisa ser único; encontrado ${occurrences}.`);
  }
  const anchorIndex = source.indexOf(MAIN_SWITCH_ANCHOR);
  const openIndex = anchorIndex + MAIN_SWITCH_ANCHOR.lastIndexOf('{');
  const closeIndex = findMatchingBrace(source, openIndex);
  return {
    anchorIndex,
    openIndex,
    closeIndex,
    body: source.slice(openIndex + 1, closeIndex),
  };
}

function parseStringLiteral(source, start) {
  const quote = source[start];
  if (quote !== "'" && quote !== '"') return null;
  let i = start + 1;
  let value = '';
  while (i < source.length) {
    const char = source[i];
    if (char === '\\') {
      const next = source[i + 1];
      if (next === undefined) throw new Error('Escape inválido em case legado.');
      value += next;
      i += 2;
      continue;
    }
    if (char === quote) return { value, end: i + 1 };
    value += char;
    i += 1;
  }
  throw new Error('Literal de case não terminado.');
}

function collectTopLevelCases(body) {
  const cases = [];
  let depth = 0;
  for (let i = 0; i < body.length;) {
    const char = body[i];
    if (char === "'" || char === '"') {
      i = skipQuoted(body, i, char);
      continue;
    }
    if (char === '`') {
      i = skipTemplate(body, i);
      continue;
    }
    if (char === '/' && (body[i + 1] === '/' || body[i + 1] === '*')) {
      i = skipComment(body, i);
      continue;
    }
    if (char === '/' && isRegexStart(body, i)) {
      i = skipRegex(body, i);
      continue;
    }
    if (char === '{') {
      depth += 1;
      i += 1;
      continue;
    }
    if (char === '}') {
      depth = Math.max(0, depth - 1);
      i += 1;
      continue;
    }
    if (
      depth === 0
      && body.startsWith('case', i)
      && !isIdentifierPart(body[i - 1])
      && !isIdentifierPart(body[i + 4])
    ) {
      let cursor = i + 4;
      while (/\s/.test(body[cursor] || '')) cursor += 1;
      const literal = parseStringLiteral(body, cursor);
      if (!literal) throw new Error(`Case não literal próximo ao offset ${i}.`);
      cursor = literal.end;
      while (/\s/.test(body[cursor] || '')) cursor += 1;
      if (body[cursor] !== ':') throw new Error(`Case sem ':' para ${literal.value}.`);
      cases.push({ token: literal.value.trim().toLowerCase(), start: i, colonEnd: cursor + 1 });
      i = cursor + 1;
      continue;
    }
    i += 1;
  }
  return cases;
}

function isOnlyTrivia(source) {
  for (let i = 0; i < source.length;) {
    if (/\s/.test(source[i])) {
      i += 1;
      continue;
    }
    if (source[i] === '/' && (source[i + 1] === '/' || source[i + 1] === '*')) {
      i = skipComment(source, i);
      continue;
    }
    return false;
  }
  return true;
}

function collectFamilies(body) {
  const events = collectTopLevelCases(body);
  const families = [];
  let current = null;
  for (const event of events) {
    if (!current) {
      current = { tokens: [event.token], firstStart: event.start, lastColonEnd: event.colonEnd };
      continue;
    }
    const between = body.slice(current.lastColonEnd, event.start);
    if (isOnlyTrivia(between)) {
      current.tokens.push(event.token);
      current.lastColonEnd = event.colonEnd;
      continue;
    }
    families.push({ tokens: current.tokens, start: current.firstStart, end: event.start });
    current = { tokens: [event.token], firstStart: event.start, lastColonEnd: event.colonEnd };
  }
  if (current) families.push({ tokens: current.tokens, start: current.firstStart, end: body.length });
  return families;
}

function resolveSeeds(families, seeds, label) {
  const indexes = new Set();
  const unresolved = [];
  for (const seed of seeds) {
    const matches = families
      .map((family, index) => ({ family, index }))
      .filter(({ family }) => family.tokens.includes(seed));
    if (matches.length === 0) {
      unresolved.push(seed);
      continue;
    }
    if (matches.length > 1) {
      throw new Error(`Seed ${seed} de ${label} é ambíguo: ${matches.map(({ index }) => index).join(',')}.`);
    }
    indexes.add(matches[0].index);
  }
  return { indexes, unresolved };
}

function tokensForIndexes(families, indexes) {
  return new Set([...indexes].flatMap((index) => families[index]?.tokens || []));
}

export function planMacrotrancheBridge(source) {
  const config = readSeedConfig();
  const cutoverConfig = readCutoverConfig();
  const { body } = findMainSwitch(source);
  const families = collectFamilies(body);
  const baselineNative = resolveSeeds(families, config.nativeSeeds, 'native');
  if (baselineNative.unresolved.length > 0) {
    throw new Error(`Seeds nativos não resolvidos: ${baselineNative.unresolved.join(',')}.`);
  }

  const overlay = applyAtomicDomainOwnership({
    families,
    baseNativeIndexes: baselineNative.indexes,
    seedConfig: config,
    cutoverConfig,
  });
  const nativeIndexes = overlay.nativeIndexes;
  const compatibilityIndexes = new Set(
    families.map((_, index) => index).filter((index) => !nativeIndexes.has(index)),
  );
  const nativeTokens = tokensForIndexes(families, nativeIndexes);
  const compatibilityTokens = tokensForIndexes(families, compatibilityIndexes);
  const overlap = [...nativeTokens].filter((token) => compatibilityTokens.has(token));
  if (overlap.length > 0) {
    throw new Error(`Ownership parcial entre nativo e compatível: ${overlap.join(',')}.`);
  }

  const expected = {
    nativeFamilies: config.expected.nativeFamilies + overlay.delta.nativeFamilies,
    nativeTokens: config.expected.nativeTokens + overlay.delta.nativeTokens,
    compatibilityFamilies: config.expected.compatibilityFamilies + overlay.delta.compatibilityFamilies,
    compatibilityTokens: config.expected.compatibilityTokens + overlay.delta.compatibilityTokens,
  };
  if (
    nativeIndexes.size !== expected.nativeFamilies
    || nativeTokens.size !== expected.nativeTokens
    || compatibilityIndexes.size !== expected.compatibilityFamilies
    || compatibilityTokens.size !== expected.compatibilityTokens
  ) {
    throw new Error(
      `Drift de ownership: nativo esperado=${expected.nativeFamilies}/${expected.nativeTokens} `
      + `real=${nativeIndexes.size}/${nativeTokens.size}; compat esperado=`
      + `${expected.compatibilityFamilies}/${expected.compatibilityTokens} `
      + `real=${compatibilityIndexes.size}/${compatibilityTokens.size}.`,
    );
  }

  return {
    expected,
    activeDomains: overlay.activeDomains,
    families,
    nativeIndexes,
    compatibilityIndexes,
    nativeTokens: [...nativeTokens].sort(),
    tokens: [...compatibilityTokens].sort(),
    nativeFamilyCount: nativeIndexes.size,
    nativeTokenCount: nativeTokens.size,
    familyCount: compatibilityIndexes.size,
    tokenCount: compatibilityTokens.size,
  };
}

export function buildMacrotrancheLegacyBridge(source) {
  if (source.includes(MACROTRANCHE_BRIDGE_MARKER)) return source;
  const mainSwitch = findMainSwitch(source);
  const plan = planMacrotrancheBridge(source);
  const tokenLiteral = JSON.stringify(plan.tokens);
  const compatibilityBody = [...plan.compatibilityIndexes]
    .sort((a, b) => a - b)
    .map((index) => {
      const family = plan.families[index];
      return mainSwitch.body.slice(family.start, family.end);
    })
    .join('');

  const bridge = `${MACROTRANCHE_BRIDGE_MARKER}\n`
    + `    const __gyomeiMacrotrancheOwnedCommands = new Set(${tokenLiteral});\n`
    + '    const __gyomeiExecuteMacrotrancheLegacy = async (__gyomeiCommand) => {\n'
    + `      switch (__gyomeiCommand) {${compatibilityBody}\n      }\n`
    + '    };\n\n';

  return source.slice(0, mainSwitch.anchorIndex) + bridge + source.slice(mainSwitch.anchorIndex);
}
