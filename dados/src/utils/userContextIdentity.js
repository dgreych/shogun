const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);

export function migrateUserContextIdentity(value) {
  if (!isRecord(value)) return value;
  const result = { ...value };
  const currentKey = 'relacionamento_shogun';
  const previousKeys = Object.keys(result).filter(key => key.startsWith('relacionamento_') && key !== currentKey);
  const previous = previousKeys.map(key => result[key]).filter(isRecord);
  for (const key of previousKeys) delete result[key];
  const current = isRecord(result[currentKey]) ? result[currentKey] : null;
  if (!previous.length && !current) return result;

  const relationship = Object.assign({}, ...previous, current);
  const nicknameKeys = Object.keys(relationship).filter(key => key.startsWith('apelido_') && key !== 'apelido_shogun');
  if (!Object.hasOwn(relationship, 'apelido_shogun')) {
    relationship.apelido_shogun = nicknameKeys.map(key => relationship[key]).find(value => value != null) ?? null;
  }
  for (const key of nicknameKeys) delete relationship[key];
  for (const key of ['memorias_especiais', 'conversas_marcantes']) {
    const entries = [...previous, current].filter(Boolean).flatMap(record => Array.isArray(record[key]) ? record[key] : []);
    if (!entries.length && !Object.hasOwn(relationship, key)) continue;
    const unique = new Map(entries.map(entry => [JSON.stringify(entry), entry]));
    relationship[key] = [...unique.values()];
  }
  result[currentKey] = relationship;
  return result;
}
