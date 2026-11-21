#!/bin/bash
# Final bakes after the inward-quad fix (furniture group re-baked in every state).
PY=${PY:-/home/user/bpyenv/bin/python}
$PY world/bake.py furn dusk 64
$PY world/bake.py room,furn dawn 64
$PY world/bake.py bldg dawn 40
$PY world/bake.py furn morning,dusk_nosun,morning_nosun 64
echo ALL BAKES DONE
