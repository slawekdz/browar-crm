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
  await page.goto("/#/deals/3899");
  await page.getByRole("heading", { name: "Deal #3899" }).waitFor();
  await page.screenshot({ path: `test-results/screens/deal-${suffix}.png`, fullPage: true });
  await page.goto("/#/products");
  await page.getByText("Hills Pils", { exact: true }).waitFor();
  await page.screenshot({ path: `test-results/screens/products-${suffix}.png`, fullPage: false });
  await page.goto("/#/companies/25");
  await page.getByText("Historia dealów").waitFor();
  await page.screenshot({ path: `test-results/screens/company-${suffix}.png`, fullPage: false });
};

test("screens", async ({ page }, info) => {
  await shots(page, info.project.name);
});
