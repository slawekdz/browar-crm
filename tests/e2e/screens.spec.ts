import { test, type Page } from "@playwright/test";

// Visual smoke: writes screenshots to test-results/screens for a manual look. Never asserts.
const login = async (page: Page) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  if (await page.getByRole("button", { name: "Zaloguj" }).isVisible().catch(() => false)) {
    await page.getByLabel("Hasło").fill("x");
    await page.getByRole("button", { name: "Zaloguj" }).click();
  }
};

const desktop = async (page: Page, suffix: string) => {
  await login(page);
  await page.getByRole("region", { name: "Faktura" }).waitFor();
  await page.screenshot({ path: `test-results/screens/board-${suffix}.png` });
  await page.getByRole("button", { name: "Usuń filtr" }).click();
  await page.getByRole("region", { name: "Zamknięty Wygrany" }).waitFor();
  await page.screenshot({ path: `test-results/screens/board-all-${suffix}.png` });
  await page.getByRole("button", { name: "Lista" }).click();
  await page.getByRole("link", { name: "Deal #4031" }).waitFor();
  await page.screenshot({ path: `test-results/screens/list-${suffix}.png` });
  await page.getByRole("button", { name: "Kanban" }).click();
  await page.getByLabel("Filtruj i szukaj").click();
  await page.getByRole("button", { name: "Deale w toku" }).click();
  await page.getByRole("region", { name: "Dostarczone" }).getByText("Deal #3899").click();
  await page.getByRole("dialog").getByRole("heading", { name: "Deal #3899" }).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/screens/deal-${suffix}.png` });
  await page.getByRole("dialog").getByRole("button", { name: "Produkty", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Dodaj produkt" }).waitFor();
  await page.screenshot({ path: `test-results/screens/deal-products-${suffix}.png` });
  await page.keyboard.press("Escape");
  await page.goto("/#/products");
  await page.getByText("Hills Pils", { exact: true }).waitFor();
  await page.screenshot({ path: `test-results/screens/products-${suffix}.png` });
  await page.goto("/#/companies");
  await page.getByLabel("Nazwa, NIP, e-mail, telefon").fill("7951039749");
  await page.getByRole("link", { name: /Bagatella/ }).click();
  await page.getByRole("dialog").getByText("Deal zakończony").first().waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/screens/company-${suffix}.png` });
};

const mobile = async (page: Page, suffix: string) => {
  await login(page);
  await page.getByText("Wszystkie etapy (5)").waitFor();
  await page.screenshot({ path: `test-results/screens/board-${suffix}.png` });
  await page.locator("article", { hasText: "Deal #4031" }).getByText("Deal #4031").click();
  await page.getByText("Wymagane pola").waitFor();
  await page.screenshot({ path: `test-results/screens/deal-${suffix}.png` });
  await page.getByRole("button", { name: "Oś czasu" }).click();
  await page.getByText("Rzeczy do zrobienia").waitFor();
  await page.screenshot({ path: `test-results/screens/deal-timeline-${suffix}.png` });
  await page.getByRole("button", { name: "Produkty" }).click();
  await page.getByText("Łącznie:").waitFor();
  await page.screenshot({ path: `test-results/screens/deal-products-${suffix}.png` });
  await page.getByRole("button", { name: "Zamknij" }).click();
  await page.getByRole("button", { name: "Firmy" }).click();
  await page.locator("article").first().waitFor();
  await page.screenshot({ path: `test-results/screens/companies-${suffix}.png` });
  await page.locator("article", { hasText: "Delta Hydro" }).getByText("Delta Hydro Sp. z o.o.").click();
  await page.getByText("O firmie").waitFor();
  await page.screenshot({ path: `test-results/screens/company-${suffix}.png` });
  await page.getByRole("button", { name: "Zamknij" }).click();
  await page.getByRole("button", { name: "Produkty" }).click();
  await page.locator("article, button", { hasText: "Hills Pils" }).first().waitFor();
  await page.screenshot({ path: `test-results/screens/products-${suffix}.png` });
};

test("screens", async ({ page }, info) => {
  if (info.project.name === "mobile") await mobile(page, "mobile");
  else await desktop(page, "desktop");
});
