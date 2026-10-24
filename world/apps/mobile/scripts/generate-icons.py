#!/usr/bin/env python3
"""Deterministic HAIZ mobile art: iOS opaque icon, Android adaptive/legacy icons and both launch images.
Requires Pillow (build-time only): python -m pip install pillow
Run: python world/apps/mobile/scripts/generate-icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math

MOBILE = Path(__file__).resolve().parents[1]
ANDROID = MOBILE / "android/app/src/main/res"
IOS = MOBILE / "ios/App/App/Assets.xcassets"
CREAM = (244, 241, 229)
DARK = (25, 58, 49)
WARM = (218, 182, 129)

def emblem(size, foreground=False, dark=False):
    scale = size / 1024
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    def p(v): return round(v * scale)
    ink = DARK if dark else (246, 237, 218)
    if foreground:
        # Safe central ~58% for adaptive mask crops; leave outer 21% transparent.
        factor = .66
        ox = (1024-1024*factor)/2
        def v(x): return p(ox + x*factor)
        width = p(71*factor)
        d.arc((v(300),v(276),v(724),v(712)),180,360,fill=ink,width=width)
        d.line((v(300),v(494),v(300),v(765)),fill=ink,width=width)
        d.line((v(724),v(494),v(724),v(765)),fill=ink,width=width)
        d.ellipse((v(459),v(418),v(565),v(524)),fill=WARM)
        d.line((v(430),v(740),v(594),v(740)),fill=ink,width=p(37*factor))
    else:
        width = p(70)
        d.arc((p(300),p(276),p(724),p(712)),180,360,fill=ink,width=width)
        d.line((p(300),p(494),p(300),p(765)),fill=ink,width=width)
        d.line((p(724),p(494),p(724),p(765)),fill=ink,width=width)
        d.ellipse((p(459),p(418),p(565),p(524)),fill=WARM)
        d.line((p(430),p(740),p(594),p(740)),fill=ink,width=p(37))
    return img

def icon(size):
    img = Image.new("RGBA",(size,size))
    pix = img.load()
    for y in range(size):
        t=y/max(1,size-1)
        for x in range(size):
            fx=x/max(1,size-1)
            bloom=max(0,1-math.hypot(fx-.18,t-.07)*.85)
            pix[x,y]=(round(10+25*(1-t)+8*bloom),round(34+28*(1-t)+8*bloom),round(32+16*(1-t)+6*bloom),255)
    img.alpha_composite(emblem(size))
    return img.convert("RGB")

def save(img, path):
    path.parent.mkdir(parents=True,exist_ok=True)
    img.save(path,format="PNG",optimize=True)

def round_icon(size):
    square=icon(size).convert("RGBA")
    mask=Image.new("L",(size,size),0)
    ImageDraw.Draw(mask).ellipse((0,0,size-1,size-1),fill=255)
    square.putalpha(mask)
    return square

def splash(size):
    img=Image.new("RGB",(size,size),CREAM)
    art=emblem(round(size*.30),dark=True)
    img.paste(art,((size-art.width)//2,(size-art.height)//2),art)
    return img

def main():
    save(icon(1024),IOS/"AppIcon.appiconset/AppIcon-512@2x.png")
    for density,icon_size in {"mdpi":48,"hdpi":72,"xhdpi":96,"xxhdpi":144,"xxxhdpi":192}.items():
        dest=ANDROID/("mipmap-"+density)
        save(icon(icon_size),dest/"ic_launcher.png")
        save(round_icon(icon_size),dest/"ic_launcher_round.png")
        save(emblem(round(icon_size*2.25),foreground=True),dest/"ic_launcher_foreground.png")
    for dest in sorted(ANDROID.glob("drawable*/splash.png")):
        save(splash(512),dest)
    for name in ["splash-2732x2732.png","splash-2732x2732-1.png","splash-2732x2732-2.png"]:
        save(splash(2732),IOS/"Splash.imageset"/name)
    print("HAIZ visual assets generated for Android and iOS.")

if __name__=="__main__": main()
