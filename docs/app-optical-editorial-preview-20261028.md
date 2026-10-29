# HAIZ Pocket — editorial UI and optical glass preview

Branch: `feat/app-editorial-parity-20261028`
Parent: `qa/haiz-v1.4-verification`
Version: `1.4.0-preview.1+5`

## Website-derived design

The existing website at `haiz.space` has a locally developed optical lens
in `assets/js/optical-glass.js`. This Flutter implementation ports that
source's signed-distance rounded bevel, refractive index (n=1.46), RGB dispersion,
transmission, Fresnel rim and specular highlight into
`app/shaders/haiz_optical.frag` rather than simulating it with CSS blur.

`app/lib/ui/optical_backdrop.dart` uses `ImageFilter.shader` on Impeller and a
safe Gaussian fallback elsewhere. The shader samples the live Flutter backdrop,
not the website's hero JPEG or a fake screenshot; UI text and touch targets are
rendered separately above the glass.

The mobile language takes its palette and photographic editorial direction
from the website's ivory, forest, copper and campus architecture. Existing
learning state is not wrapped in a WebView.

## Function changes

- Today: concise date masthead, campus photo, contextual next lesson,
  direct task creation, import, focus access.
- Campus: entry to 3D campus, journal, historic walking route through external
  browser, existing academic connection and physics lab.
- School services awaiting permission are presented as **unavailable**.
- Navigation labels and cards are calibrated to website proportions; app keeps
  three accessible color themes and reduced-motion handling.
- Bundled photos load offline; web-specific links require connectivity.
- Independent nonofficial project identity remains visible.

## Release and verification

- Flutter analyze: passed (zero issues).
- Android release APK: signed; package `space.haiz.app.preview`, version code 5,
  min SDK 24, target SDK 36.
- Full Flutter test suite: **not passing** on baseline v1.4 QA failures involving
  account switch editing, queued migration writes, legacy date handling and
  disposed editing controllers. Do not treat this as a stable student release.
- No Android device/emulator available during this work, so actual GPU refraction
  quality and device frame timings have not been verified. Flutter may use the
  supported blur fallback if Impeller is unavailable.
- Source website optical changes are currently uncommitted locally and are **not**
  silently copied into main. This port owns its independent shader.

## Follow-on QA gate

Before a stable launch: resolve the baseline QA blockers on a separate
stabilization branch, test with a real midrange Android phone, confirm readable
text and taps over photographic/video backdrops, and check frame timing
with GPU profiling. Do not merge to production main without these checks.
