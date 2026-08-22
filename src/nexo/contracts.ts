export type NexoStatus = 'enabled' | 'disabled' | 'unknown';

/**
 * Bounded context do NEXO. R0 define apenas a porta; não altera endpoint,
 * persistência, autorização ou comportamento remoto.
 */
export interface NexoPort {
  getStatus(userId: string): Promise<NexoStatus>;
  enable(userId: string): Promise<NexoStatus>;
  disable(userId: string): Promise<NexoStatus>;
}
