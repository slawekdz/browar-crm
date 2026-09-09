import { expect, test, type Page } from "@playwright/test";

// The phone layout mirrors the Bitrix24 mobile app; these run only in the "mobile" project.
test.skip(({ isMobile }) => !isMobile, "phone layout only");

const login = async (page: Page) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  if (await page.getByRole("button", { name: "Zaloguj" }).isVisible().catch(() => false)) {
    await page.getByLabel("Hasło").fill("x");
    await page.getByRole("button", { name: "Zaloguj" }).click();
  }
  await expect(page.getByRole("heading", { name: "CRM" })).toBeVisible();
};

test("deals list: funnel header, cards with stage chevron, stage picker and card menu", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Wszystkie etapy (5)")).toBeVisible();
  await expect(page.getByText("Kwota, zł")).toBeVisible();
  const card = page.locator("article", { hasText: "Deal #4031" });
  await expect(card.getByText("Kwota deala")).toBeVisible();
  await expect(card.getByText(/4\s?720 zł/)).toBeVisible();
  await expect(card.getByText("Delta Hydro Sp. z o.o.")).toBeVisible();
  await expect(card.getByText("firma")).toBeVisible();
  // stage picker from the chevron
  await card.getByRole("button", { name: /Do dostarczenia/ }).click();
  await page.getByRole("dialog", { name: "Etap" }).getByRole("button", { name: "Dostarczone" }).click();
  await expect(page.locator("article", { hasText: "Deal #4031" }).getByRole("button", { name: /Dostarczone/ })).toBeVisible();
  // card menu
  await page.getByRole("button", { name: "Menu Deal #4029" }).click();
  await expect(page.getByRole("button", { name: "Zaplanuj aktywność" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wyświetl oś czasu" })).toBeVisible();
  await page.keyboard.press("Escape");
  // stage filter sheet
  await page.getByText("Wszystkie etapy (5)").click();
  await page.getByRole("dialog", { name: "Etapy" }).getByRole("button", { name: "Zamknięty Wygrany" }).click();
  await expect(page.getByText("Pokazano 60 z 772")).toBeVisible();
});

test("deal screen: tabs Szczegóły / Oś czasu / Produkty with Bitrix sections, timeline and product editor", async ({ page }) => {
  await login(page);
  await page.locator("article", { hasText: "Deal #4031" }).getByText("Deal #4031").click();
  await expect(page.getByText("Więcej", { exact: true })).toBeVisible();
  await expect(page.getByText("Wymagane pola")).toBeVisible();
  await expect(page.getByText("Pozycje: 4")).toBeVisible();
  await expect(page.getByText("Delta Hydro Sp. z o.o.").first()).toBeVisible();
  await page.getByRole("button", { name: "Oś czasu" }).click();
  await expect(page.getByText("Rzeczy do zrobienia")).toBeVisible();
  await expect(page.getByText("Utwórz aktywność")).toBeVisible();
  await expect(page.getByText("Utworzono deal")).toBeVisible();
  await page.getByText("Utwórz aktywność").click();
  await page.getByLabel("Do zrobienia").fill("Oddzwonić do klienta");
  await page.getByRole("button", { name: "Zaplanuj", exact: true }).click();
  await expect(page.getByText("Oddzwonić do klienta")).toBeVisible();
  await page.getByRole("button", { name: "Produkty" }).click();
  await expect(page.getByText("Pozycje: 4")).toBeVisible();
  await expect(page.getByText("Łącznie:")).toBeVisible();
  await page.getByRole("button", { name: "Więcej" }).first().click();
  await expect(page.getByRole("button", { name: "Zapisz" })).toBeVisible();
  await page.getByRole("button", { name: "Zapisz" }).click();
  await expect(page.getByRole("button", { name: "Zapisz" })).toHaveCount(0);
  await page.getByRole("button", { name: "Zamknij" }).click();
  await expect(page.getByRole("heading", { name: "CRM" })).toBeVisible();
});

test("companies and contacts render as Bitrix cards; company screen has its tabs; tasks tab lists open activities", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Firmy" }).click();
  const company = page.locator("article", { hasText: "Delta Hydro Sp. z o.o." });
  await expect(company.getByText("Osoba odpowiedzialna")).toBeVisible();
  await expect(company.getByText("Utworzono")).toBeVisible();
  await company.getByText("Delta Hydro Sp. z o.o.").click();
  await expect(page.getByText("O firmie")).toBeVisible();
  await expect(page.getByText("Roczny przychód")).toBeVisible();
  await page.getByRole("button", { name: /^Deale \(/ }).click();
  await expect(page.locator("article", { hasText: "Deal #4031" })).toBeVisible();
  await page.getByRole("button", { name: "Zamknij" }).click();
  await page.getByRole("button", { name: "Kontakty" }).click();
  await expect(page.locator("article").first()).toBeVisible();
  await page.getByRole("button", { name: "Zadania" }).click();
  await expect(page.getByRole("heading", { name: "Zadania" })).toBeVisible();
});
