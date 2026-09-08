"""Build the web bundle for the Android wrapper (base '/', Supabase keys from .secrets.json) into dist-app/."""
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
S = json.loads((ROOT / "migrate" / ".secrets.json").read_text(encoding="utf-8"))
env = {**os.environ, "VITE_BASE": "/", "VITE_SUPABASE_URL": S["url"], "VITE_SUPABASE_ANON_KEY": S["anon"]}
subprocess.run(["npx", "vite", "build", "--outDir", "dist-app", "--emptyOutDir"], cwd=ROOT, env=env, check=True, shell=True)
print("dist-app ready")
