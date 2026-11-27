# HAIZ · World Reconstruction Round 2 — Provenance, Heritage & Source Registry

## 1. Coordinate System & Georeference (`HAIZ-ENU-2026`)
- **Spec / Blender Space**: Right-handed metric ENU aligned to campus axes (`+X` = campus east, `+Y` = campus north toward North Gate, `+Z` = up). Origin `(0, 0, 0)` sits at Teaching Block 1 front portal centre on the forecourt carriageway datum (`z = 0.0 m`).
- **Three.js / glTF Runtime Transform**: `three_x = spec_x`, `three_y = spec_z`, `three_z = -spec_y` (so `-Z` faces North Gate).
- **WGS84 Anchor**: `19.99847892° N, 110.34254843° E` (campus north bearing `319.0°` true, `41.0° CCW`, inherited from `twin/data/frame.json`).

---

## 2. Credibility Taxonomy (Zero Unverified `surveyed` Claims)
No field architectural survey exists in this project; therefore **`surveyed_count = 0`** across `world_spec.json`, all exported glTF extras, and the Master `.blend`. Every entity carries an explicit credibility basis:

| Tag | Meaning | Examples in Round 2 |
|---|---|---|
| `inherited/atelier/photo-derived` | Direct inheritance of verified high-craft `twin/assets/runtime/*.glb` & `atelier/*.glb` models | `yihao` (1923 Block 1), `landmark` (Taihu Rock), `terminalia` (Centenary Tree), `forecourt` (cleaned of `site.ground.context`), `erhao`, `science`, `south_classrooms`, `yanchi`, `arts` |
| `photo-derived` | Geometry, apertures, signage, & materials calibrated against bundled campus photography + `twin/data/gate.json` | `beimen` (North Gate Paifang per `hero-2560.jpg`), `keji` (`campus_keji.jpg`) |
| `photo-derived/public-map` | OSM building footprints combined with photographic elevation reconstruction | `library` (`campus_library.jpg`), `fengqitang` (`campus_fengqitang.jpg`), `dorm_f` (`campus_dorm_f.jpg`), `dorm_m_north` |
| `photo-derived/estimated` | Stylistic proportions & secondary details inferred from partial campus photography | `yanlinting` (`campus_yanlintang.jpg`), `fengqiting`, `nanmen` (`campus_nanmen.jpg`) |
| `public-map/estimated` | Ground footprint & height estimated from OSM/Overture public map geometry | `gymnasium`, `stadium_stand`, `canteen1`, `canteen3`, `dorm_m_*`, `south_annex_*`, `terrain_surround`, `fucheng_context` |
| `public-map/invented` | Context connector massing extrapolated from public map outlines where photographs do not cover elevations | `campus_wing_155`, `campus_wing_169` |

---

## 3. Reused CC0 & Open Assets
1. **Inherited HAIZ Atelier & Runtime 3D Assets (`twin/assets/runtime/*.glb`)**: Preserved without overwriting or deleting any baseline file, preserving `COLOR_0` vertex shading (`landmark.glb`, `terminalia.glb`) and Yanchi water planes (`yanchi.glb`).
2. **Calibrated Haikou IBL & CC0 PBR Textures (`assets/walk/textures/*`)**: Loaded `campus-light.hdr` for physically calibrated Image-Based Lighting alongside CC0 paving, grass, plaster, and wood maps (`assets/walk/models/NOTICE.md`).
3. **Human Character Skeletons (`lanren/assets/life/*.glb`)**: Reused existing MakeHuman CC0 51-bone `student-f.glb`, `student-m.glb`, `teacher-f.glb`, `worker-m.glb` models (`lanren/assets/life/SOURCE.md`) with corrected resting upper-arm bone offsets for natural walking posture.
4. **Pure Procedural Round 2 Textures**: All Round 2 architectural ceramic mosaics, Lingnan emerald/terracotta glazed tiles, Haikou cream stucco, warm champagne plaster, carved granite plinths, louver panels, 400m athletics track, and basketball court markings were synthesized procedurally via NumPy + Blender Python and packed cleanly.
5. **Typography**: 3D CJK plaque and tablet geometry generated inside Blender from macOS system calligraphy fonts (`Xingkai.ttc`, `Kai.ttf`, `LiSongPro.ttf`) and converted directly to baked beveled meshes for universal glTF portability.

---

## 4. Privacy, Safety & Non-Redistribution Guardrails
- **Reference Photos Stay Out of Preview & R2 Asset Directories**: Original third-party campus photographs (`assets/images/...`) were used strictly for local visual calibration and Blender audit sheets in scratch workspace only; zero campus photographs are copied into `world-reconstruction-r2/` or the deployed preview repository. Public comparison plates (`world-reconstruction-r2/renders/comparisons/comp_*.jpg`) compare pure 3D model evolution only (`Legacy Phase-1 → PR #118 → Round 2 v1 → Round 2 Final`).
- **Privacy & Security Exclusions**: No student/staff personal information, license plates, faces, CCTV cameras, access-control turnstiles, barrier arms, or non-public interior security layouts were modeled or collected.
- **PR #118 Isolation**: Branch `experiment/world-reconstruction` (PR #118) and `manyIwant/haiz-world-reconstruction-preview` remain completely untouched as independent Round 1 records; zero `main` branch files are modified or deleted.
