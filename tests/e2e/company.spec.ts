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

// Bagatella Bircza Salon Antique-Rembrandt: NIP 7951039749, e-mail, one Bitrix comment, several won deals.
test("company page mirrors the Bitrix card: about panel, tabs, timeline with deal events and comments", async ({ page }) => {
  await login(page);
  await page.goto("/#/companies");
  await page.getByPlaceholder("Nazwa, NIP, e-mail, telefon").fill("7951039749");
  await page.getByRole("link", { name: /Bagatella/ }).click();
  await expect(page.getByRole("heading", { name: /Bagatella Bircza/ })).toBeVisible();
  await expect(page.getByText("7951039749")).toBeVisible();
  await expect(page.getByRole("link", { name: "salonrembrandt@interia.pl" })).toBeVisible();
  await expect(page.getByText("Faktura na 50% wystawiona")).toBeVisible();
  await expect(page.getByText("Deal zakończony").first()).toBeVisible();
  await expect(page.getByText("Zamknięty Wygrany").first()).toBeVisible();
  await expect(page.getByText("Dodaj nową aktywność")).toBeVisible();

  // plan an activity: it lands under "Do zrobienia", then complete it
  await page.getByLabel("Do zrobienia").fill("Zadzwonić w sprawie kolejnej dostawy");
  await page.getByRole("button", { name: "Zaplanuj", exact: true }).click();
  await expect(page.getByText("Zadzwonić w sprawie kolejnej dostawy")).toBeVisible();
  await expect(page.getByText("Dodaj nową aktywność")).toHaveCount(0);
  await page.getByRole("button", { name: "Wykonane" }).click();
  await expect(page.getByText("Zadanie wykonane")).toBeVisible();

  // comment, pin it, edit it
  await page.getByRole("button", { name: "Komentarz", exact: true }).click();
  await page.getByLabel("Komentarz").fill("Nowy komentarz testowy");
  await page.getByRole("button", { name: "Wyślij" }).click();
  await expect(page.getByText("Nowy komentarz testowy")).toBeVisible();
  const card = page.locator("article", { hasText: "Nowy komentarz testowy" });
  await card.getByRole("button", { name: "Przypnij" }).click();
  await expect(page.getByText("przypięte")).toBeVisible();

  // tabs
  await page.getByRole("button", { name: /^Deale \(/ }).click();
  await expect(page.getByRole("link", { name: /Deal #3995/ })).toBeVisible();
  await page.getByRole("button", { name: /^Historia/ }).click();
  await expect(page.getByText("Zamknięty Wygrany").first()).toBeVisible();
});
