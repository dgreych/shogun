import type { NexoPort } from '../nexo/contracts.js';
import type { GyomeiClientPort } from '../runtime/client.js';
import type { LegacyPersistencePort } from '../runtime/database.js';
import type { ServiceRegistry } from '../services/index.js';

/** Composition contract only. R0 does not instantiate operational services. */
export interface AppContext {
  readonly client: GyomeiClientPort;
  readonly persistence: LegacyPersistencePort;
  readonly services: ServiceRegistry;
  readonly nexo: NexoPort;
}
