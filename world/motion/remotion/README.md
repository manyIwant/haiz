# Editable Remotion companion

Composition: `HAIZMotionIdentity`, 720 × 1280, 30fps, 116 frames.

Requires Node 22+, a connected npm registry and a configured Chromium environment.

```bash
npm install
npm run studio
npm run render
```

The source reproduces the same original 12-segment HAIZ polygon morph as the interactive browser prototype. **Not yet compiled or rendered on CI:** the downloadable MP4 was rendered from the browser's deterministic frame timeline, rather than the Remotion CLI. Validate fonts, final viewport composition and rendering before declaring the two outputs equivalent.

The interaction-facing app should keep its animations in realtime browser code, not in Remotion video playback. Never block UI startup on cinematic assets.
