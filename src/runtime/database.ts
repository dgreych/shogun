export const LEGACY_PERSISTENCE_BOUNDARIES = Object.freeze({
  config: 'dados/src/config.json',
  automationState: 'dados/database/dono/automacoes-v9.json',
  commandMedia: 'dados/database/dono/command-media',
  deletedMessages: 'dados/database/dono/deleted-messages-v9.json'
});

/**
 * Porta futura. Implementações deverão preservar caminhos, formatos e
 * atomicidade do legado até existir uma migração aprovada separadamente.
 */
export interface LegacyPersistencePort {
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, value: T): Promise<void>;
}
