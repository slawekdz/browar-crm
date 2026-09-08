import { expect, test, type Page } from "@playwright/test";

const login = async (page: Page) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  if (await page.getByRole("button", { name: "Zaloguj" }).isVisible().catch(() => false)) {
    await page.getByLabel("Hasło").fill("x");
    await page.getByRole("button", { name: "Zaloguj" }).click();
  }
  await expect(page.getByRole("heading", { name: "Deale" })).toBeVisible();
};

test("kanban shows the migrated pipeline with Bitrix counts", async ({ page }) => {
  await login(page);
  for (const name of ["Zamówienie", "Próbki", "Do dostarczenia", "Dostarczone", "Faktura"]) {
    await expect(page.getByRole("region", { name })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Do dostarczenia" })).toContainText("Delta Hydro");
  await expect(page.getByRole("region", { name: "Faktura" })).toContainText("2");
  await page.getByRole("button", { name: "Wygrane" }).click();
  await expect(page.getByText("772 dealów")).toBeVisible();
});

test("deal page shows lines, timeline and stage history and moves stage", async ({ page }) => {
  await login(page);
  await page.goto("/#/deals/4031");
  await expect(page.getByRole("heading", { name: "Deal #4031" })).toBeVisible();
  await expect(page.getByText("4720,00 zł").first()).toBeVisible();
  await expect(page.getByText("Etap:").first()).toBeVisible();
  await page.getByLabel("Etap").selectOption("UC_P9ISM8");
  await expect(page.getByText("Etap: Dostarczone").first()).toBeVisible();
  await page.goto("/#/");
  await expect(page.getByRole("region", { name: "Dostarczone" })).toContainText("Deal #4031");
});

test("creates a deal with catalog lines and it lands on the board", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "+ Deal" }).first().click();
  await page.getByRole("dialog", { name: "Nowy deal" }).getByRole("button", { name: "Firma" }).click();
  await page.getByPlaceholder("Nazwa, NIP, e-mail").fill("Elo Velo");
  await page.getByRole("dialog", { name: "Firma" }).getByRole("button", { name: /Elo Velo Cafe/ }).click();
  await page.getByRole("button", { name: "+ Produkt" }).click();
  await page.getByPlaceholder("Nazwa produktu").fill("Hills Pils");
  await page.getByRole("dialog", { name: "Dodaj produkt" }).getByRole("button", { name: /^Hills Pils Piwo butelka/ }).click();
  await page.getByLabel("Ilość").fill("24");
  await expect(page.getByText("Razem: 141,60 zł")).toBeVisible();
  await page.getByRole("button", { name: "Utwórz deal" }).click();
  await expect(page.getByRole("heading", { name: "Deal #4032" })).toBeVisible();
  await expect(page.getByText("powtarzalny")).toBeVisible();
  await page.goto("/#/");
  await expect(page.getByRole("region", { name: "Zamówienie" })).toContainText("Deal #4032");
});

test("company page lists deal history and products page shows prices", async ({ page }) => {
  await login(page);
  await page.goto("/#/companies");
  await page.getByPlaceholder("Nazwa, NIP, e-mail, telefon").fill("Hard Rock");
  await page.getByRole("link", { name: /Hard Rock Pub/ }).click();
  await expect(page.getByRole("heading", { name: /Hard Rock Pub/ })).toBeVisible();
  await page.getByRole("button", { name: /^Deale \(/ }).click();
  await expect(page.getByRole("link", { name: /Deal #3899/ })).toBeVisible();
  await page.goto("/#/products");
  await expect(page.getByText("Hills Pils", { exact: true })).toBeVisible();
  await expect(page.getByText("5,90 zł").first()).toBeVisible();
});
