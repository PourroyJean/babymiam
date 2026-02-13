import { closePool } from "./helpers/db";

async function globalTeardown() {
  await closePool();
}

export default globalTeardown;
