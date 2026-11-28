# HAIZ Android · Native Experience 001

Built on the Experiment 006 APK (PR #124, versionCode 2106). Same package `space.haiz.app.preview`,
same signing certificate (SHA-256 `fec8d396…c89d169`). This release: **1.6.0-native.001 (2107)**.

## What is in it

| Area | What was done | Where |
| --- | --- | --- |
| Performance | Render-pass cache (scene and normal/depth passes redraw only when the camera, the scene or a highlight changes; reveal, loupe and develop waves are composite-only), PBR pass skipped in pure line mode, one pooled WebGL renderer shared by the tree and the map, programs compiled with `compileAsync` before the first frame, scene builds cached across visits, Dock engine skips frames whose inputs did not change, sheets and inspector skip work once settled, controls no longer force a layout on every render or frame. Nothing visual was removed: pixel diffs of tree (line, clay, real, lens) and map against 006 are within 5–6/255. | `web/src/three/homologous.ts`, `three/terminalia.ts`, `three/campus.ts`, `ui/dock/engine.ts`, `ui/Detail.tsx`, `ui/controls.tsx` |
| Perf panel | Off by default (我 › 性能面板). FPS, p50/p95 frame time, worst frame, dropped frames, long tasks, renderer pass counts, JS heap; on Android also refresh rate, PSS, free memory, thermal status. 导出报告 saves JSON via the system picker. | `web/src/ui/PerfPanel.tsx` |
| Immersive | Edge-to-edge, status and navigation bars hidden, swipe from an edge shows them transiently, cut-out mode, highest refresh-rate display mode, insets (cut-out, gesture strip, IME) pushed to CSS `--safe-*`/`--ime`, bars re-hidden on resume and focus, back goes to the topmost overlay first. | `android/…/MainActivity.java`, `web/src/platform/native.ts` |
| HAIZ keyboard | Liquid-glass keyboard: pinyin through librime (luna_pinyin) compiled to WASM, running in a Web Worker with coalesced lookups; English with shift/caps, 123 and #+= with Chinese or Western punctuation; candidate row and expanded grid; hold ⌫ to repeat, then by words; drag on the space bar moves the caret; ◀ ▶ ⇤ ⇥ 全选; dot-ripple key feedback; voice key; 系统 hands over to the phone's IME (long-press 中/英 opens the system picker), and a chip over the system IME switches back. | `web/src/keyboard/` |
| Voice | Liquid-glass recorder capsule; Android SpeechRecognizer with streaming partials and level, falls back to the system voice screen. | `keyboard/Recorder.tsx`, `HaizVoicePlugin.java` |
| Wall-light login | The earlier lamp-auth behaviour (lamp warms while typing, flickers on error, floods on success) on a computed brick wall: height-field normals, pendant lamps as damped pendulums you can grab and throw, the name set into the wall in dots. First launch only; a returning identity opens straight into the app. | `web/src/login/` |
| Identities | Local SQLite (native plugin on Android, sql.js + IndexedDB in a browser). Each identity has its own school, name, class, number, role, lamp colour and records (week, tasks, notes, events, growth, notices, favourites, prefs, teacher). Create, edit, switch on the lamp wall, restore last, export/import JSON backup, delete. The app is keyed by identity, so nothing leaks between them. | `web/src/identity/`, `HaizStorePlugin.java` |
| Updater | Manifest `haiz-update.json` attached to every GitHub Release (`releases/latest/download/…`), manual and automatic (every 6 h) checks, version, notes and size, resumable download with progress, pause/resume, retries with backoff, SHA-256 and size check, same-package/newer-versionCode/same-certificate check, system installer via FileProvider. | `web/src/update/`, `HaizUpdaterPlugin.java` |
| Release | CI builds, signs with the original key from repository secrets, checks the certificate fingerprint, and on a `haiz-native-v*` tag publishes the APK, `haiz-update.json` and `SHA256SUMS.txt` as the latest release. Refuses to publish a versionCode that is not newer. | `.github/workflows/haiz-native-android.yml`, `native/release.json` |

Whitespace studies, reimplemented in HAIZ's own code (none of the pack's code or assets are in the repo or APK, per its no-redistribution terms):
glass-light-toggle → `ui/ThemeToggle.tsx` (theme switch, spreads with 006's view transition); pendant-lamp → wall login; dot-form → `ui/DotField.tsx` and the keyboard's dot edge;
liquid-tags → `ui/LiquidTags.tsx` (update steps); action-wheel → `ui/ActionWheel.tsx` (long-press anywhere, task actions on tasks); curtain-sidebar → `ui/Curtain.tsx` (tap 海);
viewport-transition + lathe-blueprint → 平面 ⇄ 立体 on the campus map; liquid-glass-recorder → voice capsule.

## Numbers (emulated)

Playwright Chromium, SwiftShader WebGL, vivo S10 viewport 393×873 at DPR 2.75, CPU throttled 4×. Software WebGL makes every 3D scene pass ~1–2 s, so 3D frame rates here say nothing about the phone's GPU; they show relative work only.

| Scenario | 006 baseline | Native 001 |
| --- | --- | --- |
| Today scroll | 60 fps, 0 % dropped | 60 fps, 0 % dropped |
| Tab switch (cold) | 3 long tasks, 273 ms | 4 long tasks, 313 ms (targeted rerun after the controls fix; full run before it: 6 / 528 ms) |
| Idle 2 s | 8 ms script | 13 ms script (clock sleeps) |
| Tree intro | 0.8 fps, p50 1800 ms | 8.9 fps, p50 50 ms |
| Tree ready | 4.5 s | 3.3 s |
| Map taps | 1.9 fps, p50 550 ms | 3.6 fps, p50 233 ms |
| Map scroll | 83.9 % dropped | 32.3 % dropped |
| Tree orbit / month scrub | bound by software scene passes in both | same |
| Pinyin key → candidates | — | 1–22 ms per key (unthrottled, in-page) |

Full results: `native/perf/results/{baseline-006,native-pass1,native-001}.json`.

## Needs the real phone (vivo S10, Android 13)

Frame rate at 90/120 Hz, frame times in the tree and map, heat after 10 minutes, PSS memory, and the RIME first-load time all need the device. Turn on 我 › 性能面板, use the app, and tap 导出报告; the JSON can be compared with the files above. Voice input depends on whether the phone exposes a speech service to apps.

## Installing

2106 (the 006 preview) has no updater, so install 2107 by hand once over it (same signature, data kept). From 2107 on, 我 › 版本与更新 does it in place.
