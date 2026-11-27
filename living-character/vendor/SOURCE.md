# Living Character Vendor & Motion Asset Sources

## 1. `three-procedural-locomotion` v0.11.0
- **Repository**: https://github.com/PabloMesquida/three-procedural-locomotion
- **Tag / Commit**: `v0.11.0` (`118a0b01c093ba01be7ae02f6762da9ad9cd3894`)
- **License**: MIT (`living-character/vendor/LICENSE`, Copyright (c) 2026 Pablo Mesquida)
- **Bundling**: Built locally via `esbuild` 0.28.2 (`--bundle --format=esm --external:three --target=es2020 --minify`) with zero source modifications.
- **Bundles**:
  - `living-character/vendor/procedural-locomotion-v0.11.0.min.js` (SHA-256: `9a37a8c44b1c4d4cff2fbdea95dec220a30ae6fd7481ffa7ebb890afc547d0a2`)
  - `living-character/vendor/procedural-locomotion-debug-v0.11.0.min.js`

## 2. Quaternius Universal Animation Library (`UAL1.glb`)
- **Upstream**: https://quaternius.itch.io/universal-animation-library
- **Mirror**: https://raw.githubusercontent.com/tilakpatell/tilakverse-assets/main/quaternius/universal-animation-library/Unreal-Godot/UAL1.glb
- **SHA-256**: `d1cb4537efa4c06a953ca951e5935062f88c2580ac68e45045592d587bddb43d`
- **License**: CC0 1.0 Universal (Public Domain)
- **Usage**: Source clips (`Idle_Loop`, `Idle_LookAround_Loop`, `Idle_Talking_Loop`, `Walk_Formal_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`, `Sprint_Enter`, `Sprint_Exit`, `Turn90_L`, `Turn90_R`) retargeted in Blender onto `HAIZ_LivingRig_v3` and quantized into `living-character/assets/motion/haiz-motion-pack.json`.

## 3. CMU Graphics Lab Motion Capture Database (MotionBuilder-Friendly BVH Release)
- **Upstream**: http://mocap.cs.cmu.edu / Bruce Hahn 2010 MotionBuilder BVH conversion (`https://github.com/Shriinivas/cmubvh`)
- **Sequences downloaded**: `01_01.bvh`, `07_01.bvh`, `07_02.bvh`, `07_10.bvh`, `08_05.bvh`, `09_01.bvh`, `13_33.bvh`, `14_08.bvh`, `16_15.bvh`
- **License / Attribution**: Free for research and commercial use. Required acknowledgment:
  > *The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.*
- **Usage**: Used for stair-climbing/descending phrasing (`13_33.bvh`, `14_08.bvh`), turning walk (`08_05.bvh`), and real-human gait kinematics verification in `living-character/pipeline/retarget_mocap.py`.
