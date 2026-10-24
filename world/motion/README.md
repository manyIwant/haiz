# HAIZ · FIELDNOTES 03

This is the third **isolated interaction prototype** for HAIZ, not a replacement for the production HAIZ Study APK/IPA. It continues Editorial 02 while keeping the original animated brand study at `archive/identity-01.html`.

## Design changes

- **Editorial, not illustrative**: the hero is a document-like continuation card; massive decorative SVG shapes and unnecessary slogans were removed.
- **Useful by default**: homepage shows a sample recent study item, three checkable demo tasks and two common entry points. No fictitious live timetable or grading claims.
- **Work surface continuity**: where supported, the home continuation card becomes the study desk with `document.startViewTransition` and a shared named surface. Unsupported/reduced-motion environments switch immediately.
- **Study light field**: day/rain/night visual treatments, 15/25/45-minute timer, local-only notes and focus progress. Audio is not autoplayed, and background tab entry pauses the prototype timer.
- **Floating dock**: a single shared spring lens with velocity-based optical stretch, drag navigation, compact scroll behavior and separate search ball.
- **Student + teacher**: distinct workspace content and navigation. Teacher notice draft is stored locally and can be previewed, but **cannot publish to real users**.
- **Three persistent themes**: Porcelain, Obsidian and Ocean. No network or school API connection required for the core interactive demo.

## View and run

Open `index.html` in a browser. To see an existing repository campus photograph rather than the graceful gradient fallback, place this prototype in `world/motion/index.html` within the HAIZ repository: its campus panel references `../../assets/images/campus/campus_fengqitang.jpg` from the existing site. The repository image is not duplicated into this standalone ZIP; its original source, rights and attribution require review before public redistribution.

At the top, use the play icon to watch the **opt-in** older vector-identity demo. It is intentionally not played every time the app starts.

## Verification

- Chromium mobile interaction smoke script: `python test_ui.py`. 19 passing checks, no page JS errors (test outputs: `qa.json`).
- Responsive widths 320/375/390/430/768/1440: no horizontal overflow; reduced motion navigation checked (`test_responsive.py`, `qa-responsive.json`).
- Browser security policy in some hosted preview environments blocks `http://localhost` browsing; tests use `page.set_content` and **do not prove** external assets, nested iframe film playback or native WebView loading.
- Real Android/iOS startup, CPU/GPU, performance, branding assets, camera permissions and signed release **remain unverified** and must be completed independently. Changing `#152b20` splash background alone is not a fix.

## Version/relationship

Prototype 03 builds on `feat/haiz-editorial-refinement-02`, and should remain a Draft PR until reconciled with the Android/iOS startup fixes and real business modules. It does not change student production data, role access control or live ClassIsland services.