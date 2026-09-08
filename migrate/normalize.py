"""Turn the raw Bitrix24 dump into the application's snapshot (public/snapshot.json).

Input:  ~/Downloads/browar_bitrix_inventory/*.json  (written by CRM-main/bitrix_sync/inventory_crm.py + extras)
Output: public/snapshot.json, public/product_images/*  (consumed by the local adapter and by load_supabase.py)

Bitrix ids are kept as primary keys so "Deal #4031" stays "Deal #4031".
"""

from __future__ import annotations

import json
import re
import shutil
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

SRC = Path.home() / "Downloads" / "browar_bitrix_inventory"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "snapshot.json"
IMG_OUT = ROOT / "public" / "product_images"
SITE_IMAGES = Path.home() / "Downloads" / "browarpogorza" / "images"

STAGE_COLORS = {
    "NEW": "#38bdf8",
    "UC_X5KJAY": "#22d3ee",
    "UC_UOUQ17": "#2dd4bf",
    "UC_P9ISM8": "#34d399",
    "PREPAYMENT_INVOICE": "#fbbf24",
    "WON": "#4ade80",
    "LOSE": "#f87171",
    "APOLOGY": "#fb923c",
}
# crm.dealcategory.stage.list does not return SEMANTICS; Bitrix fixes the meaning by code.
SEMANTIC_BY_CODE = {"WON": "won", "LOSE": "lost", "APOLOGY": "lost"}

# Product groups are not modelled in Bitrix; derived from the names so the catalog can be filtered.
GROUP_RULES = [
    (re.compile(r"pet|keg", re.I), "Piwo PET/KEG"),
    (re.compile(r"kawa|coffee fes", re.I), "Kawa"),
    (re.compile(r"zestaw|czapk|szkło|podkładk|broszur|baner|leżak", re.I), "Gadżety"),
    (re.compile(r"usług|katering", re.I), "Usługi"),
]


def load(name: str):
    return json.loads((SRC / f"{name}.json").read_text(encoding="utf-8"))


def iso(value: str | None) -> str | None:
    if not value:
        return None
    return datetime.fromisoformat(value).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def date_only(value: str | None) -> str | None:
    return value[:10] if value else None


def num(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def opt_int(value) -> int | None:
    return int(value) if value not in (None, "", "0", 0) else None


def first_value(multifield) -> str | None:
    if not multifield:
        return None
    return multifield[0].get("VALUE") or None


def group_for(name: str) -> str:
    for pattern, group in GROUP_RULES:
        if pattern.search(name):
            return group
    return "Piwo butelka"


SITE_IMAGE_ALIASES = {
    "hills pils": "beer-hills-pils",
    "herb apa": "beer-herb-apa",
    "wheat valley": "beer-wheat-valley",
    "san lajt": "beer-san-lajt",
    "green hills": "beer-green-hills",
    "dark sky kokos & kawa": "beer-dark-sky-coconut-coffee",
    "dark sky": "beer-dark-sky",
    "beerba classic": "beer-beerba",
    "coffee fes": "beer-coffee-fes",
    "blue sky": "puszka-blue-sky",
    "podium jasne pełne": "beer-podium-label",
    "podium active": "beer-podium-label",
    "zestaw świąteczny": "zestaw",
}


def site_image_for(name: str, site_images: dict[str, Path]) -> Path | None:
    """PET/keg variants and sizes share the base beer's photo, so match on the longest alias prefix."""
    key = name.lower()
    for alias in sorted(SITE_IMAGE_ALIASES, key=len, reverse=True):
        if key.startswith(alias):
            return site_images.get(SITE_IMAGE_ALIASES[alias])
    return None


MAX_EDGE = 800


def shrink(source: Path, target: Path) -> str:
    """Product photo for the catalog card: longest edge 800 px, webp. Returns the file name."""
    from PIL import Image

    with Image.open(source) as im:
        im = im.convert("RGB") if im.mode not in ("RGB", "RGBA") else im
        im.thumbnail((MAX_EDGE, MAX_EDGE))
        im.save(target, "WEBP", quality=82)
    return target.name


def strip_bb(text: str) -> str:
    text = re.sub(r"\[USER=\d+\](.*?)\[/USER\]", r"@\1", text)
    text = re.sub(r"\[/?(B|I|U|URL[^\]]*|QUOTE|CODE|COLOR[^\]]*|SIZE[^\]]*)\]", "", text, flags=re.I)
    return text.strip()


def main() -> None:
    pipelines = load("deal_pipelines")
    stages = [
        {"code": s["STATUS_ID"], "name": s["NAME"], "semantic": SEMANTIC_BY_CODE.get(s["STATUS_ID"], "open"), "sort": int(s["SORT"]), "color": STAGE_COLORS.get(s["STATUS_ID"], "#94a3b8")}
        for s in pipelines[0]["stages"]
    ]

    users = load("users")
    people = {int(u["ID"]): {"id": int(u["ID"]), "name": f"{u.get('NAME', '')} {u.get('LAST_NAME', '')}".strip(), "active": True} for u in users}

    addresses = {a["ENTITY_ID"]: a for a in load("requisites")["addresses"]}
    requisites = {r["ID"]: r for r in load("requisites")["requisites"]}
    company_address: dict[int, str] = {}
    for req in requisites.values():
        if req["ENTITY_TYPE_ID"] != "4":
            continue
        addr = addresses.get(req["ID"])
        if addr:
            parts = [addr.get("ADDRESS_1"), addr.get("ADDRESS_2"), addr.get("POSTAL_CODE"), addr.get("CITY")]
            company_address[int(req["ENTITY_ID"])] = ", ".join(p for p in parts if p)

    companies = []
    for c in load("companies"):
        cid = int(c["ID"])
        nip = c.get("UF_CRM_1669020647184") or c.get("UF_CRM_1669020566528")
        companies.append({
            "id": cid,
            "name": c["TITLE"].strip(),
            "nip": str(nip).split(".")[0] if nip else None,
            "email": first_value(c.get("EMAIL")),
            "phone": first_value(c.get("PHONE")),
            "address": company_address.get(cid) or (c.get("ADDRESS") or None),
            "company_type": c.get("COMPANY_TYPE") or None,
            "comment": c.get("COMMENTS") or None,
            "owner_id": opt_int(c.get("ASSIGNED_BY_ID")),
            "created_at": iso(c["DATE_CREATE"]),
            "updated_at": iso(c["DATE_MODIFY"]),
        })
        for uid in (opt_int(c.get("ASSIGNED_BY_ID")), opt_int(c.get("CREATED_BY_ID"))):
            if uid and uid not in people:
                people[uid] = {"id": uid, "name": f"Użytkownik {uid}", "active": False}

    contacts = []
    for c in load("contacts"):
        contacts.append({
            "id": int(c["ID"]),
            "first_name": (c.get("NAME") or "").strip(),
            "last_name": (c.get("LAST_NAME") or "").strip() or None,
            "phone": first_value(c.get("PHONE")),
            "email": first_value(c.get("EMAIL")),
            "position": c.get("POST") or None,
            "company_id": opt_int(c.get("COMPANY_ID")),
            "created_at": iso(c["DATE_CREATE"]),
        })

    # product images: the three Bitrix photos, then site photos matched by slug
    IMG_OUT.mkdir(parents=True, exist_ok=True)
    image_by_product: dict[int, str] = {}
    for old in IMG_OUT.glob("*"):
        old.unlink()
    for img in load("product_images"):
        pid = int(img["product_id"])
        if pid in image_by_product:
            continue
        image_by_product[pid] = shrink(SRC / "product_images" / img["file"], IMG_OUT / f"{pid:04d}_bitrix.webp")
    site_images: dict[str, Path] = {}
    for folder in (SITE_IMAGES, SITE_IMAGES.parent / "images-optimized"):  # optimized copies win when present
        for path in folder.glob("*") if folder.exists() else []:
            if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
                site_images[path.stem.lower()] = path

    products = []
    for p in load("products_full")["products_full"]:
        pid = int(p["ID"])
        name = p["NAME"].strip()
        slug = p.get("CODE") or re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        if pid not in image_by_product:
            candidate = site_image_for(name, site_images)
            if candidate:
                image_by_product[pid] = shrink(candidate, IMG_OUT / f"{pid:04d}_site.webp")
        products.append({
            "id": pid,
            "name": name,
            "slug": slug,
            "price": num(p.get("PRICE")),
            "unit": "szt.",
            "active": p.get("ACTIVE", "Y") == "Y",
            "sort": int(p.get("SORT") or 500),
            "group_name": group_for(name),
            "image_path": image_by_product.get(pid),
            "created_at": iso(p.get("DATE_CREATE")),
        })

    deals = []
    for d in load("deals"):
        did = int(d["ID"])
        stage = d["STAGE_ID"]
        deals.append({
            "id": did,
            "title": d["TITLE"].strip() or f"Deal #{did}",
            "company_id": opt_int(d.get("COMPANY_ID")),
            "contact_id": opt_int(d.get("CONTACT_ID")),
            "stage_code": stage,
            "amount": num(d.get("OPPORTUNITY")),
            "currency": d.get("CURRENCY_ID") or "PLN",
            "begin_date": date_only(d.get("BEGINDATE")),
            "close_date": date_only(d.get("CLOSEDATE")),
            "closed": d.get("CLOSED") == "Y",
            "repeat_customer": d.get("IS_RETURN_CUSTOMER") == "Y",
            "owner_id": opt_int(d.get("ASSIGNED_BY_ID")),
            "comment": d.get("COMMENTS") or None,
            "source": d.get("SOURCE_ID") or None,
            "created_at": iso(d["DATE_CREATE"]),
            "updated_at": iso(d["DATE_MODIFY"]),
            "moved_at": iso(d.get("MOVED_TIME")),
            "previous_stage_code": d.get("PREVIOUS_STAGE_ID") or None,
        })
        for uid in (opt_int(d.get("ASSIGNED_BY_ID")), opt_int(d.get("MOVED_BY_ID"))):
            if uid and uid not in people:
                people[uid] = {"id": uid, "name": f"Użytkownik {uid}", "active": False}

    product_ids = {p["id"] for p in products}
    deal_lines = []
    for deal_id, rows in load("deal_productrows").items():
        for r in rows:
            pid = opt_int(r.get("PRODUCT_ID"))
            deal_lines.append({
                "id": int(r["ID"]),
                "deal_id": int(deal_id),
                "product_id": pid if pid in product_ids else None,
                "product_name": (r.get("PRODUCT_NAME") or "").strip(),
                "price": num(r.get("PRICE")),
                "quantity": num(r.get("QUANTITY")),
                "discount_rate": num(r.get("DISCOUNT_RATE")),
                "discount_sum": num(r.get("DISCOUNT_SUM")),
                "sort": int(r.get("SORT") or 0),
            })

    stage_history = [
        {"id": int(h["ID"]), "deal_id": int(h["OWNER_ID"]), "stage_code": h["STAGE_ID"], "moved_at": iso(h["CREATED_TIME"]), "moved_by": None}
        for h in load("deal_stagehistory")
    ]

    comments = []
    raw_comments = load("timeline_comments")
    for entity, per_entity in raw_comments.items():
        for rows in per_entity.values():
            for c in rows:
                comments.append({
                    "id": int(c["ID"]),
                    "entity_type": entity,
                    "entity_id": int(c["ENTITY_ID"]),
                    "kind": "comment",
                    "author_id": opt_int(c.get("AUTHOR_ID")),
                    "body": strip_bb(c.get("COMMENT") or ""),
                    "deadline": None,
                    "completed": False,
                    "pinned": False,
                    "created_at": iso(c["CREATED"]),
                    "files": [{"name": f.get("name") or f.get("NAME") or "plik", "url": f.get("urlDownload") or f.get("url") or ""} for f in (c.get("FILES") or {}).values()] if isinstance(c.get("FILES"), dict) else [],
                })
    owner_types = {"2": "deal", "4": "company", "3": "contact"}
    next_id = max((c["id"] for c in comments), default=0) + 100000
    for a in load("activities")["plain"]:
        entity = owner_types.get(str(a.get("OWNER_TYPE_ID")))
        if not entity:
            continue
        body = a.get("SUBJECT") or ""
        if a.get("DESCRIPTION"):
            body = f"{body}\n{strip_bb(a['DESCRIPTION'])}".strip()
        comments.append({
            "id": next_id,
            "entity_type": entity,
            "entity_id": int(a["OWNER_ID"]),
            "kind": "task",
            "author_id": opt_int(a.get("AUTHOR_ID")) or opt_int(a.get("RESPONSIBLE_ID")),
            "body": body,
            "deadline": iso(a.get("DEADLINE")),
            "completed": a.get("COMPLETED") == "Y",
            "pinned": False,
            "created_at": iso(a["CREATED"]),
            "files": [],
        })
        next_id += 1
    comments.sort(key=lambda c: c["created_at"])

    snapshot = {
        "stages": stages,
        "people": sorted(people.values(), key=lambda p: p["id"]),
        "companies": companies,
        "contacts": contacts,
        "products": products,
        "deals": deals,
        "deal_lines": deal_lines,
        "stage_history": stage_history,
        "comments": comments,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, ensure_ascii=False), encoding="utf-8")
    per_group = defaultdict(int)
    for p in products:
        per_group[p["group_name"]] += 1
    print(f"snapshot: {len(deals)} deals, {len(deal_lines)} lines, {len(companies)} companies, {len(contacts)} contacts, "
          f"{len(products)} products ({len(image_by_product)} with image, groups {dict(per_group)}), "
          f"{len(stage_history)} history rows, {len(comments)} timeline entries, {len(people)} people -> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
