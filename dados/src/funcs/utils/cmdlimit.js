import {
  addCommandLimit,
  removeCommandLimit,
  getCommandLimits,
  checkCommandLimit,
  formatTimeLeft
} from '../../utils/database.js';

async function cmdLimitAdd(socket, from, q, reply, prefix, isOwnerOrSub) {
  if (!isOwnerOrSub) return reply("🚫 Apenas o Dono e Subdonos podem limitar comandos!");
  
  const args = q.split(' ');
  if (args.length < 3) {
    return reply(`❌ Formato inválido!\n\nUse: ${prefix}cmdlimitar <comando> <usos> <tempo>\n\nExemplo: ${prefix}cmdlimitar sticker 3 1h\n\n📝 Formatos de tempo aceitos:\n• 30s (30 segundos)\n• 10m (10 minutos)\n• 1h (1 hora)\n• 2d (2 dias)`);
  }
  
  const commandName = args[0];
  const maxUses = parseInt(args[1]);
  const timeFrame = args[2];
  
  const result = addCommandLimit(commandName, maxUses, timeFrame);
  return reply(result.message);
}

async function cmdLimitRemove(socket, from, q, reply, prefix, isOwnerOrSub) {
  if (!isOwnerOrSub) return reply("🚫 Apenas o Dono e Subdonos podem remover limites de comandos!");
  
  if (!q) {
    return reply(`❌ Especifique o comando!\n\nUse: ${prefix}cmddeslimitar <comando>\n\nExemplo: ${prefix}cmddeslimitar sticker`);
  }
  
  const result = removeCommandLimit(q.trim());
  return reply(result.message);
}

async function cmdLimitList(socket, from, q, reply, prefix, isOwnerOrSub) {
  if (!isOwnerOrSub) return reply("🚫 Apenas o Dono e Subdonos podem ver os limites!");
  
  const limits = getCommandLimits();
  const commandNames = Object.keys(limits);
  
  if (commandNames.length === 0) {
    return reply("📝 Nenhum comando com limite configurado!");
  }
  
  let message = "🚫 *COMANDOS LIMITADOS*\n\n";
  
  for (const cmdName of commandNames) {
    const limit = limits[cmdName];
    
    message += `• *${prefix}${cmdName}*\n`;
    message += `  📊 Máx por usuário: ${limit.maxUses}\n`;
    message += `  ⏰ Período: ${limit.timeFrame}\n`;
    message += `  🎯 Sistema: Por usuário\n`;
    message += `  📅 Criado: ${new Date(limit.createdAt).toLocaleDateString('pt-BR')}\n\n`;
  }
  
  message += "ℹ️ *Como funciona:*\n";
  message += "• Cada usuário tem seu próprio limite\n";
  message += "• Quando atinge o limite, deve aguardar o período\n";
  message += "• O tempo reset é individual por usuário";
  
  return reply(message);
}

export {
  cmdLimitAdd,
  cmdLimitRemove,
  cmdLimitList
};