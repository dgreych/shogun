const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);

export function projectSingleIdentity(stored = {}, previousDefault = '') {
  const source = isRecord(stored) ? stored : {};
  const commandMedia = isRecord(source.commandMedia) ? { ...source.commandMedia } : {};
  const prompts = isRecord(source.assistantPrompts) ? source.assistantPrompts : {};
  const selectedScope = String(source.activePersona || previousDefault || '').trim().toLowerCase();
  const scopes = new Set([selectedScope, ...Object.keys(prompts)]);
  scopes.delete('');
  scopes.delete('shogun');
  for (const scope of scopes) {
    const prefix = `${scope}_`;
    for (const [command, media] of Object.entries(commandMedia)) {
      if (!command.startsWith(prefix)) continue;
      const current = `shogun_${command.slice(prefix.length)}`;
      if (!Object.hasOwn(commandMedia, current)) commandMedia[current] = media;
      delete commandMedia[command];
    }
  }
  return {
    ...source,
    activePersona: 'shogun',
    autoTranscriptionGroups: source.autoTranscriptionGroups || {},
    commandMedia,
    additionalOwners: Array.isArray(source.additionalOwners) ? source.additionalOwners : [],
    assistantPrompts: Object.hasOwn(prompts, 'shogun') ? { shogun: prompts.shogun } : {},
  };
}

export function projectGroupCustomization(stored) {
  if (!isRecord(stored)) return { enabled: false, groups: {} };
  const groups = isRecord(stored.groups) ? stored.groups : {};
  return {
    ...stored,
    groups: Object.fromEntries(Object.entries(groups).map(([id, value]) => {
      if (!isRecord(value)) return [id, value];
      const { customPersona, ...current } = value;
      if (customPersona && customPersona !== 'shogun') delete current.customName;
      return [id, current];
    })),
  };
}
