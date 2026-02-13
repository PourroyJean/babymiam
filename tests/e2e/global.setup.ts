import {
  applyMigrations,
  ensureAuthUser,
  ensureTestDatabaseReady,
  resetMutableTables,
  seedFixtureData
} from "./helpers/db";

async function globalSetup() {
  await ensureTestDatabaseReady();
  await applyMigrations();
  await ensureAuthUser();
  await seedFixtureData();
  await resetMutableTables();
}

export default globalSetup;
