#!/usr/bin/env python3
"""Build web meshes from the unchanged atelier masters; share byte-identical PNGs."""
import argparse, hashlib, json, pathlib, struct, subprocess, tempfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
PARTS = ("yihao","erhao","science","south_classrooms","arts","forecourt","landmark","terminalia","yanchi")
def read_glb(p):
    data=p.read_bytes(); magic,version,length=struct.unpack_from("<4sII",data)
    assert magic==b"glTF" and version==2 and length==len(data), p
    n,t=struct.unpack_from("<II",data,12); assert t==0x4e4f534a
    g=json.loads(data[20:20+n]); off=20+n
    m,t=struct.unpack_from("<II",data,off); assert t==0x004e4942
    return g,data[off+8:off+8+m]
def write_glb(path,g,buf):
    j=json.dumps(g,ensure_ascii=False,separators=(",",":")).encode()
    j+=b" "*(-len(j)%4); buf=bytes(buf)+b"\0"*(-len(buf)%4)
    path.write_bytes(struct.pack("<4sII",b"glTF",2,28+len(j)+len(buf))+struct.pack("<II",len(j),0x4e4f534a)+j+struct.pack("<II",len(buf),0x004e4942)+buf)
def externalize(p,out,tex):
    g,buf=read_glb(p); views=g["bufferViews"]; image_ids=set()
    for im in g.get("images",[]):
        idx=im.pop("bufferView"); b=views[idx]; assert b.get("buffer",0)==0
        payload=buf[b.get("byteOffset",0):b.get("byteOffset",0)+b["byteLength"]]
        suffix={"image/png":".png","image/jpeg":".jpg","image/webp":".webp"}[im["mimeType"]]
        name=hashlib.sha256(payload).hexdigest()[:32]+suffix
        path=tex/name
        if not path.exists(): path.write_bytes(payload)
        im["uri"]="textures/"+name
        image_ids.add(idx)
    # Preserve all non-image views and compressed meshopt streams, including
    # their virtual fallback buffer. Remove unused image views and remap indices.
    used=[i for i in range(len(views)) if i not in image_ids]
    index={i:j for j,i in enumerate(used)}
    g["bufferViews"]=[views[i] for i in used]
    def remap(x):
        if isinstance(x,dict):
            for k,v in x.items():
                if k=="bufferView" and isinstance(v,int): x[k]=index[v]
                else: remap(v)
        elif isinstance(x,list):
            for v in x: remap(v)
    remap(g)
    packed=bytearray(); ranges={}
    def relocate(v):
        if v.get("buffer",0)!=0: return
        key=(v.get("byteOffset",0),v["byteLength"])
        if key not in ranges:
            packed.extend(b"\0"*(-len(packed)%4)); ranges[key]=len(packed)
            start,n=key; assert start+n<=len(buf); packed.extend(buf[start:start+n])
        v["byteOffset"]=ranges[key]
    for b in g["bufferViews"]:
        relocate(b)
        e=b.get("extensions",{}).get("EXT_meshopt_compression")
        if e: relocate(e)
    packed.extend(b"\0"*(-len(packed)%4)); g["buffers"][0]["byteLength"]=len(packed)
    write_glb(out,g,packed)
def main():
    p=argparse.ArgumentParser();p.add_argument("--gltfpack",nargs="+",default=["gltfpack"]);a=p.parse_args()
    source=ROOT/"assets/atelier"; dest=ROOT/"assets/runtime"; tex=dest/"textures";tex.mkdir(parents=True,exist_ok=True)
    manifest={"schema":"haiz-atelier-runtime/1","source":"atelier","parts":{}}
    with tempfile.TemporaryDirectory() as t:
        for name in PARTS:
            src=source/(name+".glb"); tmp=pathlib.Path(t)/(name+".glb"); out=dest/(name+".glb")
            opts=["-cc","-km","-ke","-vpf","-vt","16","-vn","10","-vc","10"]
            opts += ["-kn"] if name in ("forecourt","landmark","terminalia","yanchi") else ["-mi","-mm"]
            subprocess.run(a.gltfpack+["-i",str(src),"-o",str(tmp)]+opts,check=True)
            externalize(tmp,out,tex)
            manifest["parts"][name]={"file":out.name,"bytes":out.stat().st_size,"source_sha256":hashlib.sha256(src.read_bytes()).hexdigest()}
            print(name,out.stat().st_size,flush=True)
    manifest["texture_bytes"]=sum(x.stat().st_size for x in tex.iterdir() if x.is_file())
    (dest/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
if __name__=="__main__": main()
