"""Supabase Management API steps that need the personal access token (migrate/.secrets.json: management_token).

    python sb_mgmt.py keys     # store project url + anon + service_role keys in .secrets.json (never printed)
    python sb_mgmt.py schema   # run supabase/schema.sql
    python sb_mgmt.py sql "select count(*) from deals"
"""

from __future__ import annotations

import json
import secrets
import string
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SECRETS_PATH = ROOT / "migrate" / ".secrets.json"
SECRETS = json.loads(SECRETS_PATH.read_text(encoding="utf-8-sig"))
REF = SECRETS.get("project_ref", "gdcwwszcgddhcevkbhko")
API = "https://api.supabase.com/v1"


def call(method: str, path: str, body: dict | None = None) -> tuple[int, object]:
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None, method=method)
    req.add_header("Authorization", f"Bearer {SECRETS['management_token']}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "browar-crm-migration/1.0")  # Cloudflare rejects the default urllib agent (error 1010)
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            text = resp.read().decode()
            return resp.status, (json.loads(text) if text else None)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode()[:500]


def save(**fields) -> None:
    SECRETS.update(fields)
    SECRETS_PATH.write_text(json.dumps(SECRETS, indent=1), encoding="utf-8")


def keys() -> None:
    status, data = call("GET", f"/projects/{REF}/api-keys?reveal=true")
    if status != 200:
        raise SystemExit(f"api-keys -> {status}: {data}")
    by_name = {k.get("name"): k.get("api_key") for k in data}
    anon = by_name.get("anon")
    service = by_name.get("service_role")
    if not anon or not service:
        raise SystemExit(f"keys missing, names present: {sorted(by_name)}")
    fields = {"project_ref": REF, "url": f"https://{REF}.supabase.co", "anon": anon, "service_role": service, "user_email": "slawek@browarpogorza.pl"}
    if not SECRETS.get("user_password"):
        alphabet = string.ascii_letters + string.digits
        fields["user_password"] = "".join(secrets.choice(alphabet) for _ in range(16))
    save(**fields)
    print("keys stored:", sorted(by_name))


def schema() -> None:
    sql = (ROOT / "supabase" / "schema.sql").read_text(encoding="utf-8")
    status, data = call("POST", f"/projects/{REF}/database/query", {"query": sql})
    if status >= 300:
        raise SystemExit(f"schema -> {status}: {data}")
    print("schema applied")


def sql(query: str) -> None:
    status, data = call("POST", f"/projects/{REF}/database/query", {"query": query})
    print(status, json.dumps(data, ensure_ascii=False)[:2000])


if __name__ == "__main__":
    step = sys.argv[1]
    if step == "keys":
        keys()
    elif step == "schema":
        schema()
    elif step == "sql":
        sql(sys.argv[2])
