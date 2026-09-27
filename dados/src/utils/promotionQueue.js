import fs from 'node:fs';
import path from 'node:path';

export class PromotionQueue {
  constructor({ file, now = Date.now, random = Math.random, save, load } = {}) {
    this.now = now;
    this.random = random;
    this.save = save || (state => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
      fs.renameSync(temporary, file);
    });
    this.state = load ? load() : fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { nextId: 1, messages: [], campaign: null };
    if (!Array.isArray(this.state.messages) || !Number.isSafeInteger(this.state.nextId)) throw new Error('Registro de promoções inválido.');
    this.busy = false;
    const campaign = this.state.campaign;
    if (campaign?.inFlight) {
      campaign.results[campaign.inFlight] = 'uncertain';
      campaign.inFlight = null;
      campaign.nextSendAt = Math.max(campaign.nextSendAt || 0, now() + 120_000);
      this.save(this.state);
    }
  }

  define(text) {
    const message = String(text || '').trim();
    if (!message || message.length > 3500) throw new Error('Escreva uma mensagem entre 1 e 3500 caracteres.');
    const record = { id: this.state.nextId++, text: message, createdAt: this.now() };
    this.state.messages.push(record);
    this.save(this.state);
    return record;
  }

  list() { return this.state.messages.map(message => ({ ...message })); }

  start(id, groupIds) {
    if (this.state.campaign?.status === 'running') throw new Error('Já existe um envio em andamento. Aguarde a fila terminar.');
    const message = this.state.messages.find(item => String(item.id) === String(id).trim());
    if (!message) throw new Error('Mensagem não encontrada. Use listmsgpromo para consultar os IDs.');
    const targets = [...new Set(groupIds)].filter(value => /^\d+(?:-\d+)?@g\.us$/.test(String(value)));
    if (!targets.length) throw new Error('O Shogun não encontrou grupos para este envio.');
    this.state.campaign = { messageId: message.id, text: message.text, targets, results: {}, status: 'running', inFlight: null, nextSendAt: this.now() + 30_000, startedAt: this.now() };
    this.save(this.state);
    return this.progress();
  }

  progress() {
    const campaign = this.state.campaign;
    if (!campaign) return null;
    const results = Object.values(campaign.results);
    return { id: campaign.messageId, status: campaign.status, total: campaign.targets.length,
      sent: results.filter(value => value === 'sent').length,
      failed: results.filter(value => value === 'failed').length,
      uncertain: results.filter(value => value === 'uncertain').length,
      pending: campaign.targets.length - results.length };
  }

  async step(send) {
    const campaign = this.state.campaign;
    if (this.busy || campaign?.status !== 'running') return { idle: true };
    const remaining = campaign.nextSendAt - this.now();
    if (remaining > 0) return { waitMs: remaining };
    const target = campaign.targets.find(id => !Object.hasOwn(campaign.results, id));
    if (!target) {
      campaign.status = 'completed'; campaign.completedAt = this.now(); this.save(this.state);
      return { completed: true };
    }
    this.busy = true;
    try {
      campaign.inFlight = target;
      this.save(this.state);
      try {
        const result = await send(target, campaign.text);
        campaign.results[target] = result?.key?.id ? 'sent' : 'uncertain';
      } catch (error) {
        campaign.results[target] = error?.code === 'PROMO_UNCERTAIN' ? 'uncertain' : 'failed';
      }
      campaign.inFlight = null;
      const processed = Object.keys(campaign.results).length;
      campaign.nextSendAt = this.now() + 120_000 + Math.floor(this.random() * 60_000) + (processed % 10 === 0 ? 600_000 : 0);
      if (processed === campaign.targets.length) { campaign.status = 'completed'; campaign.completedAt = this.now(); }
      this.save(this.state);
      return this.progress();
    } finally { this.busy = false; }
  }
}
