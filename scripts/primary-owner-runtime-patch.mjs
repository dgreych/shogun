export function patchPrimaryOwnerRuntime(source) {
  const replacements = [
    [
      'const isSubOwner = isSubdono(sender);',
      'const isSubOwner = isSubdono(sender) && !automacoesV9.isPrimaryOwner(sender, numerodono, lidowner, info.key.fromMe);',
    ],
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
  let output = source;
  for (const [before, after] of replacements) {
    if (output.includes(after)) continue;
    if (output.split(before).length !== 2) throw new Error('Cadastro de donos: guarda de produção divergente.');
    output = output.replace(before, after);
  }
  return output;
}
