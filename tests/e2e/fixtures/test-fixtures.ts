import type { Page } from "@playwright/test";
import { expect, test as base } from "@playwright/test";
import {
  createPublicShareLink,
  getFoodProgressByName,
  getDefaultOwnerId,
  getGrowthEvents,
  queryMany,
  queryOne,
  replaceFoodTastingsByName,
  resetMutableTables,
  setFinalPreferenceByName,
  setFoodTastingsByName,
  setIntroducedFoods,
  upsertFoodProgressByName
} from "../helpers/db";

const AUTH_EMAIL = process.env.E2E_AUTH_EMAIL || "e2e-parent@example.test";
const E2E_PASSWORD = process.env.E2E_AUTH_PASSWORD || "e2e-test-password";

type DbFixture = {
  resetMutableTables: typeof resetMutableTables;
  queryMany: typeof queryMany;
  queryOne: typeof queryOne;
  getDefaultOwnerId: typeof getDefaultOwnerId;
  getFoodProgressByName: typeof getFoodProgressByName;
  upsertFoodProgressByName: typeof upsertFoodProgressByName;
  setFoodTastingsByName: typeof setFoodTastingsByName;
  setFinalPreferenceByName: typeof setFinalPreferenceByName;
  replaceFoodTastingsByName: typeof replaceFoodTastingsByName;
  setIntroducedFoods: typeof setIntroducedFoods;
  createPublicShareLink: typeof createPublicShareLink;
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
      setFoodTastingsByName,
      setFinalPreferenceByName,
      replaceFoodTastingsByName,
      setIntroducedFoods,
      createPublicShareLink,
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
      await page.locator('input[name="email"]').fill(AUTH_EMAIL);
      await page.locator('input[name="password"]').fill(E2E_PASSWORD);

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
