import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function readAppliedHash(statePath) {
  try {
    const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
    return typeof state?.sha256 === 'string' ? state.sha256 : null;
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

function withTimeout(promise, timeoutMs) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Tempo limite ao atualizar a foto de perfil.')), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function syncProfilePictureIfChanged(socket, { assetPath, statePath, timeoutMs = 20_000 }) {
  let image;
  try {
    image = await fs.readFile(assetPath);
  } catch (error) {
    if (error?.code === 'ENOENT') return { status: 'missing' };
    throw error;
  }
  const sha256 = digest(image);
  if (await readAppliedHash(statePath) === sha256) return { status: 'unchanged', sha256 };
  if (!socket?.user?.id || typeof socket.updateProfilePicture !== 'function') {
    throw new Error('Conexão do WhatsApp indisponível para atualizar a foto de perfil.');
  }
  await withTimeout(Promise.resolve(socket.updateProfilePicture(socket.user.id, image)), timeoutMs);
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  const temporary = `${statePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify({ sha256, appliedAt: new Date().toISOString() })}\n`, { mode: 0o600 });
  await fs.rename(temporary, statePath);
  return { status: 'updated', sha256 };
}
