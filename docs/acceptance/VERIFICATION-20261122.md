# 验证记录 · Verification log — 2026-11-22

Branch `claude/project-thread-1u9ob3`, based on `main` @ `b7ad45d`.
Environment: Claude Code cloud container, Linux x64, 4 CPU, Node 22.23.5, Playwright 1.62.1,
Chrome for Testing 153.0.8010.12 (pre-installed at `/opt/pw-browsers`), WebGL on SwiftShader. No GPU, no real device.

## 已执行 · Actually run

| What | Result |
|---|---|
| `node tests/acceptance/run.mjs --tier=all` | **29 passed · 1 failed · 1 not run**. The one failure was the self-test catching a weak fixture of mine: a 900 px strip does not overflow a 1024 px iPad. Widened to 1400 px; `--only=mobile-compat-selftest` re-run: passed. |
| core tier (27 suites, incl. `cinematic-runtime`, `walk-runtime`, `pocket`, `workflow-policy` + self-test) | 27/27 passed |
| `mobile-compat-chromium`: 22 pages × iPhone SE / iPhone 13 / Pixel 7 / iPad Mini landscape | **88/88 passed**, 101 warnings, 691 s |
| `mobile-compat-selftest` (4 deliberately broken pages × 4 devices) | every broken page caught |
| `rings-browser` | passed |
| `workflow_policy.py` on the 22 workflows on main | 22/22 pass, 10 warnings (missing `timeout-minutes` / `permissions`) |
| `workflow_policy.py` on `campus-audit.yml` from PR #87 | passes, no warnings |
| `node tests/cinematic-runtime.cjs` on unmodified `main` | **failed** (see fixes below); passes after the fix |
| `node --test backend/tests/*.test.mjs` on `main` | 64 passed, **3 failed** (see reported issues) |
| `node tests/home-browser.cjs` on `main`, twice | **timed out both times** in this container (see reported issues) |

Mobile warnings worth a design look (not failures): the shared top navigation on the journal pages
(`contact`, `about`, `director`, `admissions`, `alumni`, `clubs`, `journal`, `life`, `news`) has links
20–22 px tall, under the WCAG 2.2 24 px target; `architecture`, `campus-3d`, `darkroom`, `descent`,
`director` and `index` have some running text under 12 px on phones.

## 没有条件执行 · Not run here

- **WebKit leg** (`mobile-compat-webkit`): WebKit is not installed in this container. It runs in the `HAIZ PR acceptance` workflow on GitHub.
- **The new workflow itself** on GitHub Actions: it first runs on this PR.
- **Live check of the 年轮 fetch fix**: the container cannot reach `archive-api.open-meteo.com`. The fix follows the API's own error text from the failed run (“allowed range from 1940-01-01 to 2026-11-15” at 23:24 UTC on 15 Nov, while the script asked for 16 Nov). The next Monday cron, or a manual `workflow_dispatch`, will confirm it.
- Real iPhone / Android hardware, GPU frame rate, visual review: not possible here and not claimed.

## 修复 · Fixed (inside tests / CI scripts)

1. **`tests/cinematic-runtime.cjs` failed on main** (part of `npm test`). The VM sandbox had no `navigator`, so `descent.js` threw at `navigator.connection`, quietly fell back to the non-WebGL view, and the test failed on `renders>0`. The test now provides `navigator` (with `saveData` so no remote imagery is requested), fails loudly if the WebGL path falls back, and covers both the campus handshake and the 14 s preload-timeout path.
2. **`年轮 · add last week's days` weekly workflow failed** with HTTP 400. `scripts/rings/fetch-climate.mjs` asked for the Haikou calendar date as `end_date`; at the Monday 03:17 (UTC+8) cron that is already “tomorrow” for the archive. It now ends at UTC yesterday (ERA5 trails by about 5 days, so nothing is lost).

## CI on this PR (GitHub Actions, ubuntu-latest)

- `Core regression (no browser)` and `Mobile compatibility (webkit)` passed on the first push.
- `Mobile compatibility (chromium)` caught `physics-lab.html` failing on 2 of 4 devices with an `atob`
  error. The error came from the cross-origin Every Joule iframe (a third-party site), which loads
  only when the network is available. The check now blocks third-party hosts, so it covers this
  checkout only and gives the same result online and offline.
- **Six-act home suite (`rings-qa.yml` → `tests/home-browser.cjs`), the red check on #84, #88 and #89.**
  It failed at a different step on almost every run. Each step was traced (timeline/diagnostic
  output was added to the test) and fixed in `tests/` only:
  1. *End key never reached 06.* Reproduced locally: `scrollY` stayed frozen for 140 s. Chrome animates
     keyboard scrolling frame by frame. At SwiftShader's multi-second frames, ScrollTrigger's snap
     (0.1 s delay) treats every pause as the end of the scroll and snaps back to 05. Launching with
     `--disable-smooth-scrolling` makes End land on 06 at once. The page's own snapping is unchanged.
  2. *Leaf catch at 06.* The test released the leaf 6 m in front of the camera. At 06 the litter's
     ground heightfield reads 25.6 m at the camera and 13.6 m at that point, so the leaf "landed" on
     its first frame (falling 0, settled 1, on CI and locally). The test now releases the leaf at the
     first point along the view that is above that surface, holds it still, and waits for the camera
     to arrive first.
  3. *Keeping the leaf.* `#specKeep` never passed Playwright's "stable" check (the dialog's open
     animation over a blurred WebGL backdrop). The test now clicks the visible, modal button with
     `force` and waits for the book count.
  4. *Exit to news.html.* On CI the click returns at 68 s and `location.href` fires at about 150 s,
     past the old 120 s limit. Nothing was stuck. The test now waits up to 300 s for the navigation
     to commit. Locally it took 38 s.
  5. The orbit-dot click got the suite's 90 s click budget (it took 40 s locally against a 30 s default).
  **The whole suite passes in this 4-CPU cloud container** (`PASS home-browser`, all 8 steps), which it
  never did before. PRs #84, #88 and #90 need this file, either by merging #89 first or by taking
  `tests/home-browser.cjs` from it.

## 报告给负责人 · Reported, not changed (outside this scope)

1. **Descent play button waits for the campus.** `assets/cinematic/descent.js` says the campus “never gates the play button”, but `boot()` awaits the campus handshake or a 14 s timeout before enabling play. On a slow phone the opening can sit disabled for up to 14 s. The test now pins today's behaviour on both paths; whoever owns the descent should decide which is intended.
2. **3 backend tests fail on main**: they request `/world/flow/`, which only exists on unmerged branches (e.g. `feat/haiz-campus-operations`). `haiz-backend.yml` runs only when backend files change, so this stays hidden until then.
3. **Possible low-frame-rate product issue (for the homepage owner):** at a few frames per second, ScrollTrigger's 0.1 s snap delay can undo keyboard scrolling (End / PageDown), as item 1 above shows. It is unlikely on normal devices, but a very slow phone could hit it.
