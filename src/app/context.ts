import type { NexoPort } from '../nexo/contracts.js';
import type { ShogunClientPort } from '../runtime/client.js';
import type { LegacyPersistencePort } from '../runtime/database.js';
import type { ServiceRegistry } from '../services/index.js';

/** Composition contract only. R0 does not instantiate operational services. */
export interface AppContext {
  readonly client: ShogunClientPort;
  readonly persistence: LegacyPersistencePort;
  readonly services: ServiceRegistry;
  readonly nexo: NexoPort;
}
