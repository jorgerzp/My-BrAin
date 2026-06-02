#!/usr/bin/env bash
# Sube main a https://github.com/JorgeRSonora/My_BrAIn_v2.git usando un PAT en GITHUB_TOKEN.
# Uso (en tu terminal, una vez):  GITHUB_TOKEN=ghp_xxxx ./scripts/push-github-https.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Define GITHUB_TOKEN con un Personal Access Token (classic: scope repo, o fine-grained: contenido del repo)." >&2
  echo "Ejemplo: GITHUB_TOKEN=ghp_xxx ./scripts/push-github-https.sh" >&2
  exit 1
fi

REMOTE_CLEAN="https://github.com/JorgeRSonora/My_BrAIn_v2.git"
REMOTE_AUTH="https://oauth2:${GITHUB_TOKEN}@github.com/JorgeRSonora/My_BrAIn_v2.git"

git remote set-url origin "$REMOTE_AUTH"
git push -u origin main
git remote set-url origin "$REMOTE_CLEAN"
echo "Listo. Remoto dejado sin token en la URL."
