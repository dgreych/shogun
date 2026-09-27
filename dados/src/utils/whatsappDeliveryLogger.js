import pino from 'pino';

// Só o caminho da entrega entra no log. Chaves e conteúdo ficam de fora.
export function deliveryDiagnostic(record) {
  const event = record?.msg;
  if (typeof event !== 'string' || !/retry|sending message again|received error in ack|decrypt|session|pre.?key/i.test(event)) return null;
  const data = { event };
  const key = record.key || {};
  const attrs = record.attrs || {};
  const jid = key.remoteJid || record.jid || record.participant || attrs.from;
  if (typeof jid === 'string') data.addressType = jid.includes('@g.us') ? 'group' : jid.includes('@lid') ? 'lid' : 'phone';
  const id = key.id || record.id || record.msgId || attrs.id;
  if (typeof id === 'string' && /^[A-F0-9]{8,64}$/i.test(id)) data.id = id;
  if (Number.isFinite(record.retryCount)) data.retryCount = record.retryCount;
  if (attrs.error && /^\d{1,5}$/.test(String(attrs.error))) data.code = String(attrs.error);
  const error = String(record.trace || record.err?.message || record.error?.message || '');
  if (error) data.reason = /No session/i.test(error) ? 'missing-session' : /Bad MAC/i.test(error) ? 'bad-mac' : /pre.?key/i.test(error) ? 'pre-key' : /timed? ?out/i.test(error) ? 'timeout' : /not.?authorized|401|403/i.test(error) ? 'unauthorized' : 'retry-error';
  return data;
}

export function createWhatsAppDeliveryLogger(log = value => console.info('[WPP-ENTREGA]', JSON.stringify(value))) {
  return pino({ level: 'debug' }, { write(chunk) {
    try { const safe = deliveryDiagnostic(JSON.parse(chunk)); if (safe) log(safe); } catch {}
  } });
}
