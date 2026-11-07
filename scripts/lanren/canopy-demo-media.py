"""Development-sample media for chapter 03's demo works (lanren/canopy/demo/media).

Nothing here is a student's work. Provenance of every file:
  corridor-1/2/3, afternoon, one-day  renders of HAIZ's own digital tree, made with the
      repository's capture script (tests/lanren-capture.cjs, Q=medium HIDEUI=1 QS=&nocanopy):
        VW=1600 VH=1067 … 2 "L,12.0,6.85,4.2,11.3,6.6,3.9,2,18" "L,3.81,5.4,0.95,10.4,7.8,3.3,2.6,65"
        VW=1067 VH=1600 … 1          VW=1600 VH=900 … 5
      and passed to this script as --renders <dir with a/2.png a/look1.png a/look2.png b/1.png c/5.png>.
  veins.jpg   a crop of the site's own procedural leaf texture (lanren/assets/leaf-atlas-web.png).
  low-voice.wav  synthesised here: slow sine chords with a soft noise breath (no voice, no recording).

usage: python3 scripts/lanren/canopy-demo-media.py --renders <dir>
"""
import argparse
import math
import os
import random
import struct
import wave

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'lanren', 'canopy', 'demo', 'media')


def jpg(src, name, size, trim=6):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    im = im.crop((0, 0, w - trim, h))          # the walk rail's hairline sits at the right edge
    im = ImageOps.fit(im, size, Image.LANCZOS)
    im.save(os.path.join(OUT, name), quality=82, optimize=True, progressive=True)


def veins():
    atlas = Image.open(os.path.join(ROOT, 'lanren', 'assets', 'leaf-atlas-web.png')).convert('RGBA')
    w, h = atlas.size
    cell = atlas.crop((0, 0, w // 4, h))         # the first of four leaf variants
    bg = Image.new('RGBA', cell.size, (238, 232, 218, 255))
    bg.alpha_composite(cell)
    im = bg.convert('RGB')
    cw, ch = im.size
    im = im.crop((int(cw * 0.12), int(ch * 0.18), int(cw * 0.88), int(ch * 0.82)))
    ImageOps.fit(im, (1200, 1600), Image.LANCZOS).save(os.path.join(OUT, 'veins.jpg'), quality=82, optimize=True)


def audio(seconds=14, rate=16000):
    rnd = random.Random(2611)
    chords = [(196.0, 246.9, 293.7), (174.6, 220.0, 261.6), (164.8, 207.7, 246.9), (196.0, 246.9, 329.6)]
    n = seconds * rate
    frames = bytearray()
    noise = 0.0
    for i in range(n):
        t = i / rate
        k = min(len(chords) - 1, int(t / (seconds / len(chords))))
        local = (t % (seconds / len(chords))) / (seconds / len(chords))
        env = math.sin(math.pi * local) ** 1.5
        v = sum(math.sin(2 * math.pi * f * t + j) for j, f in enumerate(chords[k])) / 3 * env * 0.32
        noise = noise * 0.995 + (rnd.random() - 0.5) * 0.02
        v += noise * (0.6 + 0.4 * math.sin(t * 0.7))
        fade = min(1.0, t / 1.2, (seconds - t) / 1.5)
        frames += struct.pack('<h', int(max(-1, min(1, v * fade)) * 32767 * 0.8))
    with wave.open(os.path.join(OUT, 'low-voice.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(bytes(frames))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--renders', required=True)
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    r = a.renders
    jpg(os.path.join(r, 'a', '2.png'), 'corridor-1.jpg', (1600, 1067))
    jpg(os.path.join(r, 'a', 'look2.png'), 'corridor-2.jpg', (1600, 1067))
    jpg(os.path.join(r, 'b', '1.png'), 'corridor-3.jpg', (1067, 1600))
    jpg(os.path.join(r, 'a', 'look1.png'), 'afternoon.jpg', (1600, 1067))
    jpg(os.path.join(r, 'c', '5.png'), 'one-day.jpg', (1600, 900))
    veins()
    audio()
    for f in sorted(os.listdir(OUT)):
        print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, 'KB')
