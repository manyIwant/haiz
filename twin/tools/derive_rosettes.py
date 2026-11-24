#!/usr/bin/env python3
"""Derive the animated homepage leaf origins from the atelier crown's petioles."""
import json, math, pathlib, random, struct
from pack_runtime import read_glb, ROOT
def values(g, buf, i):
    a=g["accessors"][i]; v=g["bufferViews"][a["bufferView"]]
    assert a["componentType"]==5126
    n={"VEC2":2,"VEC3":3}[a["type"]]
    start=v.get("byteOffset",0)+a.get("byteOffset",0)
    stride=v.get("byteStride",4*n)
    return (struct.unpack_from("<"+"f"*n,buf,start+k*stride) for k in range(a["count"]))
def main():
    g,buf=read_glb(ROOT/"assets/atelier/terminalia.glb")
    meta=json.loads((ROOT/"data/trees.json").read_text())["lanren"]
    tx,ty=meta["trunk_xy"]
    roots={}
    node=next(n for n in g["nodes"] if n["name"]=="lanren.terminalia.leaves")
    assert not any(k in node for k in ("translation","rotation","matrix","scale"))
    for prim in g["meshes"][node["mesh"]]["primitives"]:
        attrs=prim["attributes"]
        for p,uv in zip(values(g,buf,attrs["POSITION"]), values(g,buf,attrs["TEXCOORD_0"])):
            if abs(uv[0]-.5)<1e-4 and abs(uv[1]-1)<1e-4:
                roots[tuple(round(x,4) for x in p)]=p
    # Source glTF metres -> home V4 frame (same +90 deg rotation as composition b).
    def home(p): return (p[2]+ty,p[1]-.85,-(p[0]-tx))
    pts=[home(p) for p in roots.values()]; assert len(pts)>1000
    rng=random.Random(1923); data=bytearray()
    for x,y,z in pts:
        r=math.hypot(x,z); dx=x/max(r,.01); dz=z/max(r,.01); dy=.35
        q=math.sqrt(dx*dx+dy*dy+dz*dz)
        old=rng.uniform(.035,.34) if rng.random()<.24 else -1
        emerge=rng.uniform(.20,.405)
        # The static master grows six leaves per selected petiole. Use the same
        # petioles to drive V4's existing seasonal leaf/brush interaction.
        row=(x,y,z,dx/q,dy/q,dz/q,.57+rng.random()*.13,.35+rng.random()*.4,
             .18+rng.random()*.4,emerge,old,rng.random(),x*.93,y-.36,z*.93,.8)
        data.extend(struct.pack("<16f",*row))
    out=ROOT/"assets/runtime"
    (out/"rosettes.bin").write_bytes(data)
    (out/"tree-animation.json").write_text(json.dumps({"source":"atelier/terminalia.glb",
        "stride":16,"count":len(pts),"source_trunk_xy":meta["trunk_xy"],
        "frame":"homepage V4: calibrated tree origin, +90 degree campus rotation",
        "source_ground":meta["ground_z"]},indent=2)+"\n")
    print("petioles",len(pts),"bytes",len(data))
if __name__=="__main__": main()
