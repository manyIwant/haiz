#!/bin/bash
# Remaining final bakes (resume after an interruption). Run from the project root.
PY=${PY:-/home/user/bpyenv/bin/python}
$PY world/bake.py room,furn morning_nosun 64
$PY world/bake.py bldg dusk 40
$PY world/bake.py station dusk,night 48
$PY world/bake.py land dusk,morning,dawn,night 32
$PY world/bake.py room,furn morning,dawn 64
$PY world/bake.py bldg morning,dawn 40
$PY world/bake.py station morning 48
echo ALL BAKES DONE
