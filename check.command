#!/bin/zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
FLUTTER="$HOME/development/flutter/bin/flutter"
cd "$ROOT/app"
"$FLUTTER" pub get --offline
"$FLUTTER" analyze --no-pub
"$FLUTTER" test --no-pub --reporter expanded
"$FLUTTER" build web --release --no-pub
echo "HAIZ v1 checks finished successfully."
