import type { Page } from "@playwright/test";
import { expect, test as base } from "@playwright/test";
import {
  getFoodProgressByName,
  getGrowthEvents,
  queryMany,
  queryOne,
  resetMutableTables,
  setIntroducedFoods,
  upsertFoodProgressByName
} from "../helpers/db";

const AUTH_USER = process.env.E2E_AUTH_USER || "LJCLS";
const AUTH_PASSWORD = process.env.E2E_AUTH_PASSWORD || "LOULOU38";

type DbFixture = {
  resetMutableTables: typeof resetMutableTables;
  queryMany: typeof queryMany;
  queryOne: typeof queryOne;
  getFoodProgressByName: typeof getFoodProgressByName;
  upsertFoodProgressByName: typeof upsertFoodProgressByName;
  setIntroducedFoods: typeof setIntroducedFoods;
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
      getFoodProgressByName,
      upsertFoodProgressByName,
      setIntroducedFoods,
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
      await page.getByLabel("Identifiant").fill(AUTH_USER);
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
