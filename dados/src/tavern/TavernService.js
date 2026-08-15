import { createTavernConfig } from './config.js';
import { MatchService } from './MatchService.js';
import { MatchEngine, createDefaultRegistries } from './domain/index.js';
import {
  MySqlStore,
  SqliteStore,
  TavernRepository,
  migrateSqliteToMySqlIfNeeded,
  resolveTavernDatabaseConfig
} from './persistence/index.js';

class TavernService {
  static async create({
    databasePath,
    databaseDriver,
    databaseUrl,
    databaseConfigPath,
    mysql,
    migrateSqlite = true,
    config,
    now,
    idFactory,
    seedFactory
  } = {}) {
    const resolvedConfig = createTavernConfig(config);
    const databaseConfig = await resolveTavernDatabaseConfig({
      databaseDriver,
      databaseUrl,
      databaseConfigPath,
      mysql
    });
    const timestampFactory = now ? () => new Date(now()).toISOString() : undefined;
    const storePromise = databaseConfig.driver === 'mysql'
      ? MySqlStore.open({ ...databaseConfig.mysql, now: timestampFactory })
      : SqliteStore.open({ filename: databasePath, now: timestampFactory });
    const [{ cardRegistry, heroRegistry }, store] = await Promise.all([
      createDefaultRegistries(),
      storePromise
    ]);
    try {
      if (databaseConfig.driver === 'mysql' && migrateSqlite) {
        const migration = await migrateSqliteToMySqlIfNeeded({
          targetStore: store,
          sourceFilename: databasePath,
          now: timestampFactory
        });
        if (migration.status === 'imported') {
          const importedRows = Object.values(migration.counts).reduce((total, count) => total + count, 0);
          console.log(`[TAVERN] Migração SQLite para MySQL concluída: ${importedRows} registros.`);
        }
      }
      const repository = new TavernRepository(store, {
        now: timestampFactory
      });
      await repository.seedCards(cardRegistry.list());
      const engine = new MatchEngine({
        cardRegistry,
        heroRegistry,
        config: resolvedConfig,
        databaseDriver: databaseConfig.driver,
        now,
        idFactory,
        seedFactory
      });
      const matches = new MatchService({ engine, repository });
      return new TavernService({
        config: resolvedConfig,
        databaseDriver: databaseConfig.driver,
        cardRegistry,
        heroRegistry,
        store,
        repository,
        engine,
        matches
      });
    } catch (error) {
      await store.close().catch(() => {});
      throw error;
    }
  }

  constructor({ config, databaseDriver, cardRegistry, heroRegistry, store, repository, engine, matches }) {
    this.config = config;
    this.databaseDriver = databaseDriver;
    this.cardRegistry = cardRegistry;
    this.heroRegistry = heroRegistry;
    this.store = store;
    this.repository = repository;
    this.engine = engine;
    this.matches = matches;
  }

  close() {
    return this.store.close();
  }
}

export { TavernService };
