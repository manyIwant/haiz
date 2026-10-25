# HAIZ / OpenUI design input — ATLAS

Use this brief in the optional local-first UI design application [scalewithalap/openui](https://github.com/scalewithalap/openui). The human-reviewable implementation lives beside this brief in `world/atlas/`.

## Product
HAIZ is an independent student-made digital campus, not an official school service. It combines original spatial experiences, local focus tools, a campus publication and optional authenticated collaboration. Do not invent logins, notifications, homework submission success, class schedules, real-time school statistics or announcements.

## Audience and purpose
Students and teachers may use different devices. Students should have a delightful calm reading/study surface at home; teachers' real business functions must rely on the existing Flow authorization. A school without required student phones cannot make mobile-only workflows mandatory.

## Art direction
An editorial cultural publication meets a spatial operating system. Mature and warm, without AI-template boxes. Authentic campus photography is the largest visual element; preserve architecture and source attribution. Large Chinese serif headlines, quiet UI labels, restrained copper accent, graduated glass and carefully measured negative space. Use local assets rather than image-generation substitutes.

Design tokens:
- Porcelain: paper #e7e6df, ink #26362e, accent #a76f49.
- Obsidian: field #111b1b, ink #ecede5, accent #cdad87.
- Ocean: field #102129, ink #e7f2f0, accent #deb98f.
- Edges: 1px translucent; generous rhythm; rounded navigation capsule but mostly square-edged content surfaces.

## Screens and interactions
1. Daily compass: real routes to campus, STILLROOM, INNER WORLD and journal; a one-thing local-only note.
2. The campus atlas: large scene view and wayfinding to already implemented digital campus. Optional artistic weather must never claim to be real live weather.
3. Study: direct route to the real STILLROOM timer/notebook, no fake metrics.
4. Life: actual journal and clubs proposal pages with truthful provenance.
5. Command search: Cmd/Ctrl + K; only indexed site destinations; accessible and keyboard operated.
6. Dock: floating, tactile translucent lens with finite motion and three persistent themes; keyboard and touch work equally.

## Rules
- No new big framework/runtime dependencies for this preview; the current world is static HTML, CSS and JS with optional standalone 3D pages.
- Respect existing spatial anchors, mobile WebView, offline service-worker boundaries, Android 13 performance and WebGL capability fallbacks.
- Animate properties with a bounded budget; respect reduced-motion and avoid a forever-running backdrop loop.
- Never import/copy the proprietary Dream Road game's assets. No arbitrary copied studio UI/theme assets.
- Distinguish concept previews, simulated worlds, local-only notes and genuinely authorized services.

## Acceptance
Produce both 1440×900 desktop and 390×844 mobile screenshots and keyboard walkthrough; test 320px width, 125%/200% zoom, contrast, search, route links, persistence, reduced-motion, dark-theme contrast and no uncaught console errors. Only then propose integration into the primary HAIZ shell.
