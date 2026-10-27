# HAIZ v1.1 · iOS-inspired interaction refinement

Date: 2026-10-27. This is a visual refinement of the local HAIZ v1 prototype, not a native UIKit port.

## Delivered

- Flutter: five-tab floating glass dock with Cupertino-style icons, optical blur, subtle bright border and low-amplitude shadow.
- Dock selection indicator driven by Flutter SpringSimulation; mid-flight retargeting preserves momentum without blocking content.
- Touchable cards respond with gentle 0.982 scale only when interactive; no arbitrary looping animation.
- Cupertino-style primary pill buttons, coordinated slider/chip/input theme and system Apple typography on iOS/macOS.
- Porcelain / Obsidian / Ocean color harmonization and quieter Study Relay primary card.
- Teacher Web: separate ios_skin.css for frosted header, rounded grouped controls and consistent surfaces.
- Physics ticker lab: 390px mobile overflow in the v-t results row fixed using Wrap.
- Accessibility: reduced-motion path for dock, and semantically labeled tabs. Haptic click only on iOS.

## Validation

- Flutter analyze: 0 findings.
- Flutter test: 17 passing including mobile Inbox and physics lab widget cases.
- Flutter build web --release: success.
- Teacher Web 390px headless Chromium screenshot: saved to docs/qa-ios-teacher-mobile.png; no reported JS console errors.
- Flutter Web app mobile headless screenshot: Chromium software/WebGL renderer timeout, cannot claim final visual QA from screenshot.
- Extra Flutter screenshot test was attempted but the test renderer hung; stopped and not included in codebase.
- Android APK, iOS IPA and real iPhone haptic behavior: not tested here.

## How to compare

Run bash start.command from the HAIZ-v1 project root and open:
- Student Flutter preview: http://127.0.0.1:8766/
- Teacher Web: http://127.0.0.1:8767/

Original core presentation files before this revision were moved to ios-refinement-backups/original-v1/ (excluded from Git). Git history also permits reverting to the v1 commit.

## Scope intentionally unchanged

No new school APIs, messaging platform credentials, cloud sync or teaching business logic. Neither haiz.space production nor the upstream reference projects were modified.
