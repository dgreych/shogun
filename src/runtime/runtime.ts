import type { AppContext } from '../app/context.js';

/** Runtime futuro. Nenhuma implementação é conectada ao bootstrap em R0. */
export interface ShogunRuntime {
  readonly context: AppContext;
  start(): Promise<void>;
  stop(): Promise<void>;
}
