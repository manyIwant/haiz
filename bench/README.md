# bench/ — homepage rendering benchmark

A repeatable measurement of the homepage's three.js renderer (`index.html` →
`lanren/js/scene.js`, `home.js`, `foliage.js`) on an emulated phone, plus a
before/after image comparison so an optimisation can be shown not to change
the picture.

```sh
# measure the working tree (tiers low and medium, phone 390×844 @3x, CPU 4× throttled)
node bench/home-bench.cjs --label optimized

# measure another checkout with the same harness (e.g. main, as a baseline)
git worktree add ../haiz-base origin/main
node bench/home-bench.cjs --site ../haiz-base --label baseline

# deterministic stills of the six chapters (fresh page each, virtual clock), then compare
node bench/stills.cjs --site ../haiz-base --label baseline
node bench/stills.cjs --label optimized
node bench/compare.cjs bench/results/baseline bench/results/optimized

# interleaved A/B render timing of two checkouts (beats SwiftShader's run-to-run noise)
node bench/ab.cjs --a ../haiz-base --b . --quality low

# lifecycle regression for the reused environment (PMREM) target: exits 1 on failure
node bench/env-stability.cjs
```

On a **real phone**, paste `bench/device-probe.js` into the remote devtools
console of the open homepage (Safari Web Inspector / `chrome://inspect`): it
walks the six chapters twice with the page's own loop and prints frame-interval
P50 / P95, long frames, pixel ratio, draw calls and heap per chapter, plus the
second round's change (a thermal-throttling hint).

Options: `--quality low,medium,high`, `--dpr 3`, `--cpu 4` (CDP CPU throttle
for the page's main thread), `--frames 8` (measured frames per chapter),
`--scroll 40` (frames in the continuous 0 → 5 walk), `--site DIR`,
`--out DIR`. Needs only the Playwright that the repository's browser tests
already use; no install step.

## What one run records (`bench/results/<label>/report.json`)

| section | meaning |
|---|---|
| `load` | time from navigation to `body.ready`, requests and encoded bytes before it |
| `chapters[i]` | for each of the six viewpoints: frame time (one `step()` = simulation + render, closed by a 1-pixel `readPixels` so GPU work is inside the number), draw calls and triangles over all passes, enabled post passes, shader programs |
| `chapters[i].breakdownMs` | one extra frame with the shadow map and every composer pass timed separately behind GPU syncs: where the frame goes |
| `scroll` | the reader scrolling from the opening to the walk (p moves 0 → 5 across N frames): frame times and how many image-based-light (PMREM) bakes it caused |
| `jsStep` | main-thread time of a step with drawing switched off, under the CPU throttle: the simulation's share |
| `memory` | `renderer.info.memory`, programs, pixel ratio, drawing-buffer size, composer and shadow render targets, JS heap |
| `shots` | added by `stills.cjs`: one still per chapter, each in a fresh page |

## Determinism

`stills.cjs` opens a fresh page per still with `?capture=1` (the page loop
starts paused), replaces `Math.random` with a seeded generator, fixes the date,
and swaps `performance.now` for a virtual clock that only advances with the
fixed steps (the camera's breathing reads it). Two runs of the same code are
identical or within ≥ 60 dB PSNR (≤ 0.06 % of pixels off by more than 2
levels), which is the noise floor for `compare.cjs`.

## Limits — read before quoting a number

* **This is SwiftShader, not a phone GPU.** Chromium in CI renders WebGL on the
  CPU. Milliseconds here are a repeatable *proxy*: they rank work (vertex
  count, overdraw, full-screen passes) roughly the way a mobile GPU would, but
  the ratios differ. SwiftShader is relatively slow at vertex and
  rasterisation work and relatively fast at a full-screen pass, so it
  *understates* what removing a full-screen pass saves on a fill-rate-bound
  phone and may overstate geometry savings. Use deltas between runs on the same
  machine, never the absolute values, and never call them FPS.
* CPU throttling (CDP) slows the page's main thread only; it does not slow the
  GPU process where SwiftShader runs.
* `?test=1` is used so that every act loads eagerly and is measurable; a real
  fresh phone visit defers the campus modules until after the first frame.
* Real-device verification (an actual iPhone / Android over remote debugging)
  is not part of this harness and has not been done by it.
