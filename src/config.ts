export interface GyomeiRuntimeConfig {
  readonly legacySourceRoot: string;
  readonly legacyBootstrap: string;
  readonly configFile: string;
  readonly persistenceRoot: string;
  readonly modularRuntimeEnabled: false;
}

/**
 * Contrato estrutural de R0. Nenhum valor daqui substitui a configuração
 * operacional legada nesta fase.
 */
export const GYOMEI_R0_CONFIG: GyomeiRuntimeConfig = Object.freeze({
  legacySourceRoot: 'dados/src',
  legacyBootstrap: 'dados/src/.scripts/start-v9-fixed.js',
  configFile: 'dados/src/config.json',
  persistenceRoot: 'dados/database/dono',
  modularRuntimeEnabled: false
});
