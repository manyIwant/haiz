#!/usr/bin/env python3
"""Generate a restrained HAIZ app icon in PNG using only Python standard library."""
from pathlib import Path
import math, struct, zlib

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "app/android/app/src/main/res"
def rounded(x,y,x0,y0,x1,y1,r):
    dx=abs(x-(x0+x1)/2)-((x1-x0)/2-r)
    dy=abs(y-(y0+y1)/2)-((y1-y0)/2-r)
    return math.hypot(max(dx,0),max(dy,0))+min(max(dx,dy),0)-r

def color_mix(a,b,t):
    return int(a*(1-t)+b*t+.5)

def render(size,outfile):
    scan=bytearray()
    for row in range(size):
        scan.append(0)
        for col in range(size):
            x=(col+.5)/size
            y=(row+.5)/size
            depth=.55*x+.45*y
            light=max(0,1-math.hypot(x-.23,y-.15)*1.2)
            bg=(round(13+15*depth+8*light),
                round(40+32*depth+13*light),
                round(44+27*depth+12*light))
            shape=min(
                rounded(x,y,.265,.230,.385,.762,.049),
                rounded(x,y,.340,.405,.630,.520,.05),
                rounded(x,y,.535,.445,.665,.762,.050)
            )
            softness=max(.0017,1/size)
            alpha=max(0,min(1,.5-shape/softness))
            alpha=alpha*alpha*(3-2*alpha)
            rgb=tuple(color_mix(a,b,alpha) for a,b in zip(bg,(237,245,226)))
            circle=math.hypot(x-.742,y-.708)-.057
            gold=max(0,min(1,.5-circle/softness))
            gold=gold*gold*(3-2*gold)
            rgb=tuple(color_mix(a,b,gold) for a,b in zip(rgb,(205,168,120)))
            scan.extend((*rgb,255))
    def chunk(tag,body):
        return (struct.pack('>I',len(body))+tag+body+
                struct.pack('>I',zlib.crc32(tag+body)&0xffffffff))
    png=b'\x89PNG\r\n\x1a\n'
    png+=chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))
    png+=chunk(b'IDAT',zlib.compress(scan,9))
    png+=chunk(b'IEND',b'')
    outfile.parent.mkdir(parents=True,exist_ok=True)
    outfile.write_bytes(png)
    print(outfile.relative_to(ROOT),len(png),'bytes')

if __name__=='__main__':
    render(1024,ROOT/'docs/haiz-app-icon-1024.png')
    for dirname,size in [
        ('mipmap-mdpi',48),('mipmap-hdpi',72),
        ('mipmap-xhdpi',96),('mipmap-xxhdpi',144),('mipmap-xxxhdpi',192)]:
        render(size,RES/dirname/'ic_launcher.png')
