"""Push the repo and switch GitHub Pages to the Actions workflow. Token in migrate/.secrets.json (github_token)."""

from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
S = json.loads((ROOT / "migrate" / ".secrets.json").read_text(encoding="utf-8-sig"))
OWNER, REPO = S["github_user"], "browar-crm"


def api(method: str, path: str, body: dict | None = None) -> tuple[int, str]:
    req = urllib.request.Request("https://api.github.com" + path, data=json.dumps(body).encode() if body else None, method=method)
    req.add_header("Authorization", f"Bearer {S['github_token']}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "browar-crm-setup")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode()


def push() -> None:
    url = f"https://{OWNER}:{S['github_token']}@github.com/{OWNER}/{REPO}.git"
    result = subprocess.run(["git", "push", "-u", url, "main"], cwd=ROOT, capture_output=True, text=True)
    print("push exit", result.returncode, (result.stderr or result.stdout).replace(S["github_token"], "***")[-400:])


def pages() -> None:
    status, text = api("POST", f"/repos/{OWNER}/{REPO}/pages", {"build_type": "workflow"})
    if status == 409:
        status, text = api("PUT", f"/repos/{OWNER}/{REPO}/pages", {"build_type": "workflow"})
    print("pages", status, text[:200])


def status() -> None:
    code, text = api("GET", f"/repos/{OWNER}/{REPO}/actions/runs?per_page=3")
    runs = json.loads(text).get("workflow_runs", []) if code == 200 else []
    for r in runs:
        print(r["name"], r["status"], r["conclusion"], r["html_url"])
    code, text = api("GET", f"/repos/{OWNER}/{REPO}/pages")
    print("pages:", code, json.loads(text).get("html_url") if code == 200 else text[:200])


def dispatch() -> None:
    code, text = api("POST", f"/repos/{OWNER}/{REPO}/actions/workflows/deploy.yml/dispatches", {"ref": "main"})
    print("dispatch", code, text[:200])


if __name__ == "__main__":
    {"push": push, "pages": pages, "status": status, "dispatch": dispatch}[sys.argv[1]]()
