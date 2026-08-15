import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { correlationHash, writeSecurityAudit } from './SecurityAuditLog.js';

test('auditoria correlaciona identidades sem gravá-las em texto aberto', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gyomei-security-'));
  const auditFile = path.join(temporaryDirectory, 'audit.log');
  const actorId = '5511999999999@s.whatsapp.net';

  assert.equal(writeSecurityAudit('permission_granted', {
    actorId,
    groupId: '120000000000@g.us',
    command: 'mute',
    outcome: 'allowed'
  }, auditFile), true);

  const entry = fs.readFileSync(auditFile, 'utf8').trim();
  assert.equal(entry.includes(actorId), false);
  assert.equal(JSON.parse(entry).actor, correlationHash(actorId));
  assert.equal(JSON.parse(entry).command, 'mute');
});
