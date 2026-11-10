# HAIZ Pocket — Illuminated Wall Entrance

The user-selected visual reference is a blue brick wall with a **warm physical wall lamp** and frosted-glass entrance card. This version intentionally follows that reference, rather than pretending the physical wall-light scene is Aceternity's abstract conic-gradient Lamp.

- A resolution-independent **1920×1080 SVG** wall texture with individually drawn bricks, surface grain and lamp fixture lives at `public/brick-wall-hd.svg`. No blurry low-resolution bitmap is needed.
- CSS simulates bulb ignition and a warm illumination expanding over the wall. Motion reveals the card after the light.
- "重播灯光" replays the effect; `prefers-reduced-motion` disables animation.
- `./app/?fromLamp=1` opens the actual compiled Flutter Web workspace, **not an account-authentication endpoint**.
- Android/iOS can show this online entrance via WebView; a local Flutter fallback remains for offline use.

Build with `npm install && npm run build` from `app/web-lamp-react/`. Preview base: `/lamp-preview/`.

Aceternity reference and component retrieval scripts remain in the repository for design history, but **this particular reference-faithful login entrance is a custom scene, not Aceternity's unmodified component**.
