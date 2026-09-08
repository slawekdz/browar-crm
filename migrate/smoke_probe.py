"""What does the live page show after login? Dumps text + console + failed requests."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

S = json.loads((Path(__file__).resolve().parent / ".secrets.json").read_text(encoding="utf-8"))
URL = "https://slawekdz.github.io/browar-crm/"

with sync_playwright() as pw:
    br = pw.chromium.launch()
    pg = br.new_page()
    logs, failed = [], []
    pg.on("console", lambda m: logs.append(f"{m.type}: {m.text[:300]}"))
    pg.on("requestfailed", lambda r: failed.append(f"{r.method} {r.url[:120]} {r.failure}"))
    pg.on("response", lambda r: failed.append(f"{r.status} {r.url[:120]}") if r.status >= 400 else None)
    pg.goto(URL, wait_until="networkidle")
    print("initial:", pg.locator("body").inner_text()[:300].replace("\n", " | "))
    if pg.get_by_role("button", name="Zaloguj").count():
        pg.get_by_label("E-mail").fill(S["user_email"])
        pg.get_by_label("Hasło").fill(S["user_password"])
        pg.get_by_role("button", name="Zaloguj").click()
        pg.wait_for_timeout(8000)
    print("after login:", pg.locator("body").inner_text()[:500].replace("\n", " | "))
    print("console:", *logs[:10], sep="\n  ")
    print("failed:", *failed[:10], sep="\n  ")
    pg.screenshot(path=str(Path(__file__).resolve().parent.parent / "test-results" / "live-probe.png"))
    br.close()
