import type { Page } from "@playwright/test";
import { expect, test as base } from "@playwright/test";
import {
  createShareSnapshot,
  getFoodProgressByName,
  getDefaultOwnerId,
  getGrowthEvents,
  queryMany,
  queryOne,
  resetMutableTables,
  setIntroducedFoods,
  upsertFoodProgressByName
} from "../helpers/db";

const AUTH_EMAIL = process.env.E2E_AUTH_EMAIL || "parent@example.com";
const AUTH_PASSWORD = process.env.E2E_AUTH_PASSWORD || "LOULOU38";

type DbFixture = {
  resetMutableTables: typeof resetMutableTables;
  queryMany: typeof queryMany;
  queryOne: typeof queryOne;
  getDefaultOwnerId: typeof getDefaultOwnerId;
  getFoodProgressByName: typeof getFoodProgressByName;
  upsertFoodProgressByName: typeof upsertFoodProgressByName;
  setIntroducedFoods: typeof setIntroducedFoods;
  createShareSnapshot: typeof createShareSnapshot;
  getGrowthEvents: typeof getGrowthEvents;
};

type E2EFixtures = {
  db: DbFixture;
  loginAsDefaultUser: () => Promise<void>;
  appPage: Page;
};

type AutoFixtures = {
  resetDbBeforeEach: void;
};

export const test = base.extend<E2EFixtures & AutoFixtures>({
  db: async ({}, runFixture) => {
    await runFixture({
      resetMutableTables,
      queryMany,
      queryOne,
      getDefaultOwnerId,
      getFoodProgressByName,
      upsertFoodProgressByName,
      setIntroducedFoods,
      createShareSnapshot,
      getGrowthEvents
    });
  },

  resetDbBeforeEach: [
    async ({ db }, runFixture) => {
      await db.resetMutableTables();
      await runFixture();
    },
    { auto: true }
  ],

  loginAsDefaultUser: async ({ page }, runFixture) => {
      await runFixture(async () => {
        await page.goto("/login");
        await page.getByLabel("Email").fill(AUTH_EMAIL);
        await page.getByLabel("Mot de passe").fill(AUTH_PASSWORD);

      await page.getByRole("button", { name: "Se connecter" }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { name: /Les premiers aliments/i })).toBeVisible();
    });
  },

  appPage: async ({ page, loginAsDefaultUser }, runFixture) => {
    await loginAsDefaultUser();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Les premiers aliments/i })).toBeVisible();
    await runFixture(page);
  }
});

export { expect };
