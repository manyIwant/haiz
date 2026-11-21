# three-procedural-locomotion (vendored)

- Upstream: https://github.com/PabloMesquida/three-procedural-locomotion
- Version: 0.3.0, commit `1d1c71e21dbf9da038eed09d54d3c5ca33d9218c`
- License: MIT (see `LICENSE`, Copyright (c) 2026 Pablo Mesquida)
- Build: `esbuild src/index.ts --bundle --format=esm --external:three --target=es2020 --minify` (esbuild 0.24.2),
  no source changes. `three` resolves through the page's import map (HAIZ vendors three r170; upstream tests r150–r186).
- Why it is here and how HAIZ uses it: `docs/life-20261117.md`; the adapter is `lanren/life/gait.js`.

Upstream's gait was tuned against CMU motion capture (mocap.cs.cmu.edu; no capture data is included here).
CMU's requested acknowledgment: *The data used in this project was obtained from mocap.cs.cmu.edu. The
database was created with funding from NSF EIA-0196217.*
