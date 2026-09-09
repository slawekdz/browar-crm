"""Publish Downloads/browar-crm.apk as a GitHub release asset so the phone can download it by link."""
import json
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
S = json.loads((ROOT / "migrate" / ".secrets.json").read_text(encoding="utf-8-sig"))
OWNER, REPO = S["github_user"], "browar-crm"
APK = Path.home() / "Downloads" / "browar-crm.apk"
TAG = sys.argv[1] if len(sys.argv) > 1 else f"apk-{date.today().isoformat()}"


def api(method, url, body=None, content_type="application/json"):
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", f"Bearer {S['github_token']}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "browar-crm-setup")
    req.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode()[:300]


status, rel = api("GET", f"https://api.github.com/repos/{OWNER}/{REPO}/releases/tags/{TAG}")
if status != 200:
    status, rel = api("POST", f"https://api.github.com/repos/{OWNER}/{REPO}/releases", json.dumps({"tag_name": TAG, "name": f"Browar Pogórza CRM Android {TAG}", "body": "Signed release APK. Install: open on the phone, allow installs from this source.", "target_commitish": "main"}).encode())
    if status >= 300:
        raise SystemExit(f"release -> {status}: {rel}")
for asset in rel.get("assets", []):
    if asset["name"] == APK.name:
        api("DELETE", asset["url"])
upload = rel["upload_url"].split("{")[0] + f"?name={APK.name}"
status, asset = api("POST", upload, APK.read_bytes(), "application/vnd.android.package-archive")
if status >= 300:
    raise SystemExit(f"upload -> {status}: {asset}")
print(asset["browser_download_url"])
