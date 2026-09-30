import fs from 'node:fs';
import path from 'node:path';
import { proto } from 'baileys';
function positiveLimit(value, label) {
    if (!Number.isSafeInteger(value) || value <= 0)
        throw new RangeError(`${label} must be a positive safe integer`);
    return value;
}
function retryRecord(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const record = value;
    return typeof record.data === 'string' && typeof record.expiresAt === 'number' && Number.isFinite(record.expiresAt);
}
// O WhatsApp pode pedir a mesma mensagem outra vez para acertar a sessão.
export class OutboundRetryStore {
    file;
    now;
    maxEntries;
    maxMessageBytes;
    ttlMs;
    records = new Map();
    save;
    constructor({ file, now = Date.now, maxEntries = 128, maxMessageBytes = 64 * 1024, ttlMs = 4 * 3600_000, save } = {}) {
        this.file = file;
        this.now = now;
        this.maxEntries = positiveLimit(maxEntries, 'maxEntries');
        this.maxMessageBytes = positiveLimit(maxMessageBytes, 'maxMessageBytes');
        this.ttlMs = positiveLimit(ttlMs, 'ttlMs');
        this.save = save || (() => {
            if (!file)
                return;
            fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
            const temporary = file + '.tmp';
            fs.writeFileSync(temporary, JSON.stringify([...this.records]), { mode: 0o600 });
            fs.renameSync(temporary, file);
        });
        try {
            if (file && fs.existsSync(file) && fs.statSync(file).size <= 16 * 1024 * 1024) {
                const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (Array.isArray(saved))
                    for (const entry of saved) {
                        if (Array.isArray(entry) && typeof entry[0] === 'string' && retryRecord(entry[1])) {
                            this.records.set(entry[0], entry[1]);
                        }
                    }
            }
        }
        catch {
            console.error('[SHOGUN] O cache de reenvio será recriado.');
        }
        this.prune();
    }
    key(key) {
        return key?.remoteJid && key.id ? key.remoteJid.replace(/:\d+@/, '@') + ':' + key.id : null;
    }
    prune() {
        const now = this.now();
        for (const [key, record] of this.records) {
            if (record.expiresAt <= now || Buffer.byteLength(record.data, 'base64') > this.maxMessageBytes)
                this.records.delete(key);
        }
        while (this.records.size > this.maxEntries) {
            const oldest = this.records.keys().next().value;
            if (oldest === undefined)
                break;
            this.records.delete(oldest);
        }
    }
    put(message) {
        if (message?.key?.fromMe !== true || !message.message)
            return false;
        const key = this.key(message.key);
        if (!key)
            return false;
        const bytes = proto.Message.encode(message.message).finish();
        if (bytes.length > this.maxMessageBytes)
            return false;
        this.records.delete(key);
        this.records.set(key, { data: Buffer.from(bytes).toString('base64'), expiresAt: this.now() + this.ttlMs });
        this.prune();
        try {
            this.save();
        }
        catch {
            console.error('[SHOGUN] Cache de reenvio disponível somente nesta sessão.');
        }
        return true;
    }
    get(key) {
        this.prune();
        const id = this.key(key);
        const record = id === null ? undefined : this.records.get(id);
        if (!record || id === null)
            return undefined;
        try {
            return proto.Message.decode(Buffer.from(record.data, 'base64'));
        }
        catch {
            this.records.delete(id);
            return undefined;
        }
    }
}
//# sourceMappingURL=outbound-retry-store.js.map