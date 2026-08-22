import fs from 'node:fs';

export type GroupStateRecord = Record<string, unknown>;

export interface GroupStateStore {
  read(): GroupStateRecord;
  write(state: GroupStateRecord): void;
  update(mutator: (state: GroupStateRecord) => void): GroupStateRecord;
}

/**
 * Fronteira tipada para o JSON de configuração já persistido pelo Gyomei.
 *
 * O formato em disco permanece idêntico ao legado durante a migração. O que
 * muda é quem o manipula: domínios TypeScript passam a concentrar leitura,
 * validação e escrita, em vez de espalhar fs.writeFileSync pelos comandos.
 */
export class JsonGroupStateStore implements GroupStateStore {
  public constructor(
    private readonly filePath: string,
    private readonly seed: Readonly<GroupStateRecord>,
  ) {}

  public read(): GroupStateRecord {
    try {
      if (this.filePath && fs.existsSync(this.filePath)) {
        const parsed: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        if (isRecord(parsed)) return parsed;
      }
    } catch {
      // Mantém a tolerância histórica do runtime: usa o estado já carregado.
    }
    return { ...this.seed };
  }

  public write(state: GroupStateRecord): void {
    if (!this.filePath) throw new Error('Arquivo de estado do grupo não informado.');
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  }

  public update(mutator: (state: GroupStateRecord) => void): GroupStateRecord {
    const state = this.read();
    mutator(state);
    this.write(state);
    return state;
  }
}

export function isRecord(value: unknown): value is GroupStateRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function readBoolean(state: GroupStateRecord, key: string): boolean {
  return state[key] === true;
}

export function toggleBoolean(state: GroupStateRecord, key: string): boolean {
  const next = state[key] !== true;
  state[key] = next;
  return next;
}

export function readString(state: GroupStateRecord, key: string): string | undefined {
  const value = state[key];
  return typeof value === 'string' ? value : undefined;
}

export function readNumber(state: GroupStateRecord, key: string): number | undefined {
  const value = state[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
