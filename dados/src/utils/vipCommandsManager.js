import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho do arquivo de comandos VIP
const VIP_COMMANDS_FILE = path.join(__dirname, '../../database/dono/vipCommands.json');

const DEFAULT_CATEGORIES = Object.freeze({
  download: '📥 Downloads',
  diversao: '🎮 Diversão',
  utilidade: '🛠️ Utilidade',
  ia: '🤖 Inteligência Artificial',
  editor: '✨ Editor',
  info: 'ℹ️ Informação',
  outros: '📦 Outros'
});

function createDefaultData(commands = []) {
  return {
    commands: Array.isArray(commands) ? commands : [],
    categories: { ...DEFAULT_CATEGORIES }
  };
}

function normalizeVipCommandsData(rawData) {
  // Compatibilidade com formatos antigos: [] e objetos sem `commands`.
  if (Array.isArray(rawData)) return createDefaultData(rawData);

  if (!rawData || typeof rawData !== 'object') return createDefaultData();

  const commands = Array.isArray(rawData.commands) ? rawData.commands : [];
  const categories = rawData.categories && typeof rawData.categories === 'object' && !Array.isArray(rawData.categories)
    ? { ...DEFAULT_CATEGORIES, ...rawData.categories }
    : { ...DEFAULT_CATEGORIES };

  return { ...rawData, commands, categories };
}

/**
 * Garante que o arquivo de comandos VIP existe
 */
function ensureVipCommandsFile() {
  const dir = path.dirname(VIP_COMMANDS_FILE);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  if (!fs.existsSync(VIP_COMMANDS_FILE)) {
    const defaultData = createDefaultData();
    fs.writeFileSync(VIP_COMMANDS_FILE, JSON.stringify(defaultData, null, 2));
  }
}

/**
 * Carrega os comandos VIP do arquivo
 */
function loadVipCommands() {
  ensureVipCommandsFile();
  try {
    const fileContent = fs.readFileSync(VIP_COMMANDS_FILE, 'utf8');
    const parsed = JSON.parse(fileContent);
    const normalized = normalizeVipCommandsData(parsed);

    // Repara silenciosamente arquivos antigos como `{}` ou `[]`.
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      fs.writeFileSync(VIP_COMMANDS_FILE, JSON.stringify(normalized, null, 2));
    }

    return normalized;
  } catch (error) {
    console.error('Erro ao carregar comandos VIP:', error);
    return createDefaultData();
  }
}

/**
 * Salva os comandos VIP no arquivo
 */
function saveVipCommands(data) {
  ensureVipCommandsFile();
  try {
    const normalized = normalizeVipCommandsData(data);
    fs.writeFileSync(VIP_COMMANDS_FILE, JSON.stringify(normalized, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar comandos VIP:', error);
    return false;
  }
}

/**
 * Adiciona um novo comando VIP
 * @param {string} command - Nome do comando (sem prefixo)
 * @param {string} description - Descrição do comando
 * @param {string} category - Categoria do comando
 * @param {string} usage - Exemplo de uso (opcional)
 */
function addVipCommand(command, description, category = 'outros', usage = '') {
  const data = loadVipCommands();
  
  // Normaliza o comando
  const normalizedCommand = String(command || '').toLowerCase().trim();
  
  // Verifica se o comando já existe
  const existingIndex = data.commands.findIndex(cmd => cmd.command === normalizedCommand);
  
  if (existingIndex !== -1) {
    return {
      success: false,
      message: `❌ O comando "${normalizedCommand}" já existe na lista VIP!`
    };
  }
  
  // Valida categoria
  if (!data.categories[category]) {
    category = 'outros';
  }
  
  // Adiciona o novo comando
  const newCommand = {
    command: normalizedCommand,
    description: String(description || '').trim(),
    category: category,
    usage: String(usage || '').trim() || `${normalizedCommand}`,
    addedAt: new Date().toISOString(),
    enabled: true
  };
  
  data.commands.push(newCommand);
  
  if (saveVipCommands(data)) {
    return {
      success: true,
      message: `✅ Comando VIP "${normalizedCommand}" adicionado com sucesso!`,
      command: newCommand
    };
  } else {
    return {
      success: false,
      message: '❌ Erro ao salvar o comando VIP.'
    };
  }
}

/**
 * Remove um comando VIP
 * @param {string} command - Nome do comando a ser removido
 */
function removeVipCommand(command) {
  const data = loadVipCommands();
  const normalizedCommand = String(command || '').toLowerCase().trim();
  
  const index = data.commands.findIndex(cmd => cmd.command === normalizedCommand);
  
  if (index === -1) {
    return {
      success: false,
      message: `❌ O comando "${normalizedCommand}" não foi encontrado na lista VIP.`
    };
  }
  
  const removedCommand = data.commands[index];
  data.commands.splice(index, 1);
  
  if (saveVipCommands(data)) {
    return {
      success: true,
      message: `✅ Comando VIP "${normalizedCommand}" removido com sucesso!`,
      command: removedCommand
    };
  } else {
    return {
      success: false,
      message: '❌ Erro ao remover o comando VIP.'
    };
  }
}

/**
 * Verifica se um comando é VIP-only
 * @param {string} command - Nome do comando
 * @returns {boolean}
 */
function isVipCommand(command) {
  const data = loadVipCommands();
  const normalizedCommand = String(command || '').toLowerCase().trim();
  return data.commands.some(cmd => cmd.command === normalizedCommand && cmd.enabled);
}

/**
 * Lista todos os comandos VIP
 * @param {string} category - Categoria específica (opcional)
 * @returns {Array}
 */
function listVipCommands(category = null) {
  const data = loadVipCommands();
  
  if (category) {
    return data.commands.filter(cmd => cmd.category === category && cmd.enabled);
  }
  
  return data.commands.filter(cmd => cmd.enabled);
}

/**
 * Obtém informações de um comando VIP específico
 * @param {string} command - Nome do comando
 */
function getVipCommand(command) {
  const data = loadVipCommands();
  const normalizedCommand = String(command || '').toLowerCase().trim();
  return data.commands.find(cmd => cmd.command === normalizedCommand);
}

/**
 * Agrupa comandos VIP por categoria
 * @returns {Object} Comandos agrupados por categoria
 */
function groupVipCommandsByCategory() {
  const data = loadVipCommands();
  const grouped = {};
  
  // Inicializa categorias
  for (const [key, label] of Object.entries(data.categories)) {
    grouped[key] = {
      label: label,
      commands: []
    };
  }
  
  // Agrupa comandos ativos
  data.commands.forEach(cmd => {
    if (cmd.enabled && grouped[cmd.category]) {
      grouped[cmd.category].commands.push(cmd);
    }
  });
  
  // Remove categorias vazias
  Object.keys(grouped).forEach(key => {
    if (grouped[key].commands.length === 0) {
      delete grouped[key];
    }
  });
  
  return grouped;
}

/**
 * Ativa ou desativa um comando VIP
 * @param {string} command - Nome do comando
 * @param {boolean} enabled - true para ativar, false para desativar
 */
function toggleVipCommand(command, enabled) {
  const data = loadVipCommands();
  const normalizedCommand = String(command || '').toLowerCase().trim();
  
  const cmdIndex = data.commands.findIndex(cmd => cmd.command === normalizedCommand);
  
  if (cmdIndex === -1) {
    return {
      success: false,
      message: `❌ Comando "${normalizedCommand}" não encontrado.`
    };
  }
  
  data.commands[cmdIndex].enabled = enabled;
  
  if (saveVipCommands(data)) {
    const status = enabled ? 'ativado' : 'desativado';
    return {
      success: true,
      message: `✅ Comando VIP "${normalizedCommand}" ${status} com sucesso!`
    };
  } else {
    return {
      success: false,
      message: '❌ Erro ao atualizar o comando VIP.'
    };
  }
}

/**
 * Obtém todas as categorias disponíveis
 */
function getCategories() {
  const data = loadVipCommands();
  return data.categories;
}

/**
 * Adiciona uma nova categoria
 */
function addCategory(key, label) {
  const data = loadVipCommands();
  
  if (data.categories[key]) {
    return {
      success: false,
      message: `❌ A categoria "${key}" já existe.`
    };
  }
  
  data.categories[key] = label;
  
  if (saveVipCommands(data)) {
    return {
      success: true,
      message: `✅ Categoria "${label}" adicionada com sucesso!`
    };
  } else {
    return {
      success: false,
      message: '❌ Erro ao adicionar categoria.'
    };
  }
}

/**
 * Exporta estatísticas dos comandos VIP
 */
function getVipStats() {
  const data = loadVipCommands();
  const grouped = groupVipCommandsByCategory();
  
  return {
    total: data.commands.length,
    active: data.commands.filter(cmd => cmd.enabled).length,
    inactive: data.commands.filter(cmd => !cmd.enabled).length,
    categories: Object.keys(grouped).length,
    byCategory: Object.entries(grouped).map(([key, value]) => ({
      category: value.label,
      count: value.commands.length
    }))
  };
}

export {
  normalizeVipCommandsData,
  addVipCommand,
  removeVipCommand,
  isVipCommand,
  listVipCommands,
  getVipCommand,
  groupVipCommandsByCategory,
  toggleVipCommand,
  getCategories,
  addCategory,
  getVipStats,
  loadVipCommands,
  saveVipCommands
};
