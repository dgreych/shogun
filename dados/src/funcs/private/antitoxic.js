// --- SISTEMA ANTITOXIC ---
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANTITOXIC_FILE = path.join(__dirname, '../../../database/antitoxic.json');

const CONFIG = {
    COOLDOWN_MS: 30 * 1000, // Cooldown entre avisos para o mesmo usuário
    THRESHOLD: 70, // Score mínimo para considerar tóxico (0-100)
    MAX_WARNINGS: 3, // Avisos antes de ação automática
    WARNING_RESET_MS: 24 * 60 * 60 * 1000, // Reset de avisos após 24h
    ACTIONS: ['avisar', 'apagar', 'mute'],
    DEFAULT_ACTION: 'avisar'
};

// Palavras-chave para detecção rápida (fallback se conversa falhar)
const TOXIC_KEYWORDS = [
    // Ofensas gerais
    'idiota', 'burro', 'imbecil', 'retardado', 'otário', 'babaca',
    'estúpido', 'cretino', 'mongol', 'débil', 'lixo', 'merda',
    // Termos mais graves (censurados parcialmente)
    'f*der', 'p*ta', 'v*ado', 'c*ralho', 'arr*mbado',
    // Ameaças
    'vou te matar', 'vou te pegar', 'vai morrer'
];

// Helper para nome de usuário
const getUserName = (userId) => {
    if (!userId || typeof userId !== 'string') return 'unknown';
    return userId.split('@')[0] || userId;
};

// --- PERSISTÊNCIA ---

const loadAntitoxic = () => {
    try {
        if (fs.existsSync(ANTITOXIC_FILE)) {
            return JSON.parse(fs.readFileSync(ANTITOXIC_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('[ANTITOXIC] Erro ao carregar:', err.message);
    }
    return { groups: {}, userWarnings: {} };
};

const saveAntitoxic = (data) => {
    try {
        const dir = path.dirname(ANTITOXIC_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(ANTITOXIC_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('[ANTITOXIC] Erro ao salvar:', err.message);
    }
};

// --- CONFIGURAÇÃO DO GRUPO ---

const enableAntitoxic = (groupId, action = CONFIG.DEFAULT_ACTION) => {
    if (!CONFIG.ACTIONS.includes(action)) {
        action = CONFIG.DEFAULT_ACTION;
    }
    
    const data = loadAntitoxic();
    data.groups[groupId] = {
        enabled: true,
        action,
        threshold: CONFIG.THRESHOLD,
        enabledAt: new Date().toISOString(),
        stats: { detected: 0, warned: 0, deleted: 0, muted: 0 }
    };
    saveAntitoxic(data);
    
    return {
        success: true,
        message: `🛡️ *ANTITOXIC ATIVADO*\n\n` +
                 `⚠️ *AVISO IMPORTANTE:*\n` +
                 `Este sistema usa conversa para detectar mensagens tóxicas e *pode cometer erros*. ` +
                 `Nem toda mensagem marcada é realmente ofensiva, e algumas ofensas podem passar despercebidas.\n\n` +
                 `📌 *Configuração:*\n` +
                 `• Ação: ${action}\n` +
                 `• Sensibilidade: ${CONFIG.THRESHOLD}%\n\n` +
                 `💡 Use /antitoxic off para desativar.`
    };
};

const disableAntitoxic = (groupId) => {
    const data = loadAntitoxic();
    if (data.groups[groupId]) {
        data.groups[groupId].enabled = false;
    }
    saveAntitoxic(data);
    
    return {
        success: true,
        message: `🛡️ *ANTITOXIC DESATIVADO*\n\n` +
                 `O sistema de detecção de toxicidade foi desativado neste grupo.`
    };
};

const setAntitoxicAction = (groupId, action) => {
    if (!CONFIG.ACTIONS.includes(action)) {
        return {
            success: false,
            message: `❌ Ação inválida!\n\nAções disponíveis: ${CONFIG.ACTIONS.join(', ')}`
        };
    }
    
    const data = loadAntitoxic();
    if (!data.groups[groupId] || !data.groups[groupId].enabled) {
        return { success: false, message: '❌ O antitoxic não está ativado neste grupo!' };
    }
    
    data.groups[groupId].action = action;
    saveAntitoxic(data);
    
    return {
        success: true,
        message: `🛡️ *ANTITOXIC*\n\nAção alterada para: *${action}*`
    };
};

const setAntitoxicThreshold = (groupId, threshold) => {
    const value = parseInt(threshold);
    if (isNaN(value) || value < 1 || value > 100) {
        return { success: false, message: '❌ Sensibilidade deve ser entre 1 e 100!' };
    }
    
    const data = loadAntitoxic();
    if (!data.groups[groupId] || !data.groups[groupId].enabled) {
        return { success: false, message: '❌ O antitoxic não está ativado neste grupo!' };
    }
    
    data.groups[groupId].threshold = value;
    saveAntitoxic(data);
    
    return {
        success: true,
        message: `🛡️ *ANTITOXIC*\n\nSensibilidade alterada para: *${value}%*\n\n` +
                 `💡 Quanto maior, menos mensagens serão marcadas.`
    };
};

const getAntitoxicStatus = (groupId) => {
    const data = loadAntitoxic();
    const group = data.groups[groupId];
    
    if (!group || !group.enabled) {
        return {
            success: true,
            enabled: false,
            message: `🛡️ *ANTITOXIC*\n\n❌ Desativado neste grupo.\n\n💡 Use /antitoxic on para ativar.`
        };
    }
    
    return {
        success: true,
        enabled: true,
        message: `🛡️ *ANTITOXIC*\n\n` +
                 `✅ Status: Ativado\n` +
                 `⚡ Ação: ${group.action}\n` +
                 `📊 Sensibilidade: ${group.threshold}%\n\n` +
                 `📈 *Estatísticas:*\n` +
                 `• Detectadas: ${group.stats.detected}\n` +
                 `• Avisos: ${group.stats.warned}\n` +
                 `• Apagadas: ${group.stats.deleted}\n` +
                 `• Mutes: ${group.stats.muted}`
    };
};

// --- DETECÇÃO ---

// Detecção rápida por palavras-chave (fallback)
const quickCheck = (message) => {
    const lower = message.toLowerCase();
    for (const keyword of TOXIC_KEYWORDS) {
        if (lower.includes(keyword)) {
            return { isToxic: true, score: 80, keyword };
        }
    }
    return { isToxic: false, score: 0 };
};

// Analisar mensagem (para ser chamada com conversa)
const analyzeMessage = async (message, aiFunction = null) => {
    // Se não tiver função de conversa, usar detecção por palavras-chave
    if (!aiFunction) {
        return quickCheck(message);
    }
    
    try {
        const prompt = `Analise a seguinte mensagem e determine se ela é tóxica, ofensiva ou contém discurso de ódio.
Responda APENAS com um JSON no formato: {"score": <0-100>, "reason": "<motivo curto>"}

Onde score é:
- 0-30: Mensagem normal/aceitável
- 31-60: Levemente inadequada
- 61-80: Ofensiva
- 81-100: Muito tóxica/discurso de ódio

Mensagem para analisar: "${message.slice(0, 500)}"

Responda apenas o JSON, sem explicações adicionais.`;

        const response = await aiFunction(prompt);
        
        // Tentar extrair JSON da resposta
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return {
                isToxic: result.score >= CONFIG.THRESHOLD,
                score: result.score,
                reason: result.reason,
                byConversation: true
            };
        }
    } catch (err) {
        console.error('[ANTITOXIC] Erro na conversa:', err.message);
    }
    
    // Fallback para detecção por palavras-chave
    return quickCheck(message);
};

// Processar mensagem (retorna ação a ser tomada)
const processMessage = async (groupId, userId, message, aiFunction = null) => {
    const data = loadAntitoxic();
    const group = data.groups[groupId];
    
    // Verificar se está ativado
    if (!group || !group.enabled) {
        return { action: 'none' };
    }
    
    // Verificar cooldown
    const userKey = `${groupId}:${odIUserId}`;
    if (data.userWarnings[userKey]) {
        const lastWarning = data.userWarnings[userKey].lastWarning;
        if (Date.now() - lastWarning < CONFIG.COOLDOWN_MS) {
            return { action: 'none', reason: 'cooldown' };
        }
    }
    
    // Analisar mensagem
    const analysis = await analyzeMessage(message, aiFunction);
    
    if (!analysis.isToxic) {
        return { action: 'none' };
    }
    
    // Atualizar estatísticas
    group.stats.detected++;
    
    // Atualizar avisos do usuário
    if (!data.userWarnings[userKey]) {
        data.userWarnings[userKey] = { count: 0, lastWarning: 0 };
    }
    
    const userWarning = data.userWarnings[userKey];
    
    // Reset se passou muito tempo
    if (Date.now() - userWarning.lastWarning > CONFIG.WARNING_RESET_MS) {
        userWarning.count = 0;
    }
    
    userWarning.count++;
    userWarning.lastWarning = Date.now();
    
    // Determinar ação
    let action = group.action;
    if (userWarning.count >= CONFIG.MAX_WARNINGS && action === 'avisar') {
        action = 'apagar'; // Escala ação após múltiplos avisos
    }
    
    // Atualizar stats
    if (action === 'avisar') group.stats.warned++;
    else if (action === 'apagar') group.stats.deleted++;
    else if (action === 'mute') group.stats.muted++;
    
    saveAntitoxic(data);
    
    return {
        action,
        score: analysis.score,
        reason: analysis.reason || 'Conteúdo potencialmente ofensivo',
        warningCount: userWarning.count,
        maxWarnings: CONFIG.MAX_WARNINGS,
        byConversation: analysis.byConversation || false
    };
};

// Gerar mensagem de aviso
const generateWarningMessage = (userId, result) => {
    const aiDisclaimer = result.byConversation 
        ? '\n\n_⚠️ Esta análise foi feita por conversa e pode conter erros._'
        : '';
    
    if (result.action === 'avisar') {
        return {
            message: `🛡️ *ANTITOXIC*\n\n` +
                     `⚠️ @${getUserName(userId)}, sua mensagem foi identificada como potencialmente ofensiva.\n\n` +
                     `📊 Score: ${result.score}/100\n` +
                     `📌 Motivo: ${result.reason}\n` +
                     `⚡ Avisos: ${result.warningCount}/${result.maxWarnings}` +
                     aiDisclaimer,
            mentions: [userId]
        };
    }
    
    if (result.action === 'apagar') {
        return {
            message: `🛡️ *ANTITOXIC*\n\n` +
                     `🗑️ Mensagem de @${getUserName(userId)} foi removida.\n\n` +
                     `📌 Motivo: ${result.reason}` +
                     aiDisclaimer,
            mentions: [userId]
        };
    }
    
    if (result.action === 'mute') {
        return {
            message: `🛡️ *ANTITOXIC*\n\n` +
                     `🔇 @${getUserName(userId)} foi silenciado temporariamente.\n\n` +
                     `📌 Motivo: ${result.reason}` +
                     aiDisclaimer,
            mentions: [userId]
        };
    }
    
    return null;
};

// Verificar se grupo tem antitoxic ativado
const isEnabled = (groupId) => {
    const data = loadAntitoxic();
    return data.groups[groupId]?.enabled || false;
};

const getGroupAction = (groupId) => {
    const data = loadAntitoxic();
    return data.groups[groupId]?.action || CONFIG.DEFAULT_ACTION;
};

export {
    enableAntitoxic,
    disableAntitoxic,
    setAntitoxicAction,
    setAntitoxicThreshold,
    getAntitoxicStatus,
    getGroupAction,
    analyzeMessage,
    processMessage,
    generateWarningMessage,
    isEnabled,
    CONFIG as ANTITOXIC_CONFIG
};

export default {
    enableAntitoxic,
    disableAntitoxic,
    setAntitoxicAction,
    setAntitoxicThreshold,
    getAntitoxicStatus,
    getGroupAction,
    analyzeMessage,
    processMessage,
    generateWarningMessage,
    isEnabled
};
