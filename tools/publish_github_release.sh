#!/usr/bin/env bash
# Explicit, auditable GitHub release publishing. Run only after gh auth login.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPOSITORY="manyIwant/haiz"
TAG="v1.2.0-preview.1"
BRANCH="preview/haiz-app-v1.2"
OUT="$ROOT/releases/$TAG"

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub is not authenticated on this Mac."
  echo "Run: gh auth login"
  echo "Then rerun this script."
  exit 2
fi

if [[ ! -s "$OUT/HAIZ-App-$TAG.apk" ]]; then
  echo "Signed preview APK is missing. Build and package first."
  exit 3
fi
if [[ ! -s "$OUT/SHA256SUMS.txt" ]]; then
  echo "Release checksums missing."
  exit 4
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Tracked source has uncommitted changes. Commit/review them before publishing."
  exit 5
fi

gh auth setup-git

git remote get-url haiz-public >/dev/null 2>&1 || \
  git remote add haiz-public "https://github.com/$REPOSITORY.git"

# Publish an isolated branch, NOT the website's main branch.
git push haiz-public "HEAD:refs/heads/$BRANCH"
if ! git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  git tag -a "$TAG" -m "HAIZ App $TAG"
fi
if [[ "$(git rev-list -n 1 "$TAG")" != "$(git rev-parse HEAD)" ]]; then
  echo "The release tag points to another commit. Review before continuing."
  exit 6
fi
git push haiz-public "refs/tags/$TAG"

gh release create "$TAG" \
  --repo "$REPOSITORY" \
  --verify-tag \
  --prerelease \
  --title "HAIZ App $TAG — Student + Teacher Tools" \
  --notes-file "$OUT/RELEASE_NOTES.md" \
  "$OUT/HAIZ-App-$TAG.apk" \
  "$OUT/HAIZ-Source-$TAG.zip" \
  "$OUT/HAIZ-Teacher-Web-$TAG.zip" \
  "$OUT/SHA256SUMS.txt"

echo "Published as a GitHub pre-release. Main branch and site not touched."
