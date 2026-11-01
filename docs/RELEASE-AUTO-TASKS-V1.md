# HAIZ Pocket · Automatic Tasks V1 candidate (2026-10-30)

**Status:** integrated source branch, not certified for general release.

## Automated first, manual fallback
- **Android:** with user permission, HAIZ receives eligible *visible* notifications from selected WeChat/QQ/TIM/DingTalk/Xuexitong school groups. It filters locally and presents unverified candidates. It cannot read muted/hidden message contents or historical chats.
- **Both phones:** after HAIZ Academic server deployment, authorized student accounts show teacher-reviewed published class assignments. The app refreshes every 3 minutes while foregrounded and immediately on resume. No background system push yet.
- **iOS:** cannot listen to personal WeChat messages in the background. A native Share Extension stores user-invoked text/URL shares in the on-device App Group inbox. Copy/paste is backup, not the main class feed.
- **AI:** optional, consent gated, server-side free OpenRouter / Cloudflare / Ollama; untrusted source text never automatically becomes a published class assignment. Model evidence validation, student review and teacher approval remain required.

## Gates before public stable release
1. Full Flutter analysis and tests, academic server test suite and native builds must pass on **this exact integration commit**.
2. Real Android WeChat group notification permissions/format tests, privacy false-positive review, startup and account switching.
3. Actual iPhone build using authorized developer signing, matching App Group entitlements and Share Extension; test device lifecycle.
4. Deploy reliable HAIZ Academic HTTPS API with genuine credentials/approved class membership; GitHub Pages is static and cannot serve it.
5. Teacher -> published assignment -> multi-phone round-trip; data deletion, error recovery, battery impact and account isolation; no P0 data-loss defects.
6. No claim of official WeChat Tasks API integration or private iOS WeChat monitoring; no APNs/FCM closed-app push yet.

QA-signed Android CI APKs use disposable test keys; they are not official signed upgrades. The older v1.4 signed APK in `releases/android/` does **not** include these integrations. An official version needs the owner's signing key and successful field acceptance.

## Source provenance
- PR #38 Android opt-in WeChat notification listener.
- PR #41 iOS App Group Share Extension.
- PR #44 mobile class relay and review / foreground feed.
- PR #45 optional free-model routing.
- PR #25, #26 migrated-data and dialog lifecycle regression fixes.

This integration deliberately avoids touching HAIZ website runtime and does not merge unrelated Git ancestry.
