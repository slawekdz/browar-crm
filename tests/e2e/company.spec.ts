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
test("company card mirrors Bitrix: about panel, tabs, timeline with deal events, activities and comments", async ({ page }) => {
  await login(page);
  await page.goto("/#/companies");
  await page.getByLabel("Nazwa, NIP, e-mail, telefon").fill("7951039749");
  await page.getByRole("link", { name: /Bagatella/ }).click();
  const card = page.getByRole("dialog");
  await expect(card.getByRole("heading", { name: /Bagatella Bircza/ })).toBeVisible();
  await expect(card.getByText("7951039749")).toBeVisible();
  await expect(card.getByRole("link", { name: "salonrembrandt@interia.pl" })).toBeVisible();
  await expect(card.getByText("Faktura na 50% wystawiona")).toBeVisible();
  await expect(card.getByText("Deal zakończony").first()).toBeVisible();
  await expect(card.getByText("Zamknięty Wygrany").first()).toBeVisible();
  await expect(card.getByText("Firma utworzona")).toBeVisible();
  await expect(card.getByText("Dodaj nową aktywność")).toBeVisible();

  await card.getByLabel("Do zrobienia").fill("Zadzwonić w sprawie kolejnej dostawy");
  await card.getByRole("button", { name: "Zaplanuj", exact: true }).click();
  await expect(card.getByText("Zadzwonić w sprawie kolejnej dostawy")).toBeVisible();
  await expect(card.getByText("Dodaj nową aktywność")).toHaveCount(0);
  await card.getByRole("button", { name: "Wykonane" }).click();
  await expect(card.getByText("Zadanie wykonane")).toBeVisible();

  await card.getByRole("button", { name: "Komentarz", exact: true }).click();
  await card.getByLabel("Komentarz").fill("Nowy komentarz testowy");
  await card.getByRole("button", { name: "Wyślij" }).click();
  await expect(card.getByText("Nowy komentarz testowy")).toBeVisible();
  await card.locator("article", { hasText: "Nowy komentarz testowy" }).getByRole("button", { name: "Przypnij" }).click();
  await expect(card.getByText("przypięte")).toBeVisible();

  await card.getByRole("button", { name: /^Deale \(/ }).click();
  await expect(card.getByRole("link", { name: "Deal #3995" })).toBeVisible();
  await expect(card.getByRole("button", { name: "+ Nowy deal" })).toBeVisible();
  await card.getByRole("button", { name: /^Historia/ }).click();
  await expect(card.getByText("Zamknięty Wygrany").first()).toBeVisible();
});
