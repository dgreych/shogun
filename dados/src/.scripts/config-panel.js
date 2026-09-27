#!/usr/bin/env node
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { BUNNYFY_MODE_KEYS, loadEnvDocument, loadInstanceConfig, normalizeOwnerNumber, saveEnvUpdates, saveInstanceConfig } from './instanceConfigStore.js';
import { BUNNYFY_SERVICE_ORIGIN } from '../services/bunnyfy/instanceAccess.js';

const rl = readline.createInterface({ input, output });

async function ask(label, current, validate = value => Boolean(value)) {
  while (true) {
    const answer = (await rl.question(`${label}${current ? ` [${current}]` : ''}: `)).trim() || current;
    if (validate(answer)) return answer;
    output.write('Confira o valor e tente novamente.\n');
  }
}

try {
  const config = loadInstanceConfig();
  const existing = Object.fromEntries(loadEnvDocument().values);
  output.write('\n🐈‍⬛ SHOGUN · CONFIGURAÇÃO\n\n');
  config.nomebot = await ask('Nome do bot', config.nomebot || 'SHOGUN');
  config.numerodono = normalizeOwnerNumber(await ask('Número do dono com DDI e DDD', /^\d{10,15}$/.test(normalizeOwnerNumber(config.numerodono)) ? config.numerodono : '', value => /^\d{10,15}$/.test(normalizeOwnerNumber(value))));
  config.numerobot = normalizeOwnerNumber(await ask('Número do bot com DDI e DDD', config.numerobot || '', value => /^\d{10,15}$/.test(normalizeOwnerNumber(value))));
  config.nomedono ||= 'Dono';
  if (config.nomedono === 'Comandante') config.nomedono = 'Dono';
  config.prefixo ||= '!';
  output.write('\nChave BunnyFy: opcional. Enter mantém a chave atual ou ativa o acesso gratuito.\n');
  let key;
  try {
    if (output.isTTY) output.write('\x1b[8m');
    key = (await rl.question('Chave BunnyFy (- para remover): ')).trim();
  } finally { if (output.isTTY) output.write('\x1b[0m'); output.write('\n'); }
  const updates = { BOT_NAME: config.nomebot, DEFAULT_PERSONA: 'shogun', BUNNYFY_ENABLED: 'true', BUNNYFY_BASE_URL: BUNNYFY_SERVICE_ORIGIN,
    BUNNYFY_ALLOW_INSECURE_HTTP: 'true', BUNNYFY_API_TOKEN: key === '-' ? '' : key || existing.BUNNYFY_API_TOKEN || '' };
  for (const mode of BUNNYFY_MODE_KEYS) updates[mode] = 'exclusive';
  saveInstanceConfig(config);
  saveEnvUpdates(updates);
  output.write(`\nConfiguração salva. O prefixo dos comandos é ${config.prefixo}.\n`);
  output.write('BunnyFy: conversa e modelos disponíveis; outros serviços têm 20 chamadas gratuitas por dia, sem chave paga.\n');
  output.write(`Endereço oficial: ${BUNNYFY_SERVICE_ORIGIN}\nNão altere esse endereço. As credenciais dos provedores são gerenciadas pela BunnyFy.\n`);
} catch (error) {
  output.write(`\nNão foi possível concluir a configuração: ${error.message}\n`);
  process.exitCode = 1;
} finally { rl.close(); }
