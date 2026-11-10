# HAIZ Pocket Optical Lens v2 — 2026-10-29

Version: 1.4.0-preview.4+8. Based on the authorized message-intake preview.

## Cause and treatment

The prior dock covered live refractive compositor pixels with an opaque milky film. On pale backgrounds this suppressed the effect, and the active tab looked like an ordinary tinted capsule. The new dock uses a much lighter overlay and a larger curved optical edge, n=1.46 refraction, stronger bounded RGB dispersion and Fresnel reflections, a subtle convex centre, and thin-film tint. The selected tab gets its own optical rim and specular reflections.

An independent Canvas-painted rim, inner bevel, grazing highlight and caustic is always present, including devices that fall back to clipped Gaussian blur because Impeller shader filters are unsupported.

No additional network calls or background animation are used. Only the dock has GPU refraction. Text and hit targets remain above the glass.

## Tests and limitations

Flutter analyze: clean. 19 domain/widget tests passed. The Android ARM64 release APK was built successfully with build number 8. Flutter Web compiled from the same Flutter sources, but web browsers normally render the fallback rather than Impeller refraction. No physical Android GPU/frame-time measurement has been collected. Independent v1.4 QA blockers remain open: not a stable production release.
