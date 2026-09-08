"""Load public/snapshot.json and public/product_images/* into a Supabase project.

Secrets come from migrate/.secrets.json (git-ignored):
    {"url": "https://xxxx.supabase.co", "service_role": "...", "db_password": "...",
     "user_email": "slawek@browarpogorza.pl", "user_password": "..."}

Steps:
    python load_supabase.py --schema    # run supabase/schema.sql through the SQL endpoint (needs psycopg or the dashboard)
    python load_supabase.py --user      # create the single login
    python load_supabase.py --data      # truncate + insert every table, bump sequences
    python load_supabase.py --images    # upload product photos to the "products" bucket

Idempotent: --data wipes the tables first, --images upserts.
"""

from __future__ import annotations

import json
import mimetypes
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SECRETS = json.loads((ROOT / "migrate" / ".secrets.json").read_text(encoding="utf-8"))
URL = SECRETS["url"].rstrip("/")
KEY = SECRETS["service_role"]
SNAPSHOT = json.loads((ROOT / "public" / "snapshot.json").read_text(encoding="utf-8"))
IMAGES = ROOT / "public" / "product_images"

TABLE_ORDER = ["stages", "people", "companies", "contacts", "products", "deals", "deal_lines", "stage_history", "comments"]


def request(method: str, path: str, body: bytes | None = None, headers: dict | None = None) -> tuple[int, str]:
    req = urllib.request.Request(URL + path, data=body, method=method)
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("User-Agent", "browar-crm-migration/1.0")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode()


def rest(method: str, table: str, rows=None, query: str = "", prefer: str = "return=minimal") -> None:
    body = json.dumps(rows).encode() if rows is not None else None
    status, text = request(method, f"/rest/v1/{table}{query}", body, {"Content-Type": "application/json", "Prefer": prefer})
    if status >= 300:
        raise SystemExit(f"{method} {table} -> {status}: {text[:400]}")


def load_data() -> None:
    for table in reversed(TABLE_ORDER):
        rest("DELETE", table, query="?id=neq.-1" if table != "stages" else "?code=neq.-")
        print("cleared", table)
    for table in TABLE_ORDER:
        rows = SNAPSHOT[table]
        for i in range(0, len(rows), 500):
            rest("POST", table, rows[i : i + 500])
        print(f"loaded {table}: {len(rows)}")
    status, text = request("POST", "/rest/v1/rpc/bump_sequences", b"{}", {"Content-Type": "application/json"})
    if status >= 300:
        raise SystemExit(f"bump_sequences -> {status}: {text[:300]}")
    print("sequences bumped")


def load_images() -> None:
    for path in sorted(IMAGES.glob("*")):
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        status, text = request("POST", f"/storage/v1/object/products/{path.name}", path.read_bytes(), {"Content-Type": mime, "x-upsert": "true"})
        if status >= 300:
            raise SystemExit(f"upload {path.name} -> {status}: {text[:300]}")
        time.sleep(0.1)
    print(f"uploaded {len(list(IMAGES.glob('*')))} images")


def create_user() -> None:
    body = json.dumps({"email": SECRETS["user_email"], "password": SECRETS["user_password"], "email_confirm": True}).encode()
    status, text = request("POST", "/auth/v1/admin/users", body, {"Content-Type": "application/json"})
    if status >= 300 and "already" not in text:
        raise SystemExit(f"create user -> {status}: {text[:300]}")
    print("user ready:", SECRETS["user_email"])


def run_schema() -> None:
    """Runs schema.sql over a direct Postgres connection (psycopg). Falls back to printing instructions."""
    sql = (ROOT / "supabase" / "schema.sql").read_text(encoding="utf-8")
    try:
        import psycopg  # type: ignore
    except ImportError:
        print("psycopg missing: paste supabase/schema.sql into the Supabase SQL editor instead")
        return
    host = URL.replace("https://", "").split(".")[0]
    dsn = f"postgresql://postgres.{host}:{SECRETS['db_password']}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
    with psycopg.connect(dsn, autocommit=True) as conn:
        conn.execute(sql)
    print("schema applied")


if __name__ == "__main__":
    steps = {"--schema": run_schema, "--user": create_user, "--data": load_data, "--images": load_images}
    chosen = [a for a in sys.argv[1:] if a in steps] or list(steps)
    for step in chosen:
        steps[step]()
