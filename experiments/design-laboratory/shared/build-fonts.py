# 用法：npm pack @fontsource/noto-serif-sc@5.3.1 并解压，然后
#   python3 build-fonts.py <解压后的 package/files 目录>
import glob,re,sys,os
HERE=os.path.dirname(os.path.abspath(__file__))
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.merge import Merger
src=sys.argv[1] if len(sys.argv)>1 else 'fontsrc/package/files'
pages=[HERE+'/../judou/index.html',HERE+'/../shared/data.js',HERE+'/../shared/campus.js']
txt=''.join(open(p).read() for p in pages)
core=set(ch for ch in txt if ord(ch)>=0x20)
# GB2312 一级常用字
lvl1=set()
for hi in range(0xB0,0xD8):
    for lo in range(0xA1,0xFF):
        try: lvl1.add(bytes([hi,lo]).decode('gb2312'))
        except: pass
ext=lvl1-core
print(len(core),len(ext))
out=HERE+'/../shared/fonts'; os.makedirs(out,exist_ok=True)
def build(weight, chars, name):
    cps=set(ord(c) for c in chars)
    # pick slices containing needed glyphs
    picked=[]
    for f in sorted(glob.glob(f'{src}/noto-serif-sc-*-{weight}-normal.woff2'))+[f'{src}/noto-serif-sc-chinese-simplified-{weight}-normal.woff2',f'{src}/noto-serif-sc-latin-{weight}-normal.woff2']:
        if not os.path.exists(f): continue
        t=TTFont(f); cm=set(t.getBestCmap().keys())
        if cm & cps: picked.append((f, cm & cps))
    # subset each slice to needed glyphs, then merge
    parts=[]
    for i,(f,need) in enumerate(picked):
        t=TTFont(f)
        o=subset.Options(); o.layout_features=['*']; o.notdef_outline=True; o.name_IDs=['*']; o.hinting=False
        s=subset.Subsetter(o); s.populate(unicodes=need); s.subset(t)
        t.flavor=None; pth=os.path.join(HERE,f'.part{i}.ttf'); t.save(pth); parts.append(pth)
    # (临时文件在合并后删除)
    m=Merger(); f=m.merge(parts); f.flavor='woff2'
    fn=f'{out}/{name}-{weight}.woff2'; f.save(fn); [os.remove(x) for x in parts]; print(fn, os.path.getsize(fn), len(parts))
    return fn
for w in ('400','600'):
    build(w, core, 'hz-serif-core')
    build(w, ext, 'hz-serif-ext')
rng=lambda chars: ','.join('U+%X'%ord(c) for c in sorted(chars) if ord(c)>0x2000)
css='/* HZ Serif：思源宋体 / Noto Serif SC（SIL OFL 1.1）的子集，仅含实验室页面用字（core）与 GB2312 一级常用字（ext，按需加载）。由 build-fonts.py 生成。 */\n'
for w in ('400','600'):
    css+=f"@font-face{{font-family:'HZ Serif';font-weight:{w};font-display:swap;src:url(fonts/hz-serif-core-{w}.woff2) format('woff2');}}\n"
    css+=f"@font-face{{font-family:'HZ Serif';font-weight:{w};font-display:swap;src:url(fonts/hz-serif-ext-{w}.woff2) format('woff2');unicode-range:{rng(ext)};}}\n"
open(HERE+'/../shared/fonts.css','w').write(css)
