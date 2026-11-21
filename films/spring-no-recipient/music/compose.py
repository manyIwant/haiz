"""Original score + sound design for 《春天没有收件人》.

Everything is written here as notes (no samples of existing music). Instruments are the
General MIDI voices of the FluidR3 GM soundfont (MIT licence), rendered with FluidSynth.
Timing comes from film/cues.js so picture and sound stay in sync.

    python3 music/compose.py        ->  build/audio/score.wav, build/audio/mix.wav

The key / harmony / melody are original: D major, ~72 bpm, slow pentatonic phrases.
The music deliberately does not hit every cut; it breathes, thins out under explanation,
opens up for the poems and falls completely silent for one line of the second poem.
"""
import json, math, pathlib, subprocess, random
import numpy as np
import pretty_midi
import soundfile as sf

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "build/audio"; OUT.mkdir(parents=True, exist_ok=True)
SF2 = "/usr/share/sounds/sf2/FluidR3_GM.sf2"
SR = 48000

def load_cues():
    s = (ROOT / "film/cues.js").read_text(encoding="utf-8")
    body = s.rsplit("window.CUES =", 1)[1].strip().rstrip(";")
    return json.loads(body)

C = load_cues()
DUR = C["duration"]
M = C["music"]
B = 60 / 72          # one beat
BAR = 4 * B

def n(name):
    return pretty_midi.note_name_to_number(name)

CH = {  # chord voicings (low -> high)
    "Dmaj9": ["D2", "A2", "F#3", "C#4", "E4"],
    "D":     ["D2", "A2", "D3", "F#3", "A3"],
    "Dadd9": ["D2", "A2", "E3", "F#3", "A3"],
    "D/F#":  ["F#2", "D3", "A3", "D4"],
    "Bm7":   ["B1", "F#2", "A3", "D4", "F#4"],
    "Gmaj7": ["G1", "D2", "F#3", "B3", "D4"],
    "G":     ["G1", "D2", "G3", "B3", "D4"],
    "A/G":   ["G1", "E3", "A3", "C#4"],
    "Asus4": ["A1", "E2", "D3", "E3", "A3"],
    "A":     ["A1", "E2", "C#3", "E3", "A3"],
    "A7sus": ["A1", "E2", "D3", "G3", "A3"],
    "F#m7":  ["F#1", "C#2", "E3", "A3", "C#4"],
    "Em7":   ["E2", "B2", "D3", "G3", "B3"],
}

class Stem:
    def __init__(self, name, program):
        self.name = name
        self.inst = pretty_midi.Instrument(program=program, name=name)
    def note(self, t, d, pitch, vel):
        if t >= DUR: return
        p = n(pitch) if isinstance(pitch, str) else pitch
        self.inst.notes.append(pretty_midi.Note(velocity=int(max(1, min(127, vel))), pitch=p, start=t, end=min(t + d, DUR)))
    def cc(self, t, num, val):
        self.inst.control_changes.append(pretty_midi.ControlChange(number=num, value=int(max(0, min(127, val))), time=max(0, t)))
    def expr_ramp(self, t0, t1, v0, v1, steps=24):
        for i in range(steps + 1):
            u = i / steps
            self.cc(t0 + (t1 - t0) * u, 11, v0 + (v1 - v0) * u)

piano = Stem("piano", 0)
harp = Stem("harp", 46)
strings = Stem("strings", 49)   # slow strings
pad = Stem("pad", 89)           # warm pad
choir = Stem("choir", 52)
celesta = Stem("celesta", 8)
for s in (strings, pad, choir): s.cc(0, 11, 100)

rng = random.Random(72)
def hum(v, spread=6): return v + rng.uniform(-spread, spread)

def up(names, octaves=1):
    return [n(x) + 12 * octaves for x in names]

def sustain(stem, chord, t, d, vel, top=None):
    names = CH[chord]
    for p in names[:top] if top else names:
        stem.note(t, d, p, hum(vel, 3))

def arp(stem, chord, t, bars, vel, step=B / 2, pattern=(0, 2, 3, 4, 3, 2), octave=1, skip=0.0):
    tones = up(CH[chord][1:], octave - 1)
    k, tt = 0, t
    while tt < t + bars * BAR - 1e-6:
        if rng.random() >= skip:
            stem.note(tt, step * 2.6, tones[pattern[k % len(pattern)] % len(tones)], hum(vel))
        k += 1; tt += step

def bass(stem, chord, t, d, vel):
    stem.note(t, d, n(CH[chord][0]) + 12, hum(vel, 3))

# melodic material (original): pentatonic phrases in D
MOTIF1 = [("A4", 1), ("B4", .5), ("D5", 1.5), ("E5", 1), ("D5", .5), ("B4", 1.5), ("A4", 1), ("F#4", 1), ("E4", 2)]
MOTIF2 = [("D5", 1), ("E5", .5), ("F#5", 1.5), ("A5", 1), ("F#5", .5), ("E5", 1.5), ("D5", 1), ("B4", 1), ("A4", 2)]
MOTIF3 = [("F#5", 1.5), ("E5", .5), ("D5", 1), ("B4", 1), ("A4", 2), ("B4", 1), ("D5", 1), ("E5", 2)]
def melody(stem, motif, t, vel, octave=0, stretch=1.0):
    for name, beats in motif:
        stem.note(t, beats * B * stretch * 1.05, n(name) + 12 * octave, hum(vel, 4))
        t += beats * B * stretch
    return t

def progression(t0, t1, chords, bars_each, fn):
    t, i = t0, 0
    while t < t1 - 0.5:
        ch = chords[i % len(chords)]
        d = min(bars_each * BAR, t1 - t)
        fn(ch, t, d, i)
        t += bars_each * BAR; i += 1

# ---------------------------------------------------------------- 0–58: real terminal
t = M["firstNote"]
piano.note(t, 6, "D2", 52); piano.note(t, 6, "D3", 44); piano.note(t + .01, 6, "A3", 30)
pad.note(t, 5.5, "D3", 34); pad.note(t, 5.5, "A3", 30)
def proc(ch, t, d, i):
    sustain(pad, ch, t, d + .4, 36, top=4)
    bass(piano, ch, t, B * 3, 40)
    hi = up(CH[ch][2:], 1)
    piano.note(t + 2 * B, B * 2, hi[i % len(hi)], hum(36))
    if i % 2 == 1:
        piano.note(t + 3 * B, B * 1.5, hi[(i + 1) % len(hi)], hum(32))
progression(M["processIn"], 57.6, ["Dmaj9", "Bm7", "Gmaj7", "Asus4"], 1, proc)

# ---------------------------------------------------------------- 58–118: mechanism
def mech(ch, t, d, i):
    sustain(strings, ch, t, d + .3, 40, top=4)
    piano.note(t, B * 3, n(CH[ch][0]) + 12, hum(42))
    if not (100.0 <= t < 108.0):  # thin out under the code card
        arp(harp, ch, t, d / BAR, 40, step=B / 2, pattern=(0, 1, 2, 3, 2, 1, 3, 2), octave=2)
progression(M["mechanismIn"], 117.5, ["Bm7", "Gmaj7", "D/F#", "Asus4", "Bm7", "Gmaj7", "Em7", "A"], 1, mech)
strings.expr_ramp(116.5, 118.2, 100, 70)

# ---------------------------------------------------------------- 118–176: third corpus, window sweep
strings.cc(118.2, 11, 100)
progression(118.0, 156.8, ["Dmaj9", "Bm7", "Gmaj7", "Asus4"], 1, proc)
def sweep(ch, t, d, i):
    sustain(pad, ch, t, d + .5, 34, top=4)
    hi = up(CH[ch][2:], 2)
    for k in range(3):
        celesta.note(t + k * 2 * B + B, B * 2, hi[(i + k) % len(hi)], hum(34))
progression(157.0, 176.0, ["Gmaj7", "D/F#", "Em7"], 2, sweep)

# ---------------------------------------------------------------- 176–222: the junction
for k in range(int((186 - 176.4) / (B / 2))):
    piano.note(176.4 + k * B / 2, B * .6, "A4", 24 + k * .6)
sustain(pad, "Bm7", 176.0, 10.5, 32, top=4)
build = [("Em7", 186.0), ("F#m7", 189.33), ("Gmaj7", 192.67), ("Asus4", 196.0), ("A", 197.8)]
for (ch, t0), nxt in zip(build, build[1:] + [(None, M["junctionLand"])]):
    sustain(strings, ch, t0, nxt[1] - t0 + .15, 70)
    for k in range(int((nxt[1] - t0) / (B / 2))):
        p = up(CH[ch][2:], 1)[k % 3]
        piano.note(t0 + k * B / 2, B * .55, p, 34 + (t0 - 186) * 2.2)
strings.expr_ramp(186.0, 199.3, 40, 118)
L = M["junctionLand"]
strings.cc(L, 11, 112)
for p in ["G1", "G2", "D3", "B3", "D4", "G4", "B4"]: piano.note(L, 7, p, 78)
sustain(strings, "G", L, 9, 82); sustain(choir, "G", L + .05, 8, 54, top=4)
strings.expr_ramp(L + 1, L + 9, 112, 70)
def calm(ch, t, d, i):
    sustain(strings, ch, t, d + .4, 52, top=4)
    bass(piano, ch, t, B * 4, 46)
progression(L + 6.67, 222.0, ["D/F#", "Em7", "Asus4", "Gmaj7"], 2, calm)
melody(piano, MOTIF1, 207.0, 56, stretch=1.15)

# ---------------------------------------------------------------- 222–246: the small poem of this run
def small(ch, t, d, i):
    sustain(pad, ch, t, d + .5, 30, top=4)
    arp(piano, ch, t, d / BAR, 30, step=B, pattern=(0, 2, 3, 2), octave=1)
progression(M["smallpoem"], 245.0, ["Dmaj9", "Bm7", "Gmaj7", "Asus4"], 1.5, small)

# ---------------------------------------------------------------- 246–320: poem 1
P1 = M["poem1"]
piano.note(P1, 8, "D2", 56); piano.note(P1, 8, "A2", 50); piano.note(P1 + .4, 7, "F#4", 44)
sustain(pad, "Dmaj9", P1, 6, 36, top=4)
def p1(ch, t, d, i):
    sustain(strings, ch, t, d + .5, 52 + min(i, 8), top=4)
    arp(piano, ch, t, d / BAR, 42, step=B / 2, pattern=(0, 1, 2, 3, 2, 1), octave=1, skip=.25)
progression(P1 + 5.0, 311.0, ["Dmaj9", "Bm7", "Gmaj7", "D/F#", "Em7", "Asus4"], 2, p1)
mt = P1 + 5.0 + 2 * BAR
for k, motif in enumerate([MOTIF1, MOTIF2, MOTIF3, MOTIF1]):
    if mt > 300: break
    melody(piano, motif, mt, 62 if k != 2 else 68, stretch=1.1)
    mt += 4 * BAR
def p1page(ch, t, d, i):
    sustain(pad, ch, t, d + .8, 38, top=4)
    piano.note(t, d, n(CH[ch][0]) + 12, 42)
progression(311.0, 319.4, ["Gmaj7", "Asus4"], 1.25, p1page)
pad.expr_ramp(317.5, 320.0, 100, 0)

# ---------------------------------------------------------------- 320–334: interlude (almost nothing)
pad.cc(320.2, 11, 100)
strings.cc(320.0, 11, 70)
strings.note(320.5, 13, "A4", 26); strings.note(321.5, 12, "E5", 20)
piano.note(327.0, 5, "D5", 26)

# ---------------------------------------------------------------- 334–367: poem 2, first half
P2 = M["poem2"]
strings.cc(334.0, 11, 90)
piano.note(P2, 7, "D2", 54); piano.note(P2 + .02, 7, "F#5", 42)
sustain(pad, "G", P2, 6.5, 34, top=4)
def p2(ch, t, d, i):
    sustain(strings, ch, t, d + .4, 54, top=4)
    arp(piano, ch, t, d / BAR, 42, step=B / 2, pattern=(0, 2, 3, 4, 3, 2), octave=1)
progression(340.0, 365.8, ["G", "A/G", "F#m7", "Bm7"], 2, p2)
strings.expr_ramp(340, 362, 80, 104)
melody(piano, MOTIF2, 353.0, 60, stretch=1.1)
# the music leaves before "河流还不知道自己的名字" settles
for s in (strings, pad, choir): s.expr_ramp(365.5, 367.0, 104, 0)
SIL0, SIL1 = M["silenceStart"], M["silenceEnd"]
for s in (piano, harp, strings, pad, choir, celesta):
    for nt in s.inst.notes:
        if nt.start < SIL0 and nt.end > SIL0 - .6 and nt.start > 300: nt.end = min(nt.end, SIL0 - .3)

# ---------------------------------------------------------------- 375–408: the peak, then letting go
PK = M["poem2Peak"]
for s in (strings, choir): s.cc(PK - .05, 11, 118)
peak = ["G", "A", "F#m7", "Bm7", "Em7", "A7sus", "Dmaj9", "Gmaj7", "Asus4", "D"]
for i, ch in enumerate(peak):
    t0 = PK + i * BAR
    v = 92 - i * 5
    sustain(strings, ch, t0, BAR + .3, v)
    if i < 6: sustain(choir, ch, t0, BAR + .2, v - 30, top=4)
    piano.note(t0, BAR, n(CH[ch][0]) + 12, v - 16)
    arp(piano, ch, t0, 1, max(30, v - 44), step=B / 2, pattern=(0, 2, 3, 4, 3, 2), octave=1)
melody(piano, MOTIF2, PK, 82, octave=0)
melody(piano, MOTIF2, PK, 64, octave=1)
melody(piano, MOTIF3, PK + 3 * BAR, 66, stretch=1.1)
strings.expr_ramp(PK + 4 * BAR, 408.0, 118, 64)
choir.expr_ramp(PK + 3 * BAR, PK + 6 * BAR, 118, 0)

# ---------------------------------------------------------------- 408–446: page, ending, credits
def page2(ch, t, d, i):
    sustain(pad, ch, t, d + 1, 30, top=4)
    arp(piano, ch, t, d / BAR, 28, step=B, pattern=(0, 2, 3, 2), octave=1)
pad.cc(408.0, 11, 100)
progression(408.0, 417.6, ["Dmaj9", "Gmaj7"], 1.5, page2)
E = M["ending"]
for t0, p, v in [(E + 1.0, "A4", 40), (E + 3.0, "F#4", 36), (E + 5.4, "D4", 34)]:
    piano.note(t0, 5, p, v)
for p in CH["Dadd9"]: piano.note(E + 6.4, 6, p, 32)
CR = M["credits"]
sustain(pad, "Dmaj9", CR, 18, 28, top=4)
melody(piano, MOTIF1, CR + 1.5, 34, stretch=1.35)
pad.expr_ramp(DUR - 6, DUR - .5, 100, 0)

# ---------------------------------------------------------------- render stems
STEMS = {  # stem: (fluidsynth gain, sox reverb args, mix gain)
    "piano":   (piano,   0.9, "reverb 42 45 85 100 12", 1.00),
    "harp":    (harp,    0.7, "reverb 55 50 90 100 18", 0.55),
    "strings": (strings, 0.8, "reverb 70 55 100 100 20", 0.62),
    "pad":     (pad,     0.7, "reverb 80 60 100 100 25", 0.45),
    "choir":   (choir,   0.7, "reverb 80 60 100 100 25", 0.40),
    "celesta": (celesta, 0.7, "reverb 65 50 95 100 20", 0.45),
}

def render_stem(name, stem, gain, rev):
    pm = pretty_midi.PrettyMIDI(initial_tempo=72)
    pm.instruments.append(stem.inst)
    mid = OUT / f"{name}.mid"; dry = OUT / f"{name}_dry.wav"; wet = OUT / f"{name}.wav"
    pm.write(str(mid))
    subprocess.run(["fluidsynth", "-ni", "-q", "-R", "0", "-C", "0", "-g", str(gain), "-r", str(SR), "-F", str(dry), SF2, str(mid)], check=True)
    subprocess.run(["sox", "-q", str(dry), str(wet)] + rev.split() + ["pad", "0", "4"], check=True)
    x, sr = sf.read(str(wet), always_2d=True)
    assert sr == SR
    return x

def fit(x):
    N = int(DUR * SR); y = np.zeros((N, 2))
    m = min(N, len(x)); y[:m] = x[:m, :2] if x.shape[1] >= 2 else np.repeat(x[:m], 2, axis=1)
    return y

score = np.zeros((int(DUR * SR), 2))
for name, (stem, g, rev, mg) in STEMS.items():
    if not stem.inst.notes: continue
    score += fit(render_stem(name, stem, g, rev)) * mg
# hard silence window (sox reverb tails included)
a, b = int((SIL0 + .25) * SR), int(SIL1 * SR)
fade_len = int(.25 * SR)
score[a - fade_len:a] *= np.linspace(1, 0, fade_len)[:, None]
score[a:b] = 0
# gentle mix automation: let the poems sit a little forward
env = np.ones(len(score))
for t0, t1, db in [(244.0, 320.0, 3.5), (332.0, 366.0, 2.0), (395.0, 440.0, 2.0)]:
    g = 10 ** (db / 20); i0, i1 = int(t0 * SR), int(t1 * SR); r = int(2.0 * SR)
    env[i0:i1] = g
    env[i0 - r:i0] = np.linspace(1, g, r); env[i1:i1 + r] = np.linspace(g, 1, r)
score *= env[:, None]
sf.write(str(OUT / "score.wav"), score.astype(np.float32), SR)

# ---------------------------------------------------------------- sound design
N = len(score)
sfx = np.zeros_like(score)
nrng = np.random.default_rng(7)
def place(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    sig = sig[: N - i]
    l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    sfx[i:i + len(sig), 0] += sig * gain * l * 1.41
    sfx[i:i + len(sig), 1] += sig * gain * r * 1.41

def click(heavy=False):
    L = int(.05 * SR); tt = np.arange(L) / SR
    noise = nrng.normal(0, 1, L) * np.exp(-tt * (260 if not heavy else 160))
    from scipy.signal import butter, lfilter
    b1, a1 = butter(2, [1800 / (SR / 2), 7000 / (SR / 2)], btype="band")
    s = lfilter(b1, a1, noise) * .9
    thump = np.sin(2 * np.pi * (120 if heavy else 180) * tt) * np.exp(-tt * 90) * (.5 if heavy else .25)
    return s + thump

def bell(freq, dur=1.6):
    L = int(dur * SR); tt = np.arange(L) / SR
    env = np.exp(-tt * 3.2) * (1 - np.exp(-tt * 400))
    return (np.sin(2 * np.pi * freq * tt) + .32 * np.sin(2 * np.pi * freq * 2.76 * tt) * np.exp(-tt * 6)) * env * .5

def whoosh(dur=1.6):
    from scipy.signal import butter, lfilter
    L = int(dur * SR); tt = np.arange(L) / SR
    x = nrng.normal(0, 1, L)
    b1, a1 = butter(2, [300 / (SR / 2), 2400 / (SR / 2)], btype="band")
    x = lfilter(b1, a1, x)
    env = np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 2
    return x * env * .18

# typing: the real key times from the recording, mapped through the film's time remap
def rec_to_film(rt):
    for s in C["termSegments"]:
        r0, r1 = s["rec"]; f0, f1 = s["film"]
        if r1 > r0 and r0 <= rt < r1:
            return f0 + (rt - r0) / (r1 - r0) * (f1 - f0), (f1 - f0) / (r1 - r0)
    return None, None
keys = [l.split(" ", 1) for l in (ROOT / "recording/keys.txt").read_text(encoding="utf-8").splitlines()]
t_first = float(keys[0][0]); REC_FIRST_KEY = 7.55   # first key echo seen in the recording
for ts, ch in keys:
    rt = float(ts) - t_first + REC_FIRST_KEY
    ft, rate = rec_to_film(rt)
    if ft is None: continue
    heavy = ch.strip().startswith("ENTER")
    place(click(heavy), ft, (.55 if heavy else .32) * (1 if rate >= .9 else .8), pan=nrng.uniform(-.15, .15))

PENTA = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66]
for i, e in enumerate(json.loads((ROOT / "data/sfx.json").read_text())):
    if e["type"] == "pick": place(bell(PENTA[i % len(PENTA)]), e["t"], .16, pan=(i % 3 - 1) * .2)
    elif e["type"] == "key": place(click(), e["t"], .3)
    elif e["type"] == "whoosh": place(whoosh(), e["t"] - .9, .9)
    elif e["type"] == "select":
        for k, f in enumerate([880.0, 987.77, 1174.66, 1318.5, 1479.98, 1760.0, 1975.5]):
            place(bell(f, 2.2), e["t"] + k * .12, .07, pan=(k / 3 - 1) * .5)

# room tone under the real terminal (very quiet, filtered)
from scipy.signal import butter, lfilter
room = lfilter(*butter(2, 900 / (SR / 2)), nrng.normal(0, 1, N)) * .006
mask = np.zeros(N)
for a0, a1 in [(0.5, 58.5), (117.5, 157.5), (319.5, 334.5)]:
    i0, i1 = int(a0 * SR), int(a1 * SR); L = i1 - i0
    mask[i0:i1] = np.minimum(1, np.minimum(np.arange(L), L - np.arange(L)) / (1.0 * SR))
sfx[:, 0] += room * mask; sfx[:, 1] += np.roll(room, 977) * mask

mix = score * 0.9 + sfx
sf.write(str(OUT / "sfx.wav"), sfx.astype(np.float32), SR)
sf.write(str(OUT / "mix.wav"), mix.astype(np.float32), SR)
print("peak", float(np.abs(mix).max()), "duration", len(mix) / SR)
