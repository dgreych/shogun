import { DEFAULT_NVIDIA_MODEL, NVIDIA_MODEL_CATALOG } from '../utils/nvidiaApi.js';

export default async function menuIa(prefix, botName = 'SHOGUN', userName = 'Usuário', {
  header = `╭┈⊰ 🤖 『 *${botName}* 』\n┊💭 *Usuário:* #nome#\n┊👑 *Prefixo:* #prefix#\n╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯`,
  menuTopBorder = '╭┈',
  bottomBorder = '╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯',
  menuTitleIcon = '🧠▸',
  menuItemIcon = '•.̇𖥨֗🤖⭟',
  separatorIcon = '❁',
  middleBorder = '┊'
} = {}) {
  const pfx = String(prefix || '!');
  const formattedHeader = String(header)
    .replace(/#nome#/g, userName || 'Usuário')
    .replace(/#prefix#/g, pfx);

  const modelLines = NVIDIA_MODEL_CATALOG.map((entry, index) => {
    const isDefault = entry.id === DEFAULT_NVIDIA_MODEL;
    return `${middleBorder}${menuItemIcon}${index + 1}. *${entry.label}*${isDefault ? ' ⭐ PADRÃO' : ''}\n${middleBorder}   ${entry.id}`;
  }).join('\n');

  return `${formattedHeader}

${menuTopBorder}${separatorIcon} ${menuTitleIcon} *IA & MODELOS NVIDIA*
${middleBorder}
${middleBorder}Pool qualificado: *10 modelos* gerenciados pela BunnyFy.
${middleBorder}Padrão: *Nemotron 3 Ultra 550B*.
${middleBorder}
${modelLines}
${middleBorder}
${middleBorder}*SELEÇÃO DE MODELO*
${middleBorder}${menuItemIcon}${pfx}menu-ia -> mostra o modelo ativo e as opções
${middleBorder}${menuItemIcon}${pfx}menu-ia 9 -> seleciona o Nemotron 3 Ultra
${middleBorder}${menuItemIcon}${pfx}menu-ia <id> -> seleciona pelo ID completo
${middleBorder}${menuItemIcon}${pfx}modelo-ia -> alias técnico equivalente
${middleBorder}
${middleBorder}Em grupos, a seleção é própria do grupo e exige dono/admin real.
${middleBorder}No privado, o dono altera o padrão da instância.
${middleBorder}
${middleBorder}*ASSISTENTE*
${middleBorder}${menuItemIcon}${pfx}gemma2 [texto]
${middleBorder}${menuItemIcon}${pfx}comandoia [texto]
${middleBorder}${menuItemIcon}${pfx}nexo [texto]
${middleBorder}${menuItemIcon}${pfx}vision [imagem] [pergunta]
${bottomBorder}`;
}
