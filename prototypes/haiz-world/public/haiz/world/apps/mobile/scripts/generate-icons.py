#!/usr/bin/env python3
"""Original LUCENT native artwork. Pillow only; no external fonts/images.
SVG masters and raster resources share the same geometry. Run from any directory.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

MOBILE = Path(__file__).resolve().parents[1]
BRAND = MOBILE / 'brand'
ANDROID = MOBILE / 'android/app/src/main/res'
IOS = MOBILE / 'ios/App/App/Assets.xcassets'
DARK = '#0E121D'
PAPER = '#F0F2F8'
PORCELAIN = '#F3F1EC'
WARM = '#F0A77B'
# Folded H: two paper edges with opposite cuts; a warm folded connective page.
H = [([(250,280),(366,314),(366,744),(250,710)], PAPER),
     ([(658,280),(774,314),(774,744),(658,710)], PAPER),
     ([(366,462),(658,370),(658,492),(366,584)], WARM)]
TREE = [([(476,440),(548,440),(548,750),(476,750)], WARM),
        ([(302,754),(722,754),(722,790),(302,790)], PAPER)]
COAST = [([(512,236),(584,456),(788,512),(584,568),(512,788),(440,568),(236,512),(440,456)], PAPER),
         ([(512,356),(554,484),(678,512),(554,540),(512,668),(470,540),(346,512),(470,484)], DARK)]

def polygons(direction):
    return H if direction == 'fold' else TREE if direction == 'canopy' else COAST

def svg(direction, background=True):
    shapes = [f'<rect width="1024" height="1024" fill="{DARK}"/>'] if background else []
    for points, fill in polygons(direction):
        shapes.append(f'<polygon points="{" ".join(f"{x},{y}" for x,y in points)}" fill="{fill}"/>')
    if direction == 'canopy':
        shapes += [f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{PAPER}"/>' for x,y,rx,ry in [(368,386,158,106),(642,386,158,106),(512,286,146,96)]]
    if direction == 'coast':
        shapes.append(f'<circle cx="512" cy="512" r="32" fill="{WARM}"/>')
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">\n'+'\n'.join(shapes)+'\n</svg>\n'

def emblem(size, direction='fold', adaptive=False, dark=False, mono=False):
    # Supersample all sizes, including the 48px launcher; no jagged fractional cuts.
    canvas = Image.new('RGBA', (size*4,size*4), (0,0,0,0))
    draw = ImageDraw.Draw(canvas)
    factor = .82 if adaptive else 1
    def p(x): return (512+(x-512)*factor)*size*4/1024
    for points, fill in polygons(direction):
        if mono: fill = '#FFFFFF'
        elif dark and fill == PAPER: fill = DARK
        draw.polygon([(p(x),p(y)) for x,y in points], fill=fill)
    if direction == 'canopy':
        for x,y,rx,ry in [(368,386,158,106),(642,386,158,106),(512,286,146,96)]:
            draw.ellipse((p(x-rx),p(y-ry),p(x+rx),p(y+ry)), fill=DARK if dark else PAPER)
    if direction == 'coast':
        draw.ellipse((p(480),p(480),p(544),p(544)), fill=WARM)
    return canvas.resize((size,size),Image.Resampling.LANCZOS)

def icon(size, direction='fold'):
    image=Image.new('RGBA',(size,size),DARK)
    image.alpha_composite(emblem(size,direction))
    return image.convert('RGB')

def save(image,path):
    path.parent.mkdir(parents=True,exist_ok=True)
    image.save(path,format='PNG',optimize=True)

def splash(dimensions,night=False):
    image=Image.new('RGB',dimensions,DARK if night else PORCELAIN)
    # Artwork is modest and never becomes an obstructive launch film.
    art=emblem(round(min(dimensions)*.30),dark=not night)
    image.paste(art,((image.width-art.width)//2,(image.height-art.height)//2),art)
    return image

def vector(mono=True, adaptive=True):
    paths=[]
    for points, fill in H:
        value='M'+' L'.join(f'{x},{y}' for x,y in points)+' Z'
        paths.append(f'    <path android:fillColor="{"#FFFFFFFF" if mono else fill}" android:pathData="{value}"/>')
    return '<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="1024" android:viewportHeight="1024">\n'+f'<group android:scaleX="{.82 if adaptive else 1.4}" android:scaleY="{.82 if adaptive else 1.4}" android:pivotX="512" android:pivotY="512">\n'+'\n'.join(paths)+'\n</group>\n</vector>\n'

def main():
    BRAND.mkdir(exist_ok=True)
    for direction in ['fold','canopy','coast']:
        (BRAND/f'direction-{direction}.svg').write_text(svg(direction))
        save(icon(512,direction),BRAND/f'direction-{direction}.png')
        save(icon(48,direction),BRAND/f'direction-{direction}-48.png')
    (BRAND/'app-icon.svg').write_text(svg('fold'))
    save(icon(1024),IOS/'AppIcon.appiconset/AppIcon-512@2x.png')
    for density,size in {'mdpi':48,'hdpi':72,'xhdpi':96,'xxhdpi':144,'xxxhdpi':192}.items():
        dest=ANDROID/('mipmap-'+density)
        save(icon(size),dest/'ic_launcher.png')
        rounded=icon(size).convert('RGBA')
        mask=Image.new('L',(size*4,size*4),0)
        ImageDraw.Draw(mask).ellipse((0,0,size*4-1,size*4-1),fill=255)
        rounded.putalpha(mask.resize((size,size),Image.Resampling.LANCZOS))
        save(rounded,dest/'ic_launcher_round.png')
        save(emblem(round(size*2.25),adaptive=True),dest/'ic_launcher_foreground.png')
    (ANDROID/'values/ic_launcher_background.xml').write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#0E121D</color></resources>\n')
    for name in ['ic_launcher','ic_launcher_round']:
        for qualifier in ['mipmap-anydpi-v26','mipmap-anydpi-v33']:
            directory=ANDROID/qualifier;directory.mkdir(exist_ok=True)
            mono='\n    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>' if qualifier.endswith('33') else ''
            (directory/(name+'.xml')).write_text('<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>'+mono+'\n</adaptive-icon>\n')
    (ANDROID/'drawable/ic_launcher_monochrome.xml').write_text(vector())
    (ANDROID/'drawable/ic_stat_haiz.xml').write_text(vector(adaptive=False))
    for destination in sorted(ANDROID.glob('drawable*/splash.png')):
        if '-night' in destination.parent.name: continue
        dimensions=Image.open(destination).size
        save(splash(dimensions),destination)
        nightdir=destination.parent.name.replace('drawable-port','drawable-port-night',1).replace('drawable-land','drawable-land-night',1)
        if nightdir == 'drawable': nightdir='drawable-night'
        save(splash(dimensions,True),ANDROID/nightdir/'splash.png')
    images=[]
    for scale,name in [('1x','splash-2732x2732-2.png'),('2x','splash-2732x2732-1.png'),('3x','splash-2732x2732.png')]:
        save(splash((2732,2732)),IOS/'Splash.imageset'/name)
        nightname=name.replace('.png','-dark.png')
        save(splash((2732,2732),True),IOS/'Splash.imageset'/nightname)
        images += [{'idiom':'universal','filename':name,'scale':scale},{'idiom':'universal','filename':nightname,'scale':scale,'appearances':[{'appearance':'luminosity','value':'dark'}]}]
    (IOS/'Splash.imageset/Contents.json').write_text(json.dumps({'images':images,'info':{'version':1,'author':'xcode'}},indent=2)+'\n')
    sheet=Image.new('RGB',(1200,490),PORCELAIN)
    draw=ImageDraw.Draw(sheet)
    for i,(direction,label) in enumerate([('fold','A / FOLDED H — SELECTED'),('canopy','B / TREE CANOPY'),('coast','C / COAST COMPASS')]):
        x=i*400
        sheet.paste(icon(300,direction),(x+50,40))
        sheet.paste(icon(48,direction),(x+50,380))
        draw.text((x+115,386),label,fill=DARK)
        draw.text((x+115,410),'48 px / native size',fill=DARK)
    save(sheet,BRAND/'directions-review.png')
    print('PASS: LUCENT SVG, adaptive/themed icons and light/dark launch assets generated.')

if __name__=='__main__': main()
