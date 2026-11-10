# HAIZ identity assets

The approved HAIZ emblem is the warm-gold, photograph-filled **H** against a deep graphite/navy field. This mark is cropped from the selected HAIZ logo image; the full-poster composition is not compressed into the app launcher.

- Source: `haiz-emblem-source.jpg` (cropped H emblem).
- Brand preview: `haiz-emblem-512.png`.
- Generator: `../../scripts/generate-brand-icons.py`.
- Generated outputs: site favicon, Web/PWA previews, Android launcher densities, iOS AppIcon variants, and macOS AppIcon variants.
- Preserve feature and navigation glyphs; only replace HAIZ identity marks.

To regenerate locally: `python3 -m pip install Pillow==11.3.0 && python3 scripts/generate-brand-icons.py`.

The GitHub Actions icon-sync workflow also regenerates and commits the platform icons when the source or generator changes on `main`. Rebuild a native app to distribute the updated launcher icon; previously installed apps do not update until a new binary is installed.
