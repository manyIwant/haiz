#!/bin/zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
FLUTTER="$HOME/development/flutter/bin/flutter"
if [[ ! -x "$FLUTTER" ]]; then
  echo "未找到 Flutter SDK：$FLUTTER"
  exit 1
fi
cd "$ROOT/app"
"$FLUTTER" pub get --offline
"$FLUTTER" build web --release --no-pub
echo ""
echo "学生 App 预览：http://127.0.0.1:8766/"
echo "教师 Web 页面：http://127.0.0.1:8767/"
echo "按 Ctrl+C 同时关闭。"
python3 -m http.server 8766 --bind 127.0.0.1 --directory "$ROOT/app/build/web" &
APP_PID=$!
trap 'kill "$APP_PID" 2>/dev/null || true' EXIT INT TERM
python3 -m http.server 8767 --bind 127.0.0.1 --directory "$ROOT/web/teacher"
