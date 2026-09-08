"""GIT_ASKPASS helper: answers git's credential prompts from migrate/.secrets.json, so no token appears on a command line."""
import json
import sys
from pathlib import Path

secrets = json.loads((Path(__file__).resolve().parent / ".secrets.json").read_text(encoding="utf-8-sig"))
prompt = " ".join(sys.argv[1:]).lower()
print(secrets["github_user"] if "username" in prompt else secrets["github_token"])
