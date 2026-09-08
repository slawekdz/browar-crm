"""Render public/icon.svg to assets/icon.png + splash for @capacitor/assets (Pillow cannot rasterise SVG, Chromium can)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)
svg = (ROOT / "public" / "icon.svg").read_text(encoding="utf-8")

with sync_playwright() as pw:
    br = pw.chromium.launch()
    pg = br.new_page(viewport={"width": 1024, "height": 1024})
    pg.set_content(f"<body style='margin:0;background:#1f2937'>{svg.replace('viewBox', 'width=\"1024\" height=\"1024\" viewBox')}</body>")
    pg.screenshot(path=str(ASSETS / "icon.png"))
    pg.screenshot(path=str(ASSETS / "icon-foreground.png"))
    pg.set_content("<body style='margin:0;background:#1f2937'></body>")
    pg.screenshot(path=str(ASSETS / "icon-background.png"))
    pg = br.new_page(viewport={"width": 2732, "height": 2732})
    pg.set_content(f"<body style='margin:0;background:#1f2937;display:flex;align-items:center;justify-content:center'>{svg.replace('viewBox', 'width=\"600\" height=\"600\" viewBox')}</body>")
    pg.screenshot(path=str(ASSETS / "splash.png"))
    pg.screenshot(path=str(ASSETS / "splash-dark.png"))
    br.close()
print("assets written")
