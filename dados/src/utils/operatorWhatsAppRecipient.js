export async function resolveOperatorRecipient(socket, number) {
  const results = await socket.onWhatsApp(number);
  const registered = results?.find(result => result.exists === true);
  const jid = registered?.lid || registered?.jid;
  if (typeof jid !== 'string' || !/^\d+@(?:lid|s\.whatsapp\.net)$/.test(jid)) throw new Error('Não foi possível localizar esse número no WhatsApp.');
  if (typeof socket.assertSessions === 'function') await socket.assertSessions([jid], true);
  return jid;
}
