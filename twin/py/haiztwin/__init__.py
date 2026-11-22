"""HAIZ digital-twin toolkit for the Fucheng campus of Hainan Middle School.

Pure-Python helpers (geo, evidence, photo matching) live here; Blender-side
builders live in twin/blender and import this package for coordinates.
"""
from pathlib import Path

TWIN = Path(__file__).resolve().parents[2]      # twin/
REPO = TWIN.parent                              # repository root
