#!/usr/bin/env bash
# Opt-in publishing only. Never invoked automatically.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG="v1.3.0-preview.1"
BRANCH="preview/haiz-academic-v1.3"
OUT="$ROOT/releases/$TAG"
REPO="manyIwant/haiz"
cd "$ROOT"
if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Please run: gh auth login" >&2
  exit 2
fi
[[ -s "$OUT/HAIZ-App-$TAG.apk" ]] || { echo "APK not packaged" >&2; exit 3; }
[[ -s "$OUT/HAIZ-ClassIsland-$TAG.cipx" ]] || { echo "ClassIsland plugin not packaged" >&2; exit 3; }
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Uncommitted tracked changes: review and commit before publishing." >&2
  exit 4
fi
(
 cd "$OUT"
 shasum -a 256 -c SHA256SUMS.txt
)
gh auth setup-git
git remote get-url haiz-public >/dev/null 2>&1 || git remote add haiz-public "https://github.com/$REPO.git"
git push haiz-public "HEAD:refs/heads/$BRANCH"
if ! git show-ref --verify --quiet "refs/tags/$TAG"; then
  git tag -a "$TAG" -m "HAIZ Academic $TAG — independent preview"
fi
[[ "$(git rev-parse "$TAG^{commit}")" == "$(git rev-parse HEAD)" ]] || {
  echo "Existing release tag points to a different commit. Refusing." >&2
  exit 5
}
git push haiz-public "refs/tags/$TAG"
gh release create "$TAG" --repo "$REPO" --verify-tag --prerelease \
  --title "HAIZ Academic $TAG — Student, Teacher, ClassIsland" \
  --notes-file "$OUT/RELEASE_NOTES.md" \
  "$OUT/HAIZ-App-$TAG.apk" \
  "$OUT/HAIZ-Source-$TAG.zip" \
  "$OUT/HAIZ-Academic-Web-$TAG.zip" \
  "$OUT/HAIZ-ClassIsland-$TAG.cipx" \
  "$OUT/SHA256SUMS.txt"
echo "Released publicly as a preview. The haiz main branch is unchanged."
