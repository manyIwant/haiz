# HAIZ · LIVING CHARACTER (Round 3) — Quality Benchmark & Provenance Report

## 1. Executive Summary

Round 3 (`experiment/living-character-r3`) inherits Claude's original sculpted Hainan Middle School (HAIZ) student identity, proportions, mint-green polo collar, cerulean athletic pants, and backpack aesthetic, while replacing timer-driven clip playback and turret-turning with a unified biomechanical locomotion architecture:

- **38-Bone Master Rig (`HAIZ_LivingRig_v3`)**: Cleanly rebuilt in Blender 5.2 LTS (`HAIZ_Living_Character_Master.blend`, 41 MB) with `thigh_twist`, `shin_twist`, `upperarm_twist`, and `forearm_twist` bones, detached shoulder backpack, new diagonal crossbody satchel (`crossbody_bag`), optional ponytail, and 4 archetypes × 3 LODs (`student_hero`, `student_f`, `teacher_f`, `worker_m`, each `0.48–1.98 MB` Meshopt/WebP GLB).
- **Biomechanical Gait & Foot Contact**: Powered by `three-procedural-locomotion` v0.11.0 (MIT) + multi-surface analytical/mesh ground detector with quantized granite staircase treads and slope normals.
- **5-Stage Physiological Turn Cascade**: `Gaze → Head → Neck → Chest → Pelvis → Footsteps` with anticipatory head/neck lead (`51.6°` head, `21.3°` neck, `18.2°` chest), centripetal curve bank (`-4.0°`), idle pivot threshold (`32°`), and moving `Brake-Plant-Pivot` reversals (`> 115°`).
- **Phase-Locked Mocap Expression + 2nd-Order Secondary Springs**: Retargeted Quaternius UAL1 (CC0) & CMU Graphics Lab (NSF EIA-0196217) micro-phrasing plus damped springs for backpack, crossbody satchel (with thigh-swing clearance), hair, and shirt hem.
- **Standalone Acceptance Lab & Full Round 2 Campus Integration**: `living-character-lab.html` (with synchronized 3-way comparator) and `living-campus-r3.html` (zero edits to Round 2 campus files, upgrading Player + 6 desynchronized Living Citizens with inherited Claude 2-bone vehicle IK).

---

## 2. Head-to-Head Locomotion Comparison (Claude Original vs Round 2 vs Round 3)

Measured on the synchronized 3-way flat-ground + turn-cascade trajectory (`living-character/data/motion-metrics-final.json`, 0 console/page/HTTP errors):

| System / Track | Mean Stance Foot Slide (mm/s) | P95 Stance Foot Slide (mm/s) | Max Ground Penetration (mm) | Turn Behavior | Terrain / Stairs | Secondary Physics |
|---|---:|---:|---:|---|---|---|
| **A · Claude Original (`入画 V2` Clip Blend)** | **566.31** | 3,855.06 | 0.0* | Turret root yaw + head aim | Flat height sample | None |
| **B · Round 2 Baseline (Hunyuan + Walker)** | **72.73** | 328.55 | 0.0 | Immediate lerp turret yaw | Linear ramp approximation | Simple bag pitch/roll |
| **C · Round 3 Living Character (`HAIZ_LivingRig_v3`)** | **20.50** (flat turn) / **15.28** (walk) / **6.48** (stairs) | **143.09** (turn) / **94.11** (walk) / **0.03** (stairs) | **0.00** | **5-Stage Cascade** (`Head 51.6° → Neck 21.3° → Chest 18.2°`, `-4.0°` bank) | **Discrete Stair Treads + Slope Normals + Foot IK** | **6-bone damped springs** (`bag_body`, `crossbody_bag` thigh clearance, `hair`, `hem`, `ponytail`) |

\* Note: *Claude Original* `createStudent` samples idle/walk/run animation clips with fixed sole offset (`penetrationMax = 0`), while skating horizontally whenever velocity diverges from clip speed (`566.3 mm/s` mean slide).

---

## 3. Closed-Loop Character & Rig Audit Metrics

### 3.1 Blender Master Deformation Audit (`living-character/data/rig-audit.json`)
- **Rig**: `HAIZ_LivingRig_v3` (38 bones, 4× twist bones correctly isolated as parallel segment children).
- **Body / Backpack / Crossbody**: `37,167` / `2,716` / `732` triangles (LOD0), normalized vertex weights max error `1.8e-05`, hand-to-hip weight isolation `1.000`, rest sole height `0.000 m`.
- **Multi-Pose Edge Stretch (P95 / P99)**:
  - `idle`: whole `1.008 / 1.068`, shoulders `1.080 / 1.185`
  - `walk_contact`: whole `1.111 / 1.326`, shoulders `1.201 / 1.377` (vs `max 4.115` in R2 Hunyuan baseline), elbows `1.126 / 1.183`, knees `1.185 / 1.302`, crotch `1.469 / 1.879`
  - `run_stride`: whole `1.294 / 1.798`, knees `1.569 / 1.816`
  - `arm_raise_90` (extreme stress pose): shoulders `1.834 / 3.058` (known limitation in §7)

### 3.2 Closed-Loop Visual Fixes (`v1 → final`)
Every visual contact sheet (`lab-sheet-v1-part1/2.jpg`, `campus-r3-smoke.png`, `lab-sheet-final-part1/2.jpg`) was inspected:
1. **Double-Lean Forward Hunch Fixed (`v1 → final`)**: *v1* visual inspection revealed ~50°–65° forward torso hunching during `jog_side`, `stairs_up_down`, and `slopes_10_15` caused by stacking full UAL1/CMU spine & upper-arm deltas atop TPL's already-calibrated `TorsoController` / `StairPlanner`. Restricted `MocapExpressionLayer` during locomotion to subtle shoulder/wrist/breathing nuance while preserving full clip phrasing in idle (`< 0.14 m/s`), restoring upright teenage carriage.
2. **Backpack / Shirt-Hem Clip Fixed (`campus-r3-smoke.png`)**: Campus R3 wind gusts drove `shirt_hem_b` up to `±0.26 rad`, swinging lower-back pants vertices through the bottom of the brown backpack. Tightly clamped `shirt_hem_f/b` to `±0.045 rad` and `bag_body` pitch to `[-0.07, +0.03] rad`, completely eliminating rear bag clipping.
3. **Claude V2 Foot-Stance Calibration (`comparators.js`)**: Calibrated frame-0 resting ankle clearance so Claude V2's clip-blend horizontal skating (`566.3 mm/s` mean) is accurately measured head-to-head.

---

## 4. Real ANGLE Metal GPU Benchmark (`living-character/data/gpu-benchmark-r3.json`)

Measured in headless Chromium on **Apple M5 (`ANGLE Metal Renderer`)** (`0` console errors, `0` page errors, `0` HTTP 4xx/5xx):

| Scene | FPS (Mean) | Frame Time P50 / P95 | Draw Calls | Triangles | JS Heap |
|---|---:|---:|---:|---:|---:|
| `living-character-lab.html` — Hero Solo (`lod0`) | **60.0 FPS** | `16.7 / 17.6 ms` | `11` | `40,631` | `17.1 MB` |
| `living-character-lab.html` — 3-Way Compare | **60.0 FPS** | `16.7 / 17.6 ms` | `17` | `70,597` | `17.1 MB` |
| `living-campus-r3.html` — Campus PBR (`high`, 7 agents) | **17.4 FPS** | `50.6 / 67.7 ms` | `1,643` | `10,596,660` | `17.1 MB` |
| `living-campus-r3.html` — Campus Gouache (`high`, 7 agents) | **16.4 FPS** | `66.5 / 83.3 ms` | `1,647` | `10,596,664` | `17.1 MB` |

All 7 articulated Round 3 campus characters combined contribute `< 1.4%` of the 10.6M campus scene triangles while using `60 / 30 / 15 Hz` distance Animation LOD for the 6 citizens.

---

## 5. Provenance Ledger

| Asset / Dependency | Source & Commit / Hash | License | Notes |
|---|---|---|---|
| Base Student Mesh Proportions & Uniform Concept | `character-lab/hunyuan/source/20261121124835_b26256ec.glb` & Claude 「入画」 (`lanren/assets/toon/student.glb`, `lanren/ruhua/walker.js`) | HAIZ Internal | Preserved visual identity, sculpted in Blender 5.2 (`build_master_characters.py`) |
| `procedural-locomotion-v0.11.0.min.js` | `PabloMesquida/three-procedural-locomotion` tag `v0.11.0` (`118a0b01c093ba01be7ae02f6762da9ad9cd3894`), SHA-256 `9a37a8c44b1c4d4cff2fbdea95dec220a30ae6fd7481ffa7ebb890afc547d0a2` | MIT | Unmodified upstream core bundled via `esbuild` |
| `UAL1.glb` (11 retargeted clips) | Quaternius Universal Animation Library (`d1cb4537efa4c06a953ca951e5935062f88c2580ac68e45045592d587bddb43d`) | CC0 1.0 | Quantized 30 Hz upper-body deltas in `haiz-motion-pack.json` |
| CMU BVH (`14_08.bvh`, `08_05.bvh`, et al.) | `mocap.cs.cmu.edu` (Bruce Hahn 2010 MotionBuilder BVH via `Shriinivas/cmubvh`) | Research & Commercial Free | Required acknowledgment: *The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.* |
| Round 2 Campus Reconstruction | `world-reconstruction-r2/` (`921b111` PR #121) | HAIZ Internal | Unmodified; consumed via `terrain-adapter-r3.js` & `main-r3.js` |

---

## 6. Deliverables & Recorded Videos

- **Interactive Acceptance Lab**: `living-character-lab.html`
- **Integrated Round 3 Campus**: `living-campus-r3.html`
- **4 Continuous 30fps H.264 MP4 Demonstrations** (`living-character/videos/`):
  - `compare-claude-r2-r3.mp4`
  - `lab-multiangle-slowmo.mp4`
  - `lab-terrain-stairs-slopes.mp4`
  - `campus-r3-roam.mp4`

---

## 7. Truthfulness Boundaries & Known Limitations

- **Hardware Scope**: All Playwright WebGL rendering, FPS, and frame-time measurements were run in headless Chromium with Metal ANGLE on desktop **Apple M5**; **physical iOS/Android mobile browsers were not tested**.
- **Campus Frame Rate**: At `quality=high`, the 10.6M-triangle Round 2 campus renders at ~16–17 FPS in headless capture; switching to `quality=balanced` / `mobile` reduces pixel ratio & shadow resolution without altering locomotion fidelity.
- **Extreme Shoulder Pose**: Under forced 90° lateral arm elevation (`arm_raise_90`), a small axilla crease reaches P99 stretch `3.058`, though natural walking (`1.377`) and jogging stay well below threshold.
- **Running / Stair Mocap Balance**: Locomotion clips are intentionally clamped to subtle clavicle/wrist/breathing nuance so TPL's lower-body Foot IK and `StairPlanner` never fight conflicting spine lean angles.
