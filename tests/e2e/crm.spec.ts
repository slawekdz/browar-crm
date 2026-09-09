import { expect, test, type Page } from "@playwright/test";

// Phones get the Bitrix24-mobile layout, covered by mobile.spec.ts.
test.skip(({ isMobile }) => !!isMobile, "desktop layout only");

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

test("kanban shows the migrated pipeline with Bitrix counts and presets", async ({ page }) => {
  await login(page);
  for (const name of ["Zamówienie", "Próbki", "Do dostarczenia", "Dostarczone", "Faktura"]) {
    await expect(page.getByRole("region", { name })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Do dostarczenia" })).toContainText("Delta Hydro");
  await expect(page.getByRole("region", { name: "Faktura" })).toContainText("2");
  // "Deale w toku" preset chip is on; removing it shows the closed stages as columns after Faktura
  await page.getByRole("button", { name: "Usuń filtr" }).click();
  await expect(page.getByRole("region", { name: "Zamknięty Wygrany" })).toContainText("772");
  await expect(page.getByRole("region", { name: "Zamknięty Stracony" })).toContainText("18");
  await expect(page.getByText(/795 dealów/)).toBeVisible();
  // preset popup
  await page.getByLabel("Filtruj i szukaj").click();
  await page.getByRole("button", { name: "Zamknięte deale" }).click();
  await expect(page.getByText(/790 dealów/)).toBeVisible();
  await page.getByLabel("Filtruj i szukaj").click();
  await page.getByRole("button", { name: "Deale w toku" }).click();
  await expect(page.getByText(/5 dealów/)).toBeVisible();
});

test("deal opens as a slider over the board with the same stages as the board", async ({ page }) => {
  await login(page);
  await page.getByRole("region", { name: "Do dostarczenia" }).getByText("Deal #4031").click();
  const slider = page.getByRole("dialog");
  await expect(slider.getByRole("heading", { name: "Deal #4031" })).toBeVisible();
  await expect(slider.getByText(/4\s?720 zł/).first()).toBeVisible(); // pl-PL groups digits only from 10 000 up
  await expect(slider.getByText("Deal utworzony").first()).toBeVisible();
  await expect(slider.getByText("Delta Hydro Sp. z o.o.").first()).toBeVisible();
  // board still mounted underneath
  await expect(page.getByRole("region", { name: "Faktura" })).toBeVisible();
  const bar = slider.getByRole("group", { name: "Etapy dealu" });
  for (const name of ["Zamówienie", "Próbki", "Do dostarczenia", "Dostarczone", "Faktura", "Zamknij deal"]) await expect(bar.getByRole("button", { name })).toBeVisible();
  await bar.getByRole("button", { name: "Dostarczone" }).click();
  await expect(slider.getByText("Zmiana etapu").first()).toBeVisible();
  await bar.getByRole("button", { name: "Zamknij deal" }).click();
  await expect(slider.getByRole("button", { name: "Zamknięty Wygrany" })).toBeVisible();
  await slider.getByRole("button", { name: "Anuluj" }).click();
  // close with Escape: board state kept, card moved
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Dostarczone" })).toContainText("Deal #4031");
});

test("creates a deal with catalog lines and it lands on the board", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "+ Utwórz" }).click();
  await page.getByRole("dialog", { name: "Nowy deal" }).getByRole("button", { name: "Firma" }).click();
  await page.getByPlaceholder("Nazwa, NIP, e-mail").fill("Elo Velo");
  await page.getByRole("dialog", { name: "Firma" }).getByRole("button", { name: /Elo Velo Cafe/ }).click();
  await page.getByRole("button", { name: "+ Produkt" }).click();
  await page.getByPlaceholder("Nazwa produktu").fill("Hills Pils");
  await page.getByRole("dialog", { name: "Dodaj produkt" }).getByRole("button", { name: /^Hills Pils Piwo butelka/ }).click();
  await page.getByLabel("Ilość").fill("24");
  await expect(page.getByText(/Razem: 141,60 zł/)).toBeVisible();
  await page.getByRole("button", { name: "Utwórz deal" }).click();
  const slider = page.getByRole("dialog");
  await expect(slider.getByRole("heading", { name: "Deal #4032" })).toBeVisible();
  await expect(slider.getByText("Domyślny lejek (Powtarzalny deal)")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Zamówienie" })).toContainText("Deal #4032");
});

test("products open as sliders from a deal, from the product grid and from the catalog", async ({ page }) => {
  await login(page);
  await page.getByRole("region", { name: "Do dostarczenia" }).getByText("Deal #4031").click();
  const deal = page.getByRole("dialog").last();
  await expect(deal.getByRole("heading", { name: "Deal #4031" })).toBeVisible();
  await deal.getByRole("link", { name: "Wheat Valley" }).click();
  const product = page.getByRole("dialog").last();
  await expect(product.getByRole("heading", { name: "Wheat Valley" })).toBeVisible();
  await expect(product.getByText("O produkcie")).toBeVisible();
  await expect(product.getByText("Sprzedano łącznie")).toBeVisible();
  await expect(product.getByRole("link", { name: "Deal #4031" }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog").last().getByRole("heading", { name: "Deal #4031" })).toBeVisible();
  // from the editable product grid
  await page.getByRole("dialog").last().getByRole("button", { name: "Produkty", exact: true }).click();
  await page.getByRole("dialog").last().getByRole("link", { name: "Otwórz Hills Pils" }).click();
  await expect(page.getByRole("dialog").last().getByRole("heading", { name: "Hills Pils" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog").last().getByRole("heading", { name: "Deal #4031" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // from the catalog tiles
  await page.goto("/#/products");
  await page.getByRole("button", { name: /^Hills Pils Hills Pils Piwo butelka/ }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Hills Pils" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("5,90 zł").first()).toBeVisible();
});

test("list view: grid with stage bars, selection, row menu and paging", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Lista" }).click();
  await expect(page.getByRole("columnheader", { name: /Deal/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Deal #4031" })).toBeVisible();
  await expect(page.getByText("Zaznaczono: 0 / 5")).toBeVisible();
  await page.getByLabel("Zaznacz Deal #4031").check();
  await expect(page.getByText("Zaznaczono: 1 / 5")).toBeVisible();
  await page.getByLabel("Menu Deal #4029").click();
  await expect(page.getByRole("menuitem", { name: "Kopiuj" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Usuń filtr" }).click();
  await expect(page.getByText(/Razem: 795/)).toBeVisible();
  await expect(page.getByText("1 / 16")).toBeVisible();
  await page.getByLabel("Następna strona").click();
  await expect(page.getByText("2 / 16")).toBeVisible();
});

test("company opens from a card as a slider and its deals open on top of it", async ({ page }) => {
  await login(page);
  await page.getByRole("region", { name: "Dostarczone" }).getByRole("link", { name: /Hard Rock Pub/ }).click();
  const company = page.getByRole("dialog");
  await expect(company.getByRole("heading", { name: /Hard Rock Pub/ })).toBeVisible();
  await company.getByRole("button", { name: /^Deale \(/ }).click();
  await company.getByRole("link", { name: "Deal #3899" }).click();
  // two sliders stacked: the deal on top of the company
  await expect(page.getByRole("dialog", { name: "" }).last().getByRole("heading", { name: "Deal #3899" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog").last().getByRole("heading", { name: /Hard Rock Pub/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/#/products");
  await expect(page.getByText("Hills Pils", { exact: true })).toBeVisible();
  await expect(page.getByText("5,90 zł").first()).toBeVisible();
});
