# HAIZ Android · Native Experience 002

Built on Native 001 (PR #125, 2107). Same package `space.haiz.app.preview`, same signing certificate
(SHA-256 `fec8d396…c89d169`). This release: **1.7.0-native.002 (2108)**, installable from 2107 through
我 › 版本与更新 (data kept).

## What changed

| Area | What was done | Where |
| --- | --- | --- |
| Bottom nav | The dock's layer is only as tall as what it draws: 122 px at rest instead of 560 px, so the SVG contour, its drop shadow and the backdrop blur raster about 5× fewer pixels on every gesture frame and every scroll frame under it (it grows to full height only while a stage or search results are out). A tapped bay is selected at once (plate, lit mark, icon) on the dock's own frames, and the page is asked for a frame later. Routes now change inside a React transition, so a new page renders in slices instead of one blocking task. The lab-004 geometry, springs and icons are unchanged. | `web/src/ui/dock/engine.ts`, `web/src/app/router.ts` |
| Theme toggle | The wrong icon came from reading the theme from the DOM, which inside the view transition is applied a frame late. `isDark` now reads the store. The toggle is rebuilt after the Whitespace glass light toggle, in HAIZ code: left = dark with a pixel moon and cool blue light, right = light with a pixel sun and amber light. Dragging moves the knob, the light colour, the LED arc and the pixel morph live with the finger (rubber band past the ends); release springs home with the throw and commits the theme, which spreads from the knob. The knob is a rounded-square glass lens that stretches with speed, squashes on overshoot and squeezes under the finger. Each moon pixel is paired with a sun pixel by angle, with its own spring, delay, curl and lift. | `web/src/ui/ThemeToggle.tsx`, `themetoggle.css`, `app/store.ts` |
| Sidebar | The curtain is gone. Tapping 海 slides in the 005/006 rail: paper, the liquid datum on its edge, the optical drop with a glimpse of the destination. Adapted for touch: press a row and the drop rises beside it, scrub up or down and it follows, lift to go there; swipe left or tap outside to close; back closes it. The identity line (切换身份) and 检查更新 from the curtain were kept. | `web/src/ui/PhoneRail.tsx`, `ui/Rail.tsx`, `phonerail.css` |
| WeChat intake (收件) | Migrated PR #38's Android notification listener and queue (Kotlin → Java) into the Capacitor shell. Off by default. Intake needs four things: the switch turned on in HAIZ, at least one chosen group, the app enabled as a source (WeChat has its own switch), and Android notification access granted separately. The group is matched only on the notification's title fields, never on the body. Only task-like text is kept; everything else is dropped before anything is written. 查找我的群 lists group titles (titles only, no text) for 10 minutes. The share sheet (text → HAIZ) also feeds the inbox. | `android/…/HaizIntakeListener.java`, `HaizIntakeStore.java`, `HaizIntakePlugin.java`, `MainActivity.java` |
| Recognition | Notice Hub's analysis ported to TypeScript and run on the phone: word lists and scoring, urgent / action / academic / info, filters for questions, acknowledgements and chatter, dates (relative, weekday, month-day, ISO, month end, bare day only with a deadline), clocks and periods, time ranges, places, past-tense skip, and similar-text dedupe across groups (7 days). HAIZ Pocket's subjects and the `【HAIZ任务】` export line are included. WeChat's `[3条]发送人:` and `[有人@我]` are split off. 12 unit tests. | `web/src/intake/analyze.ts`, `tests/intake.test.mjs` |
| Inbox | A 收件 page shows each item's source app, group, sender, time, raw text, and what was read from it (kind, subject, due or time, place, confidence, reasons, other groups it also came from). From there: 加入待办, 加入日程, 修改 (title, subject, time, kind), 忽略 / 恢复, 删除. Items, group choices and settings belong to the current identity and live in its SQLite records; the group list is handed to the native filter when the identity becomes active. There is a paste box, which also works in a browser. A strip on 今日 shows the pending count, and the inbox is reachable from the sidebar and from 我. | `web/src/pages/Inbox.tsx`, `intake/inbox.ts`, `identity/*` |

Everything from 001 is kept (immersive mode, HAIZ keyboard, wall login, identities, perf panel, updater).
None of the Whitespace pack's code or assets are in the repository or the APK.

## Numbers (emulated)

Setup: Playwright Chromium on an emulated vivo S10 (393×873 at DPR 2.75), CPU throttled 4×, SwiftShader WebGL (3D frame rates say nothing about the real GPU).

**Dock taps** (`perf/dock-taps.mjs`): touch taps on the phone dock, 9 taps per run.

| | 001 (2107) | 002 (2108) |
| --- | --- | --- |
| Dock layer height | 560 px | 122 px |
| Taps every 600 ms: time until the tapped bay shows selected (median / max) | 134 / 261 ms | 44 / 151 ms |
| Taps every 600 ms: long tasks | 6 / 525 ms | 3 / 269 ms |
| Rapid taps every 150 ms: selected (median / max) | 89 / 137 ms | 37 / 62 ms |
| Rapid taps: long tasks | 2 / 108 ms | 0 |
| Rapid taps: dropped frames / worst frame | 30.1 % / 83 ms | 21.7 % / 67 ms |

**Full bench** (`perf/bench.mjs`; `results/native-002.json` against `native-001.json`):

| Scenario | 001 | 002 |
| --- | --- | --- |
| Tab switch | 6 long tasks, 528 ms, p95 33 ms, 17.7 % dropped | 3 long tasks, 259 ms, p95 17 ms, 12.7 % dropped |
| Today scroll, idle | 60 fps, 0 % dropped | 60 fps, 0 % dropped |
| Search open/close | 4 / 287 ms | 4 / 235 ms |
| Map taps | 3.6 fps | 10.5 fps |

Map scroll measured 40.8 → 15.5 fps in the full run. A targeted A/B rerun of the same scroll (`map.cjs`, both builds) gave 4.9 vs 5.0 fps, so that figure is noise from software WebGL, not a regression. Tree scenarios are bound by software GL in both builds.

## Needs the real phone

- Feel of the dock and the toggle at 90 Hz.
- Whether WeChat on the vivo S10 shows group messages in notifications. The phone's WeChat notification settings must show message previews; hidden previews or OEM background limits can stop capture.
- How WeChat formats a group notification title on this version.

To try intake: 收件 › 接收班群通知 › 去允许 (grant notification access) › choose groups (type the name or use 查找我的群) › have someone post a homework notice in that group.
