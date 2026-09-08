"""Read-only smoke test of the deployed app against Supabase: login, board, deal, products. Prints a short report."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

S = json.loads((Path(__file__).resolve().parent / ".secrets.json").read_text(encoding="utf-8"))
URL = "https://slawekdz.github.io/browar-crm/"
OUT = Path(__file__).resolve().parent.parent / "test-results" / "live"
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as pw:
    for name, device in (("desktop", None), ("mobile", pw.devices["Pixel 7"])):
        br = pw.chromium.launch()
        ctx = br.new_context(**(device or {}))
        pg = ctx.new_page()
        errors = []
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.goto(URL, wait_until="networkidle")
        pg.get_by_label("E-mail").fill(S["user_email"])
        pg.get_by_label("Hasło").fill(S["user_password"])
        pg.get_by_role("button", name="Zaloguj").click()
        pg.get_by_role("heading", name="Deale").wait_for(timeout=30000)
        pg.get_by_text("Deal #4031").wait_for(timeout=30000)
        board = pg.locator("main").inner_text()
        pg.screenshot(path=str(OUT / f"board-{name}.png"))
        pg.goto(URL + "#/deals/4031", wait_until="networkidle")
        pg.get_by_role("heading", name="Deal #4031").wait_for()
        deal = pg.locator("main").inner_text()
        pg.goto(URL + "#/products", wait_until="networkidle")
        pg.get_by_text("Hills Pils", exact=True).wait_for()
        imgs = pg.evaluate("() => Array.from(document.images).filter(i => i.src.includes('storage')).map(i => [i.naturalWidth > 0, i.src.split('/').pop()])")
        pg.screenshot(path=str(OUT / f"products-{name}.png"))
        print(name, "| deals line:", next((l for l in board.splitlines() if "dealów" in l), "?"),
              "| Faktura col has 2:", "Faktura" in board, "| deal 4031 amount ok:", "4720,00" in deal,
              "| storage images loaded:", sum(1 for ok, _ in imgs if ok), "/", len(imgs), "| console errors:", errors[:3])
        br.close()
