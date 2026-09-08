"""Re-upload product photos under new names and repoint products.image_path, to escape the CDN's cached octet-stream copies."""
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
S = json.loads((ROOT / "migrate" / ".secrets.json").read_text(encoding="utf-8-sig"))
IMAGES = ROOT / "public" / "product_images"
SUFFIX = "-v2"


def request(method, path, body=None, headers=None):
    req = urllib.request.Request(S["url"].rstrip("/") + path, data=body, method=method)
    req.add_header("apikey", S["service_role"])
    req.add_header("Authorization", f"Bearer {S['service_role']}")
    req.add_header("User-Agent", "browar-crm-migration/1.0")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.status, resp.read().decode()


rows = json.loads(request("GET", "/rest/v1/products?select=id,image_path&image_path=not.is.null")[1])
for row in rows:
    old = row["image_path"]
    if SUFFIX in old:
        continue
    src = IMAGES / old
    if not src.exists():
        print("missing local file", old)
        continue
    new = f"{src.stem}{SUFFIX}{src.suffix}"
    request("POST", f"/storage/v1/object/products/{new}", src.read_bytes(), {"Content-Type": "image/webp", "x-upsert": "true"})
    request("PATCH", f"/rest/v1/products?id=eq.{row['id']}", json.dumps({"image_path": new}).encode(), {"Content-Type": "application/json", "Prefer": "return=minimal"})
    print(row["id"], old, "->", new)
print("done")
