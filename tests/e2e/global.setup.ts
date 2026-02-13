import {
  applyMigrations,
  ensureTestDatabaseReady,
  resetMutableTables,
  seedFixtureData
} from "./helpers/db";

async function globalSetup() {
  await ensureTestDatabaseReady();
  await applyMigrations();
  await seedFixtureData();
  await resetMutableTables();
}

export default globalSetup;
