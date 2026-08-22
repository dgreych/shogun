export const MAX_SIMULTANEOS_POR_PESSOA = 4;
export const MAX_SIMULTANEOS_POR_GRUPO = 4;
export const MAX_SIMULTANEOS_GLOBAL = 20;

/**
 * Extrai as chaves de justiça da mensagem: quem mandou e onde.
 *
 * Em grupo o remetente é o participante; no privado o próprio chat identifica a
 * pessoa. Mensagem sem chave utilizável fica sem limite por pessoa/grupo e
 * responde só ao teto global — melhor deixar passar do que travar o bot por não
 * conseguir classificar.
 */
export function chavesDeJustica(info) {
    const chat = info?.key?.remoteJid || null;
    const ehGrupo = typeof chat === 'string' && chat.endsWith('@g.us');
    const pessoa = ehGrupo
    ? (info?.key?.participant || info?.message?.participant || null)
    : chat;
    return { pessoa: pessoa || null, grupo: ehGrupo ? chat : null };
}

/**
 * Fila com justiça por pessoa e por grupo.
 *
 * O desenho anterior processava ondas de mensagens em paralelo e só puxava a
 * onda seguinte quando a atual terminava inteira. Um único comando lento — um
 * download de 15s — segurava todo mundo que chegou depois, inclusive de outros
 * grupos. Era o que fazia o bot parecer travado.
 *
 * Aqui não há onda nem barreira: um item que estourou o limite da pessoa ou do
 * grupo é PULADO, e quem está atrás continua andando. Cada slot liberado puxa
 * imediatamente o próximo elegível.
 */
export class MessageQueue {
    constructor(
    maxGlobal = MAX_SIMULTANEOS_GLOBAL,
    maxPorPessoa = MAX_SIMULTANEOS_POR_PESSOA,
    maxPorGrupo = MAX_SIMULTANEOS_POR_GRUPO
    ) {
    this.queue = [];
    this.maxGlobal = maxGlobal;
    this.maxPorPessoa = maxPorPessoa;
    this.maxPorGrupo = maxPorGrupo;
    this.ativosGlobais = 0;
    this.ativosPorPessoa = new Map();
    this.ativosPorGrupo = new Map();
    this.aceitandoNovos = true;
    this.errorHandler = null;
    this.stats = {
    totalProcessed: 0,
    totalErrors: 0,
    currentQueueLength: 0,
    startTime: Date.now(),
    adiamentosPorLimite: 0,
    picoSimultaneos: 0
    };
    this.idCounter = 0;
    }

    setErrorHandler(handler) {
    this.errorHandler = handler;
    }

    async add(message, processor) {
    return new Promise((resolve, reject) => {
    this.queue.push({
    message,
    processor,
    resolve,
    reject,
    chaves: chavesDeJustica(message),
    timestamp: Date.now(),
    id: `msg_${++this.idCounter}_${Date.now()}`
    });
    this.stats.currentQueueLength = this.queue.length;
    this.despachar();
    });
    }

    /** Um item só entra se pessoa, grupo e teto global permitirem. */
    podeExecutar({ chaves }) {
    const { pessoa, grupo } = chaves;
    if (pessoa && (this.ativosPorPessoa.get(pessoa) || 0) >= this.maxPorPessoa) return false;
    if (grupo && (this.ativosPorGrupo.get(grupo) || 0) >= this.maxPorGrupo) return false;
    return true;
    }

    ocupar({ pessoa, grupo }) {
    this.ativosGlobais++;
    if (pessoa) this.ativosPorPessoa.set(pessoa, (this.ativosPorPessoa.get(pessoa) || 0) + 1);
    if (grupo) this.ativosPorGrupo.set(grupo, (this.ativosPorGrupo.get(grupo) || 0) + 1);
    if (this.ativosGlobais > this.stats.picoSimultaneos) this.stats.picoSimultaneos = this.ativosGlobais;
    }

    // Zerou, sai do Map: sem isso a memória cresce sem limite ao longo de dias,
    // porque cada pessoa e cada grupo que já falou uma vez ficaria residente.
    liberar({ pessoa, grupo }) {
    this.ativosGlobais = Math.max(0, this.ativosGlobais - 1);
    if (pessoa) {
    const restante = (this.ativosPorPessoa.get(pessoa) || 1) - 1;
    if (restante > 0) this.ativosPorPessoa.set(pessoa, restante);
    else this.ativosPorPessoa.delete(pessoa);
    }
    if (grupo) {
    const restante = (this.ativosPorGrupo.get(grupo) || 1) - 1;
    if (restante > 0) this.ativosPorGrupo.set(grupo, restante);
    else this.ativosPorGrupo.delete(grupo);
    }
    }

    /**
     * Varre a fila em ordem de chegada e dispara tudo que couber agora.
     * O `i++` no caso inelegível é a correção central: o item fica na fila e
     * quem está atrás é avaliado do mesmo jeito.
     */
    despachar() {
    let i = 0;
    while (i < this.queue.length && this.ativosGlobais < this.maxGlobal) {
    const item = this.queue[i];
    if (this.podeExecutar(item)) {
    this.queue.splice(i, 1);
    this.executar(item);
    } else {
    this.stats.adiamentosPorLimite++;
    i++;
    }
    }
    this.stats.currentQueueLength = this.queue.length;
    }

    async executar(item) {
    this.ocupar(item.chaves);
    try {
    const resultado = await item.processor(item.message);
    this.stats.totalProcessed++;
    item.resolve(resultado);
    } catch (error) {
    // handleProcessingError já rejeita e contabiliza; rejeitar de novo aqui
    // seria no-op, mas confundiria quem lesse o fluxo depois.
    await this.handleProcessingError(item, error);
    } finally {
    this.liberar(item.chaves);
    // Microtask evita recursão profunda quando muitos processors resolvem
    // de forma síncrona.
    queueMicrotask(() => this.despachar());
    }
    }

    async handleProcessingError(item, error) {
    this.stats.totalErrors++;

    console.error(`❌ Queue processing error for message ${item.id}:`, error.message);

    if (this.errorHandler) {
    try {
    await this.errorHandler(item, error);
    } catch (handlerError) {
    console.error('❌ Error handler failed:', handlerError.message);
    }
    }

    item.reject(error);
    }

    getStatus() {
    const uptime = Date.now() - this.stats.startTime;
    return {
    queueLength: this.queue.length,
    ativosGlobais: this.ativosGlobais,
    maxGlobal: this.maxGlobal,
    maxPorPessoa: this.maxPorPessoa,
    maxPorGrupo: this.maxPorGrupo,
    pessoasAtivas: this.ativosPorPessoa.size,
    gruposAtivos: this.ativosPorGrupo.size,
    picoSimultaneos: this.stats.picoSimultaneos,
    adiamentosPorLimite: this.stats.adiamentosPorLimite,
    aceitandoNovos: this.aceitandoNovos,
    totalProcessed: this.stats.totalProcessed,
    totalErrors: this.stats.totalErrors,
    currentQueueLength: this.stats.currentQueueLength,
    uptime: uptime,
    uptimeFormatted: this.formatUptime(uptime),
    throughput: this.stats.totalProcessed > 0 ?
    (this.stats.totalProcessed / (uptime / 1000)).toFixed(2) : 0,
    errorRate: this.stats.totalProcessed > 0 ?
    ((this.stats.totalErrors / this.stats.totalProcessed) * 100).toFixed(2) : 0
    };
    }

    formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
    } else {
    return `${seconds}s`;
    }
    }

    clear() {
    this.queue.forEach(item => {
    if (item.reject) {
    item.reject(new Error('Queue cleared'));
    }
    });
    this.queue = [];
    this.stats.currentQueueLength = 0;
    }

    async shutdown() {
    console.log('🛑 Finalizando MessageQueue...');
    this.aceitandoNovos = false;

    // Agora o contador de ativos é real, então esta espera de fato drena o que
    // está em voo. Antes ela retornava na hora, porque nada incrementava.
    const shutdownTimeout = 10000;
    const startTime = Date.now();

    while (this.ativosGlobais > 0 && (Date.now() - startTime) < shutdownTimeout) {
    await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.ativosGlobais > 0) {
    console.warn(`⚠️ ${this.ativosGlobais} comandos ainda ativos após timeout de shutdown`);
    }

    this.clear();
    console.log('✅ MessageQueue finalizado');
    }
}
