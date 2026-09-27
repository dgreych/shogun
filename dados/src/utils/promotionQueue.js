import fs from 'node:fs';
import path from 'node:path';

export function rankPromotionGroups(groups) {
  return Object.entries(groups || {}).filter(([id]) => /^\d+(?:-\d+)?@g\.us$/.test(id)).map(([id, group]) => ({
    id, name: String(group?.subject || 'Grupo').replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0, 100),
    members: Math.max(Array.isArray(group?.participants) ? group.participants.length : 0, Number.isSafeInteger(Number(group?.size)) && Number(group.size) >= 0 ? Number(group.size) : 0),
  })).sort((a, b) => b.members - a.members);
}

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
    if (['running', 'paused'].includes(this.state.campaign?.status)) throw new Error('Já existe um envio em andamento. Aguarde a fila terminar.');
    const message = this.state.messages.find(item => String(item.id) === String(id).trim());
    if (!message) throw new Error('Mensagem não encontrada. Use listmsgpromo para consultar os IDs.');
    const excluded = new Set(this.state.excludedGroups || []);
    const targets = [...new Set(groupIds)].filter(value => /^\d+(?:-\d+)?@g\.us$/.test(String(value)) && !excluded.has(value));
    if (!targets.length) throw new Error('O Shogun não encontrou grupos para este envio.');
    this.state.campaign = { messageId: message.id, text: message.text, targets, results: {}, status: 'running', inFlight: null, nextSendAt: this.now() + 30_000, startedAt: this.now() };
    this.save(this.state);
    return this.progress();
  }

  pause() {
    if (this.state.campaign?.status !== 'running') throw new Error('Não há campanha em andamento.');
    this.state.campaign.status = 'paused'; this.save(this.state); return this.progress();
  }

  prioritize(groups) {
    const campaign = this.state.campaign;
    if (!campaign || !['paused', 'running'].includes(campaign.status)) throw new Error('Não há campanha para ordenar.');
    const ranked = rankPromotionGroups(groups);
    const sizes = new Map(ranked.map(group => [group.id, group.members]));
    campaign.targets.sort((a, b) => (sizes.get(b) || 0) - (sizes.get(a) || 0));
    campaign.audiences = ranked.filter(group => campaign.targets.includes(group.id));
    this.save(this.state); return { ...this.progress(), priorities: campaign.audiences.slice(0, 5).map(({ name, members }) => ({ name, members })) };
  }

  restart(groupIds) {
    const campaign = this.state.campaign;
    if (campaign?.status !== 'paused' || this.busy) throw new Error('Pause a campanha antes de repetir.');
    const excluded = new Set(this.state.excludedGroups || []);
    const targets = [...new Set(groupIds)].filter(id => /^\d+(?:-\d+)?@g\.us$/.test(id) && !excluded.has(id));
    if (!targets.length) throw new Error('Nenhum grupo disponível.');
    campaign.previousAttempts = [...(campaign.previousAttempts || []), { at: this.now(), results: { ...campaign.results } }].slice(-5);
    campaign.results = {}; campaign.targets = targets; campaign.inFlight = null; campaign.nextSendAt = this.now() + 30_000;
    this.save(this.state); return this.progress();
  }

  resume() {
    if (this.state.campaign?.status !== 'paused') throw new Error('Não há campanha pausada.');
    this.state.campaign.status = 'running';
    this.state.campaign.nextSendAt = Math.max(this.state.campaign.nextSendAt || 0, this.now() + 30_000);
    this.save(this.state); return this.progress();
  }

  progress() {
    const campaign = this.state.campaign;
    if (!campaign) return null;
    const results = campaign.targets.filter(id => Object.hasOwn(campaign.results, id)).map(id => campaign.results[id]);
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
