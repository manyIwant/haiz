#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="v1.2.0-preview.1"
ARTIFACT="$ROOT/app/build/app/outputs/flutter-apk/app-release.apk"
OUTPUT="$ROOT/releases/$VERSION"
TOOLS="$HOME/Library/Android/sdk/build-tools/36.0.0"
if [[ ! -s "$ARTIFACT" ]]; then
  echo "APK does not exist: build must succeed before packaging."
  exit 2
fi
mkdir -p "$OUTPUT"
cp "$ARTIFACT" "$OUTPUT/HAIZ-App-$VERSION.apk"
(cd "$ROOT" && git archive --format=zip -o "$OUTPUT/HAIZ-Source-$VERSION.zip" HEAD)
(cd "$ROOT/web" && zip -q -r "$OUTPUT/HAIZ-Teacher-Web-$VERSION.zip" teacher)
cp "$ROOT/docs/HAIZ-V1.2-RELEASE-NOTES.md" "$OUTPUT/RELEASE_NOTES.md"
(cd "$OUTPUT" && shasum -a 256 ./*.apk ./*.zip > SHA256SUMS.txt)
"$TOOLS/apksigner" verify --verbose --print-certs "$OUTPUT/HAIZ-App-$VERSION.apk" > "$OUTPUT/APK_SIGNING_REPORT.txt"
"$TOOLS/aapt" dump badging "$OUTPUT/HAIZ-App-$VERSION.apk" | head -16 > "$OUTPUT/APK_PACKAGE_INFO.txt"
echo "Release files:"
ls -lh "$OUTPUT"
echo "Signing verified."
