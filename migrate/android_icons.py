"""Write Android launcher icons from assets/icon.png with Pillow (the @capacitor/assets sharp binary is not available on ARM64 Windows)."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"
SRC = Image.open(ROOT / "assets" / "icon.png").convert("RGBA")
BG = (31, 41, 55, 255)
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=radius, fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, mask=mask)
    return out


def circle(img: Image.Image) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).ellipse([0, 0, img.width - 1, img.height - 1], fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, mask=mask)
    return out


for density, scale in DENSITIES.items():
    folder = RES / f"mipmap-{density}"
    folder.mkdir(exist_ok=True)
    size = int(48 * scale)
    icon = SRC.resize((size, size), Image.LANCZOS)
    rounded(icon, size // 5).save(folder / "ic_launcher.png")
    circle(icon).save(folder / "ic_launcher_round.png")
    # adaptive foreground: 108dp canvas, artwork inside the 72dp safe zone
    canvas = int(108 * scale)
    inner = int(66 * scale)
    fg = Image.new("RGBA", (canvas, canvas), BG)
    fg.paste(SRC.resize((inner, inner), Image.LANCZOS), ((canvas - inner) // 2, (canvas - inner) // 2))
    fg.save(folder / "ic_launcher_foreground.png")

values = RES / "values"
values.mkdir(exist_ok=True)
(values / "ic_launcher_background.xml").write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1F2937</color>\n</resources>\n', encoding="utf-8")
print("icons written for", ", ".join(DENSITIES))
