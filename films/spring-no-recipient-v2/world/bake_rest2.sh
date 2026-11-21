#!/bin/bash
# Remaining final bakes with per-state scaling (resume list). Run from the project root.
PY=${PY:-/home/user/bpyenv/bin/python}
$PY world/bake.py room,furn morning 64
$PY world/bake.py bldg morning 40
$PY world/bake.py station morning 48
$PY world/bake.py land dawn,night 32
$PY world/bake.py room,furn dawn 64
$PY world/bake.py bldg dawn 40
$PY world/bake.py station night 48
echo ALL BAKES DONE
