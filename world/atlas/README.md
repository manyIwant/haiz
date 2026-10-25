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
- A spatial-photo home/campus first screen with four narrative landmark selections grounded in existing project images (凤栖堂、砚池、图书馆、教学楼); each chosen record offers a real route to an existing HAIZ experience. Pin placement is *editorial navigation*, not a coordinate-accurate GIS plot. Study/community retain their original editorial view.\n- Three optional, locally remembered art-directed visual times (day/dusk/night). These are **not live weather or true astronomical lighting**. Bounded pointer parallax only on fine pointing devices; reduced motion and tab-hidden are respected.\n- Four switchable editorial views: today, campus, study, life, each with three photographs and actionable destinations.
- Responsive sidebar and translucent bottom dock with a bounded physical spring integrator, mouse/keyboard preview and reduced-motion instant positioning. Frames stop once the lens settles.
- A personal "one small thing" list saved only in current browser localStorage, with safe text rendering, completion, deletion and no fake cross-device sync.
- Deep links to existing campus model, INNER WORLD, STILLROOM, community and Flow. The campus/INNER WORLD/STILLROOM links use a **brief, cancelable, skippable cinematic page transition**; the destination is still an independent page load, not seamless streaming of a shared 3D renderer. Flow's authorization and server prerequisites remain unchanged.
- Reduced-motion CSS, visible focus, skip link, button semantics and no remote runtime dependencies.

**Not yet:** this is not an authenticated school dashboard, official announcement feed, new learning management backend or a verified released mobile app. The imagery is existing project media; check upstream/photo use rights before public production rollout. Scenes are conceptual in-game/world representations, not survey-faithful reproductions.

## Design constraint

The campus itself is the hero: a full-width aerial-photo first screen, landmark navigation, and restrained editorial composition with large authentic photography, carefully weighted Chinese serif headlines, small clear utility text, generous white space, and controls that leave the scene visible. No indistinguishable card-grid dashboard, simulated school data, or AI-generated announcements.

## OpenUI workflow

Recommended design studio: [scalewithalap/openui](https://github.com/scalewithalap/openui) (MIT). It is an *optional standalone local design generator*, not an HAIZ browser dependency. You can import screenshots/ideas and the companion [brief](OPENUI_BRIEF.md) into OpenUI, then review generated code against accessibility, provenance, perf and existing HAIZ routes before integration.

Other "OpenUI" repositories are unrelated implementations: [wandb/openui](https://github.com/wandb/openui) provides text-to-UI live prototyping; [thesysdev/openui](https://github.com/thesysdev/openui) is a generative UI runtime. Do not install either into HAIZ solely because of the name.

## Smoke checks

From repo root, run `node --test world/atlas/tests/smoke.test.cjs`. The GitHub Actions job also installs Chromium/Playwright, checks 320/390/768/1440 viewports, search, focus, scene-portal cancel/skip, reduced-motion, theme persistence and local task safety, and uploads screenshots as a CI artifact. These checks only count after the latest workflow succeeds. **Safari/iOS, physical Android/WebView performance and visual art-direction signoff remain unverified.**

## Avoid integration conflicts

This preview adds a single footer link in `world/app.js` but deliberately **does not** replace `world/style.css`, the Lucent native dock, service workers, build manifests or Android/iOS binaries. This makes the preview reviewable while pending Draft PRs for Flow, the real campus WebGL engine, and the native shell remain unresolved.


## V3 / real campus place connections

The cinematic reference inspired a distinction between a full-screen *introduction* and an actual place interaction. ATLAS's first image remains a real campus photo; the landing page **does not pretend that aerial photograph is WebGL**.

- Select 凤栖堂 / 砚池 / 图书馆 / 教学楼 in the lightweight atlas, then choose **在三维校园中抵达这里** to load `world/campus.html` with the WebGL engine's existing `focus=<validated id>` and `observe=1` query controls. Mobile coarse-pointer hardware requests the existing `low` tier as an initial preference; full 3D is not fetched on the atlas page.
- The retained engine handles safe arrival points, shadows, collisions, map, walk controls and optional internal route planning. No fake cinematic camera flight is claimed: `focus` currently positions the first-person camera *near* the selected model location after the user presses the enter button.
- `world/campus-journey-ui.js` complements, but never replaces, the engine: when accessed via a focus link it personalizes the intro with the project-owned location photo and name; the retained map and pause dialogs gain contextual links to genuine project pages (STILLROOM, independent conceptual classroom, architecture articles) and a way back to ATLAS.
- These structures are intentionally separate from the industrial monitoring/dashboard aesthetic. The creative reference is interaction architecture rather than copied video, 3-D meshes, text, or brand visuals.
- Public release still needs representative device tests and permission review for the retained campus photographs. Do not describe the project model as a survey-faithful reconstruction or the editorial day/dusk/night palette as true weather.

**Verification:** `node --test world/atlas/tests/smoke.test.cjs` exercises relative routes, source syntax, UMD spring math, semantic photo hotspots and WebGL `focus` contracts. The CI Playwright job checks mouse/touch-width DOM interactions and screenshots. Static contracts are not a substitute for playing through the full WebGL arrival on a physical Android/iOS device.
