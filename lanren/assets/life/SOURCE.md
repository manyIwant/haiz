# lanren/assets/life — the campus's bodies

Built by `scripts/life/build_people.py` (Blender 5.3 as a Python module, headless; ~10 s for all four):

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman.git
cd makehuman && git checkout a8bc2d54ff0ac92e78ff71431b1023eda42bf482
git sparse-checkout set --no-cone 'makehuman/data/3dobjs/*' 'makehuman/data/rigs/*' 'makehuman/data/targets/macrodetails/*'
cd - && python3 scripts/life/build_people.py --mh makehuman/makehuman/data --out lanren/assets/life
```

| file | who | parts |
| --- | --- | --- |
| `student-m.glb` | the player, 陈屿, 王一苇 | Body (uniform), Hair-short / Hair-buzz / Hair-part, Bag, Glasses |
| `student-f.glb` | 林知夏 | Body, Hair-ponytail / Hair-bob-short, Bag |
| `teacher-f.glb` | 符老师 | Body, Hair-bob, Glasses |
| `worker-m.glb` | 吴伯 | Body, Hair-grey |

- **Source data**: MakeHuman 1.x (`base.obj` hm08 base mesh, `targets/macrodetails`, `rigs/default.mhskel` and
  `default_weights.mhw`), released as **CC0 1.0** by Data Collection AB, Joel Palmius and Jonas Hauquier
  (see `LICENSE.ASSETS.md` in that repository). Only data is used, none of MakeHuman's AGPL code.
- **What HAIZ made from it** (PolyForm Noncommercial with the rest of HAIZ's code; the meshes are derived from
  CC0 data): the shaping for each person (gender, age, muscle, weight, proportions, stature), the skeleton
  collapsed to the gait's chain with merged weights, the uniform, hair, glasses and bag, and the painted face.
- The figures are fictional people; they are not modelled on anyone.
