import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');

export function prepareMediaTools(options = {}) {
  const root = options.root ?? ROOT;
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const log = options.log ?? console.log;
  const load = options.load ?? createRequire(path.join(root, 'package.json'));
  const probe = options.probe ?? (file => spawnSync(file, ['-version'], {
    env, timeout: 15000, windowsHide: true, encoding: 'utf8', maxBuffer: 128 * 1024,
  }).status === 0);
  const android = platform === 'android' || Boolean(env.TERMUX_VERSION) || String(env.PREFIX ?? '').startsWith('/data/data/com.termux/');
  const missing = [];
  const paths = new Set();
  for (const tool of ['ffmpeg', 'ffprobe']) {
    const variable = tool === 'ffmpeg' ? 'FFMPEG_PATH' : 'FFPROBE_PATH';
    let executable = [env[variable], tool].filter(Boolean).find(probe);
    if (!executable && !android) {
      try {
        const bundled = load(tool === 'ffmpeg' ? 'ffmpeg-static' : '@ffprobe-installer/ffprobe');
        const file = typeof bundled === 'string' ? bundled : bundled?.path;
        if (typeof file === 'string' && probe(file)) executable = file;
      } catch { /* Se o download não veio, o tutorial mostra o caminho manual. */ }
    }
    if (executable) {
      env[variable] = executable;
      if (path.isAbsolute(executable)) paths.add(path.dirname(executable));
    } else missing.push(tool);
  }
  if (paths.size) env.PATH = [...paths, env.PATH ?? ''].join(path.delimiter);
  if (missing.length) {
    const command = android ? 'pkg install -y ffmpeg' : platform === 'win32' ? 'winget install --id Gyan.FFmpeg --exact --source winget' : platform === 'darwin' ? 'brew install ffmpeg' : 'sudo apt install -y ffmpeg';
    log(`⚠️ Ferramentas de mídia ausentes: ${missing.join(', ')}. Instale o FFmpeg para usar áudio, vídeo e figurinhas: ${command}`);
    log('📖 Tutorial: https://github.com/dgreych/shogun/tree/main/docs/instalacao');
  }
  return { missing };
}
