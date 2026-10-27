#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG="v1.3.0-preview.1"
OUT="$ROOT/releases/$TAG"
APK="$ROOT/app/build/app/outputs/flutter-apk/app-release.apk"
PLUGIN="$ROOT/integrations/classisland/HAIZ.ClassroomPlugin/cipx/HAIZ.ClassroomPlugin.cipx"
SDK="$HOME/Library/Android/sdk/build-tools/36.0.0"
[[ -s "$APK" ]] || { echo "Android APK not built" >&2; exit 2; }
[[ -s "$PLUGIN" ]] || { echo "ClassIsland .cipx not built" >&2; exit 3; }
mkdir -p "$OUT"
cp "$APK" "$OUT/HAIZ-App-$TAG.apk"
cp "$PLUGIN" "$OUT/HAIZ-ClassIsland-$TAG.cipx"
cp "$ROOT/integrations/classisland/HAIZ.ClassroomPlugin/cipx/checksums.md" "$OUT/ClassIsland-SDK-checksums.md"
cp "$ROOT/docs/academic/RELEASE-V1.3.md" "$OUT/RELEASE_NOTES.md"
(
  cd "$ROOT"
  git archive --format=zip -o "$OUT/HAIZ-Source-$TAG.zip" HEAD
)
# Standalone HAIZ Academic Web + official bot adapter sources. Exclude deps and secrets.
(
  cd "$ROOT"
  zip -qr "$OUT/HAIZ-Academic-Web-$TAG.zip" services/academic integrations/qq-bot \
    -x '*/node_modules/*' '*/obj/*' '*/bin/*' '*/cipx/*' '*/.env' '*/*.sqlite' '*.log'
)
(
 cd "$OUT"
 shasum -a 256 ./*.apk ./*.cipx ./*.zip > SHA256SUMS.txt
 shasum -a 256 -c SHA256SUMS.txt
)
"$SDK/apksigner" verify --verbose --print-certs "$OUT/HAIZ-App-$TAG.apk" > "$OUT/APK_SIGNING_REPORT.txt"
"$SDK/aapt" dump badging "$OUT/HAIZ-App-$TAG.apk" | head -13 > "$OUT/APK_PACKAGE_INFO.txt"
echo "HAIZ Academic preview bundle ready:"
ls -lh "$OUT"
