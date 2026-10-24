# HAIZ · Cross-System Bridge, 2026-10-24

> Status: **integration candidate / NOT RELEASE READY**. This branch is based on `feat/haiz-lucent-integration` (PR #4), and copies the unchanged Fieldnotes 03 experimental tree from PR #8 before adding explicit connectors. It does not merge or modify `main`.

## What is actually connected

| From | To | Mechanism | Auth / Data truth |
|---|---|---|---|
| Campus main `world/index.html` | Fieldnotes `world/motion/` | Real link in campus landing page | Fieldnotes is a **design demo**, its sample task list is not real homework |
| Fieldnotes `world/motion/` | Existing private Study `world/index.html#study` | Explicit navigation (not copying storage) | Existing original study local data retained; prototype notes are separate |
| Fieldnotes `world/motion/` | Campus atlas `world/index.html#atlas` | Explicit navigation | Uses existing campus catalog; not a verified location service |
| Fieldnotes `world/motion/` | Flow `world/flow/` | Explicit navigation + unauthenticated/authorized **read-only probe** of `/api/flow/me` | Server remains the ONLY role/identity authority |
| Fieldnotes / Native LUCENT / Flow | Appearance | `haiz.lucent.preferences.v1`, separate view-specific setting adapter | ONLY theme; no identity, token, private note or role is transferred |
| Mobile WebView | Bundled Fieldnotes and Flow frontends | `prepare-web.mjs` + `verify-assets.mjs` | Does NOT package the Flow server or authenticate to any remote service |
| Authorized HTTPS host | Flow multi-session business workflow | Existing `world/pilot/server.mjs` and server-side `/api/flow/*` | Browser E2E already exists; not a publicly deployed school service |

Native/standalone mode must not send `/api/flow/*` requests to an assumed school server. An APK WebView's own `localhost` is not an office desktop; the new dialog explains this explicitly. Optional HTTPS URL opening requires the user to provide an authorized **origin**. No invitation token or password is placed in the URL; browser navigates to `/world/flow/` on the supplied origin.

**Do not mistake the prototype role switch for authentication.** The demo's `student/teacher` role toggle only changes visuals. Actual draft/publication permissions remain enforced by Flow backend. Prototype notes, simulated homework and notice drafts are NOT automatically uploaded or migrated. A manual download of the local prototype note is provided.

## What is still NOT connected

- Android/iOS **installed packages** have not been regenerated and installed from this SHA.
- iOS simulator test failure and Android API 33 failure on the earlier PR #4 are unresolved. Android API 35 had passed one emulator run, but this is not equivalent to both platforms passing.
- The previous QA shell syntax fix (PR #5) removed the `if/fi` syntax error; its next run still failed interactive startup verification. The real green/blank-screen root cause remains to be verified.
- School SSO, official timetable, teacher authorization, student class identity, hosted HTTPS pilot, and real private-data migration remain outside this design candidate.
- Windows/Seewo hardware and ClassIsland 2.x plugin are not verified; the Flow public-display Web UI is a separate browser surface, NOT evidence of plugin connectivity.
- A Flow service used on another physical device requires approved HTTPS hosting, a configured identity flow, and real network tests.
- The new Fieldnotes design is **not yet a redesign of all authenticated Flow views**. Flow uses the shared palette but retains its own trusted business UI.

## CI gates added

- `world/tests/cross-system-bridge.test.mjs`: route integrity, public appearance preference scope, demo-auth separation, and server asset exclusion.
- `.github/workflows/haiz-mobile-qa.yml`: checks runtime bridge syntax, source contracts, native bundle assets and existing platform tests.
- Native `verify-assets.mjs`: require Fieldnotes + Flow assets and verify editor-only Remotion files / Flow backend files are excluded.
- `prepare-web.mjs`: skip `remotion` editor directory while retaining the authored browser animation source.

## Manual cross-device acceptance plan (needs owner/authorized test devices)

1. On Mac browser, export original local Study records; visit `world/motion/`, switch Ocean, visit the authenticated `world/flow/` on the *same* authorized HTTPS origin. Confirm appearance and account permissions separately.
2. Use distinct browser sessions on Mac and Android 13 with separate short-lived invites to the same fictional teacher identity. Save one draft on phone, resume on Mac, check revision/conflict behavior. This needs actual HTTPS server deployment, not the current static `haiz.space` pages.
3. On a Windows device, sign in using a **display-only** identity. Confirm only published summary appears, and revoke one notice while online. Test expiry and reconnection. Do not start ClassIsland integration without authorized, version-matched host.
4. Install freshly built Android APK on vivo S10 (Android 13), preserving old user data via export. Test cold launch, offline launch, native back, dark palette, Fieldnotes link and real private Study; use logcat/screenshots on failure.
5. Build/install iOS simulator app from same exact commit, test cold/warm launch and WebKit link navigation; **actual signed iPhone installation** requires a signing method and device.
6. Cross-check commit SHA, `build-info.json`, bundle manifest, release artifacts and verification logs. Do not tag or publish if one mandatory test is missing.

## Evidence classifications

- **CONFIRMED SOURCE:** branch links, source files and separation described above are present in GitHub at review time.
- **STATIC TEST ADDED:** tests exist on this branch, but CI outcome must be checked independently.
- **PRIOR BROWSER TEST:** Flow/Pilot multi-session, conflicts, and public screen simulated scenarios; no physical network proof.
- **NOT TESTED:** physical Android/iPhone/Windows classroom interoperability from the latest commit.
- **BLOCKED:** school identity, production HTTPS service and authorized ClassIsland host.

Never call this `unified live data` until the last three conditions are satisfied.
