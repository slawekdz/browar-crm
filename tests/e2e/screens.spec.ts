import { test, type Page } from "@playwright/test";

// Visual smoke: writes screenshots to test-results/screens for a manual look. Never asserts.
const shots = async (page: Page, suffix: string) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  if (await page.getByRole("button", { name: "Zaloguj" }).isVisible().catch(() => false)) {
    await page.getByLabel("Hasło").fill("x");
    await page.getByRole("button", { name: "Zaloguj" }).click();
  }
  await page.getByRole("region", { name: "Faktura" }).waitFor();
  await page.screenshot({ path: `test-results/screens/board-${suffix}.png`, fullPage: false });
  await page.getByRole("button", { name: "Usuń filtr" }).click();
  await page.getByRole("region", { name: "Zamknięty Wygrany" }).waitFor();
  await page.screenshot({ path: `test-results/screens/board-all-${suffix}.png`, fullPage: false });
  await page.getByRole("button", { name: "Lista" }).click();
  await page.getByRole("link", { name: "Deal #4031" }).waitFor();
  await page.screenshot({ path: `test-results/screens/list-${suffix}.png`, fullPage: false });
  await page.getByRole("button", { name: "Kanban" }).click();
  await page.getByLabel("Filtruj i szukaj").click();
  await page.getByRole("button", { name: "Deale w toku" }).click();
  await page.getByRole("region", { name: "Dostarczone" }).getByText("Deal #3899").click();
  await page.getByRole("dialog").getByRole("heading", { name: "Deal #3899" }).waitFor();
  await page.screenshot({ path: `test-results/screens/deal-${suffix}.png`, fullPage: false });
  await page.getByRole("dialog").getByRole("button", { name: "Produkty", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Dodaj produkt" }).waitFor();
  await page.screenshot({ path: `test-results/screens/deal-products-${suffix}.png`, fullPage: false });
  await page.keyboard.press("Escape");
  await page.goto("/#/products");
  await page.getByText("Hills Pils", { exact: true }).waitFor();
  await page.screenshot({ path: `test-results/screens/products-${suffix}.png`, fullPage: false });
  await page.goto("/#/companies");
  await page.getByLabel("Nazwa, NIP, e-mail, telefon").fill("7951039749");
  await page.getByRole("link", { name: /Bagatella/ }).click();
  await page.getByRole("dialog").getByText("Deal zakończony").first().waitFor();
  await page.screenshot({ path: `test-results/screens/company-${suffix}.png`, fullPage: false });
};

test("screens", async ({ page }, info) => {
  await shots(page, info.project.name);
});
