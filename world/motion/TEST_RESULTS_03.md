# Fieldnotes 03 — verification

## What ran

- Chromium mobile interactive smoke test (390×844): 19 checks passed; no page JavaScript errors.
- Viewport test: 320×720, 375×812, 390×844, 430×932, 768×1024 and 1440×900. No horizontal overflow in tested widths; dock remained available.
- Reduced-motion browser emulation: direct navigation from homepage to study screen, no cinematic blocking.
- The original kinetic logo prototype remains isolated in `archive/identity-01.html`.

## Meaningful checks

- Open the task-first home screen; toggle a demo task; continue into the study desk.
- Day/rain/night visual state changes.
- Switch timer duration; start and pause.
- Save study note in localStorage.
- Switch campus tab/category.
- Switch Obsidian theme; navigate via search results.
- Switch to the teacher workspace; retain a draft notice across tabs; preview without publishing.

## Known limitations

- `page.set_content` used for tests because headless environment blocked localhost. Accordingly the existing repository photograph (`../../assets/images/campus/campus_fengqitang.jpg`) and nested iframe brand clip **were not tested for loading** in this run. The design provides a gradient fallback.
- The tester is Chromium, not a real Android WebView or iOS WKWebView.
- No login/roles, real timetable, teacher announcement publishing, ClassIsland bridge, HAIZ SCAN hardware or native packaging is implemented in this design-only experiment.
- Current APK/IPA startup failures are not fixed by this prototype; startup QA and device testing remain separate, with PR #3 and PR #5.
- Existing images in the source repository are not redistributed in standalone ZIP pending rights/attribution review.

## Status

**Design prototype verified in headless Chromium only. NOT RELEASE-READY.**
