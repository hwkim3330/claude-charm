#!/usr/bin/env bash
# Publish this page as a static Hugging Face Space (kimhyunwoo/claude-charm).
# Needs a *write* token: `hf auth login` first, or HF_TOKEN=hf_... tools/deploy-hf.sh
set -euo pipefail
cd "$(dirname "$0")/.."
SPACE="${SPACE:-kimhyunwoo/claude-charm}"
python3 - "$SPACE" <<'PY'
import sys
from huggingface_hub import HfApi
space = sys.argv[1]
api = HfApi()
api.create_repo(space, repo_type="space", space_sdk="static", exist_ok=True)
api.upload_folder(folder_path=".", repo_id=space, repo_type="space",
                  allow_patterns=["index.html", "app.js", "charm-scene.js", "style.css", "manifest.webmanifest",
                                  "*.png", "README.md", "LICENSE", "vendor/**"],
                  commit_message="Deploy Claude Charm")
print(f"https://huggingface.co/spaces/{space}")
PY
