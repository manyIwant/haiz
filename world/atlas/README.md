# HAIZ ATLAS — an OpenUI-informed interface experiment

A small, independent **working UI** for HAIZ. It draws on the local-first, design-system-led prototyping workflow represented by [scalewithalap/openui](https://github.com/scalewithalap/openui), rather than copying that application's code or bundling a design generator inside the school site.

## Run

From repository root:

```sh
python3 -m http.server 8000
```

Open **http://localhost:8000/world/atlas/**. The project uses only local CSS, local JS, bundled font and existing campus images. The 3D campus is not loaded on the ATLAS home surface. All destinations are ordinary links into pre-existing HAIZ pages.

## What this UI actually does

- Three persistent visual settings: Porcelain, Obsidian, Ocean.
- Keyboard and pointer-accessible search (`Cmd/Ctrl + K`), with destinations already in the HAIZ source tree.
- Four switchable editorial views: today, campus, study, life, each with three photographs and actionable destinations.
- Responsive sidebar and liquid-glass-inspired bottom dock with finite spring-like movement; no perpetual animation loop.
- A personal "one small thing" list saved only in current browser localStorage, with safe text rendering, completion, deletion and no fake cross-device sync.
- Deep links to existing campus model, INNER WORLD, STILLROOM, community and Flow. Flow's authorization and server prerequisites remain unchanged.
- Reduced-motion CSS, visible focus, skip link, button semantics and no remote runtime dependencies.

**Not yet:** this is not an authenticated school dashboard, official announcement feed, new learning management backend or a verified released mobile app. The imagery is existing project media; check upstream/photo use rights before public production rollout. Scenes are conceptual in-game/world representations, not survey-faithful reproductions.

## Design constraint

The campus itself is the hero: restrained editorial composition with large authentic photography, carefully weighted Chinese serif headlines, small clear utility text, generous white space, and controls that leave the scene visible. No indistinguishable card-grid dashboard, simulated school data, or AI-generated announcements.

## OpenUI workflow

Recommended design studio: [scalewithalap/openui](https://github.com/scalewithalap/openui) (MIT). It is an *optional standalone local design generator*, not an HAIZ browser dependency. You can import screenshots/ideas and the companion [brief](OPENUI_BRIEF.md) into OpenUI, then review generated code against accessibility, provenance, perf and existing HAIZ routes before integration.

Other "OpenUI" repositories are unrelated implementations: [wandb/openui](https://github.com/wandb/openui) provides text-to-UI live prototyping; [thesysdev/openui](https://github.com/thesysdev/openui) is a generative UI runtime. Do not install either into HAIZ solely because of the name.

## Smoke checks

From repo root, run `node --test world/atlas/tests/smoke.test.cjs`. Browser/device checks still required (320, 390, 768, 1280 and 1440 widths, Safari on iOS, Chromium/WebView, keyboard and reduced-motion), and actual graphical signoff must be done with screenshots. No browser or device check is implied by static smoke tests.

## Avoid integration conflicts

This version deliberately **does not** edit `world/app.js`, `world/style.css`, the Lucent native dock, service workers, build manifests or Android/iOS binaries. This makes the preview reviewable while pending Draft PRs for Flow, the real campus WebGL engine, and the native shell remain unresolved.
