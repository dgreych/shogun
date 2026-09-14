import fs from 'fs';
import path from 'path';

/**
 * Trava de instância única por sessão.
 *
 * Duas cópias do bot apontando para a mesma pasta de sessão não convivem: o
 * WhatsApp aceita só uma, expulsa a anterior com o código 440 e o serviço que
 * perdeu para de reconectar de propósito, para não entrar em cabo de guerra.
 * O resultado visível é um bot que fica mudo sem nenhum erro aparente.
 *
 * O arquivo guarda o PID do dono. Um lock cujo processo morreu é apenas lixo
 * de um encerramento abrupto e pode ser tomado.
 */

const NOME = '.instancia.lock';

function vivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (erro) {
    // EPERM significa que o processo existe e é de outro usuário.
    return erro.code === 'EPERM';
  }
}

export function adquirirTravaDeSessao(pastaDaSessao) {
  const alvo = path.join(pastaDaSessao, NOME);
  fs.mkdirSync(pastaDaSessao, { recursive: true });

  const atual = (() => {
    try {
      return Number.parseInt(fs.readFileSync(alvo, 'utf8').trim(), 10);
    } catch {
      return Number.NaN;
    }
  })();

  if (Number.isInteger(atual) && atual !== process.pid && vivo(atual)) {
    const erro = new Error(
      `já existe um bot rodando nesta sessão (PID ${atual}).\n`
      + '   Encerre-o antes de abrir outro, ou acompanhe o que está no ar com:\n'
      + '   bash ops/local-lab/painel.sh',
    );
    erro.code = 'SESSAO_EM_USO';
    throw erro;
  }

  fs.writeFileSync(alvo, String(process.pid));

  let liberado = false;
  const liberar = () => {
    if (liberado) return;
    liberado = true;
    try {
      // Só remove se ainda for nosso: outro processo pode ter assumido.
      if (fs.readFileSync(alvo, 'utf8').trim() === String(process.pid)) fs.rmSync(alvo);
    } catch { /* encerrando: nada a fazer */ }
  };

  process.on('exit', liberar);
  for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sinal, () => { liberar(); process.exit(0); });
  }

  return liberar;
}
