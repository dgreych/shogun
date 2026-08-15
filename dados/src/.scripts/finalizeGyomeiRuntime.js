import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPTS_DIR = path.dirname(__filename);
const RUNTIME_INDEX = path.resolve(SCRIPTS_DIR, '..', '.runtime-index.js');
const RUNTIME_IA = path.resolve(SCRIPTS_DIR, '..', 'funcs', 'private', '.runtime-ia.js');
const RUNTIME_START = path.join(SCRIPTS_DIR, '.runtime-start.js');

function replaceRequired(source, search, replacement, description) {
  const updated = source.replace(search, replacement);
  if (updated === source) throw new Error(`Patch final obrigatório não encontrado: ${description}`);
  return updated;
}

function replacePatternRequired(source, pattern, replacement, description) {
  const updated = source.replace(pattern, replacement);
  if (updated === source) throw new Error(`Patch final obrigatório não encontrado: ${description}`);
  return updated;
}

function buildCommandNotFoundCard() {
  return [
    "    const typedCommand = `${groupPrefix}${commandName}`;",
    "    let notFoundMessage = `╭━━⊱ 🤖 *NAZUNA BOT • GYOMEI* 🤖 ⊰━━╮",
    "│",
    "│ ❌ *Comando não reconhecido*",
    "│ Você digitou: *${typedCommand}*",
    "│`;",
    "",
    "    if (topSimilar.length > 0) {",
    "      notFoundMessage += `",
    "│ 🔎 *Talvez você procurasse:*",
    "│`;",
    "",
    "      topSimilar.forEach((cmd, index) => {",
    "        const proximity = cmd.similarity >= 80",
    "          ? 'muito próximo'",
    "          : cmd.similarity >= 60",
    "            ? 'próximo'",
    "            : 'possível';",
    "",
    "        notFoundMessage += `│ ${index + 1}. *${groupPrefix}${cmd.command}* · ${cmd.similarity}% (${proximity})",
    "`;",
    "      });",
    "",
    "      notFoundMessage += `│",
    "│ Copie uma das opções acima e tente novamente.",
    "`;",
    "    } else {",
    "      notFoundMessage += `",
    "│ Nenhuma sugestão segura foi encontrada.",
    "│ Use *${groupPrefix}menu* para consultar os comandos.",
    "`;",
    "    }",
    "",
    "    notFoundMessage += `│",
    "╰━━ *${totalCommands} comandos disponíveis* ━━╯`;"
  ].join('\n');
}

function externalizeIaKey(source) {
  const declaration = `const IA_API_KEY = String(\n  process.env.NVIDIA_API_KEY\n  || automacoesV9.getConfig()?.nvidia_api_key\n  || ''\n).trim();`;

  const literalPattern = /const IA_API_KEY\s*=\s*['"][^'"]*['"]\s*;/;
  if (literalPattern.test(source)) return source.replace(literalPattern, declaration);

  const envOnly = "const IA_API_KEY = String(process.env.NVIDIA_API_KEY || '').trim();";
  if (source.includes(envOnly)) return source.replace(envOnly, declaration);

  if (source.includes('process.env.NVIDIA_API_KEY') && source.includes('automacoesV9.getConfig()?.nvidia_api_key')) {
    return source;
  }

  throw new Error('Patch final obrigatório não encontrado: externalização da chave NVIDIA');
}

export function finalizeGyomeiRuntime() {
  let runtimeIndex = fs.readFileSync(RUNTIME_INDEX, 'utf8');
  let runtimeIa = fs.readFileSync(RUNTIME_IA, 'utf8');
  let runtimeStart = fs.readFileSync(RUNTIME_START, 'utf8');

  runtimeIndex = replaceRequired(
    runtimeIndex,
    `    const quotedMedia = automacoesV9.getQuotedMediaSource(info.message);\n    if (!quotedMedia) return reply('Responda a uma foto, GIF ou vídeo para associar ao comando.');\n    const mediaBuffer = await getFileBuffer(quotedMedia.message, quotedMedia.type);\n    const savedMedia = await automacoesV9.saveCommandMedia(mediaCommand, mediaBuffer, quotedMedia.type, quotedMedia.gifPlayback);`,
    `    const downloadedMedia = await automacoesV9.downloadQuotedCommandMedia(info.message);\n    if (!downloadedMedia.ok) return reply(\`❌ \${downloadedMedia.msg}\`);\n    const savedMedia = await automacoesV9.saveCommandMedia(\n      mediaCommand,\n      downloadedMedia.buffer,\n      downloadedMedia.type,\n      downloadedMedia.gifPlayback\n    );`,
    'download independente do setmidia'
  );

  runtimeIndex = replacePatternRequired(
    runtimeIndex,
    /case 'criador':\s*\n\s*try\s*\{[\s\S]*?const TextinCriadorInfo = `[\s\S]*?`;\s*\n\s*await reply\(TextinCriadorInfo\);[\s\S]*?\n\s*break;/,
    `case 'criador':
  try {
    const TextinCriadorInfo = \`╭━━━⊱ 👨‍💻 *CRIADORES* 👨‍💻 ⊱━━━╮
│
│ 💎 *Hiudy* — criação original
│ 🌐 github.com/hiudyy · 📱 wa.me/553391967445
│
│ 💎 *DevTokyo* — continuidade da Nazuna
│ 🌐 github.com/DevTokyoVx · 📱 wa.me/5532985076326
│
│ 💎 *Alaska_dev* — versão GYOMEI
│ 🌐 github.com/dgreych · 📱 wa.me/5522997028553
│
╰━━━━━━━━━━━━━━━━━━━━━━━━╯\`;
    await reply(TextinCriadorInfo);
  } catch (e) {
    console.error(e);
    await reply('❌ Não foi possível carregar os créditos agora.');
  }
  break;`,
    'créditos completos da Nazuna e da versão modificada GYOMEI, com ênfase igual e link do GitHub de cada um'
  );

  runtimeIndex = replacePatternRequired(
    runtimeIndex,
    /    let notFoundMessage = `📊[\s\S]*?    notFoundMessage \+= `💭 \*Dica:\* Verifique se digitou o comando corretamente!`;/,
    buildCommandNotFoundCard(),
    'cartão de comandos similares'
  );

  runtimeIa = externalizeIaKey(runtimeIa);

  fs.writeFileSync(RUNTIME_INDEX, runtimeIndex);
  fs.writeFileSync(RUNTIME_IA, runtimeIa);
  fs.writeFileSync(RUNTIME_START, runtimeStart);
}
