import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultAuditFile = path.resolve(moduleDirectory, '../../logs/security-audit.log');

function correlationHash(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function writeSecurityAudit(event, details = {}, auditFile = defaultAuditFile) {
  try {
    fs.mkdirSync(path.dirname(auditFile), { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      event: String(event || 'unknown'),
      group: correlationHash(details.groupId),
      actor: correlationHash(details.actorId),
      target: correlationHash(details.targetId),
      command: details.command ? String(details.command) : null,
      outcome: details.outcome ? String(details.outcome) : null
    };
    fs.appendFileSync(auditFile, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
    return true;
  } catch (error) {
    console.warn('[SEGURANÇA] Não foi possível registrar a auditoria:', error.message);
    return false;
  }
}

export { correlationHash, writeSecurityAudit };
