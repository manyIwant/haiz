# Prototype Instructions

Use the latest user-provided Blender V3 asset as the primary campus visual source (user direction, 2026-10-31). Read the current `HAIZ-Campus-V3.blend`, because bundled GLBs may precede its latest edits. Export to the web project without overwriting the source blend. Preserve the 34 campus anchors, working navigation and classroom interactions; retain an existing building only when the V3 source has no usable corresponding structure. Mark new interiors as interpretive until surveyed.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

The current visual direction takes perspective depth, continuous camera movement and natural light from the user's campus video reference, not its industrial dashboards. Preserve the real PR #16 campus layout and all three themes. Raise perceived quality through composition, typography and precise interaction; remove generic AI-style copy, redundant uppercase labels, excessive cards, glow and decorative technology chrome. The campus remains the primary interface.

Use identifiable Fucheng-campus photographs as evidence for exterior refinements, never generated imagery, another campus or a filename alone. Keep historical photo dates, original sources and licensing distinct from visual review. Known mislabelled Yanlintang/pavilion/gate images and ambiguous shared-building photos must be withheld, not reused as verified facades.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
