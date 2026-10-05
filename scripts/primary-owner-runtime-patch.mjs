export function patchPrimaryOwnerRuntime(source) {
  const guardedSubOwner = 'isSubdono(sender) && !automacoesV9.isPrimaryOwner(sender, numerodono, lidowner, info.key.fromMe)';
  let output = source.replace(
    /((?:const|let) isSubOwner = )isSubdono\(sender\);/gu,
    `$1${guardedSubOwner};`
  );
  if (!output.includes(guardedSubOwner)) {
    throw new Error('Cadastro de donos: guarda de produção divergente.');
  }

  const replacements = [
    [
      'donoPrincipal: nmrdn, enviadoPeloBot: isBotSender',
      'donoPrincipal: automacoesV9.isPrimaryOwner(sender, numerodono, lidowner, info.key.fromMe) ? sender : nmrdn, enviadoPeloBot: isBotSender',
    ],
    [
      '(sender === nmrdn || isBotSender)',
      '(automacoesV9.isPrimaryOwner(sender, numerodono, lidowner, info.key.fromMe) || isBotSender)',
    ],
    [
      'ownerIds: [nmrdn, ownerJid, lidowner].filter(Boolean)',
      'ownerIds: [nmrdn, ownerJid, lidowner, ...automacoesV9.getPrimaryOwners()].filter(Boolean)',
    ],
  ];
  for (const [before, after] of replacements) {
    if (output.includes(after)) continue;
    if (output.split(before).length !== 2) throw new Error('Cadastro de donos: guarda de produção divergente.');
    output = output.replace(before, after);
  }
  return output;
}
