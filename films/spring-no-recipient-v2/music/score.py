"""Original score and sound design for 《春天没有收件人》 (v2).

No samples of existing music or recordings are used. The piano is the General MIDI grand of
the FluidR3 GM soundfont (MIT) rendered by FluidSynth; everything else (pads, bells, water,
wind, reeds, birds, clocks, keyboard) is synthesised here with numpy.

    python3 music/score.py      -> build/audio/mix.wav (48 kHz stereo, before loudness norm)

The timeline mirrors film/term.js (terminal, 0-42 s) and film/film.js (world, 42-178.6 s).
Harmony: A-flat major for the dusk of poem one, falling into F minor at nightfall; the shadow
sweep is reversed piano (time running backwards) arriving in C major for the morning of poem
two; at 「河流还不知道自己的名字」 music and world both stop; the end is the river alone.
"""
import datetime, json, math, pathlib, subprocess, tempfile
import numpy as np
import pretty_midi
import soundfile as sf
from scipy import signal

ROOT = pathlib.Path(__file__).resolve().parent.parent
V1 = ROOT.parent / "spring-no-recipient"
OUT = ROOT / "build" / "audio"; OUT.mkdir(parents=True, exist_ok=True)
SF2 = "/usr/share/sounds/sf2/FluidR3_GM.sf2"
SR = 48000
DUR = 178.6
N = int(DUR * SR)
rng = np.random.default_rng(2026)

mix = {k: np.zeros((N, 2), np.float32) for k in ("music", "amb", "sfx")}

# ---------------------------------------------------------------- utilities
def t2i(t): return int(round(t * SR))

def place(bus, sig, t, gain=1.0, pan=0.0):
    if sig.ndim == 1:
        l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
        sig = np.stack([sig * l * 1.414, sig * r * 1.414], -1)
    i = t2i(t)
    if i >= N: return
    j = min(N, i + len(sig))
    if i < 0: sig = sig[-i:]; i = 0
    mix[bus][i:j] += sig[: j - i] * gain

def env_ar(n, a, r, sr=SR):
    e = np.ones(n)
    na, nr = int(a * sr), int(r * sr)
    if na: e[:na] = np.linspace(0, 1, na) ** 2
    if nr: e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e

def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)

def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="low", fs=SR, output="sos"), x, axis=0)

def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x, axis=0)

def smooth_noise(n, rate, seed):
    """Slowly varying random control signal in 0..1 (rate ~ changes per second)."""
    r = np.random.default_rng(seed)
    k = max(2, int(n / SR * rate) + 2)
    pts = r.random(k)
    x = np.linspace(0, k - 1, n)
    i = np.floor(x).astype(int); f = x - i; f = f * f * (3 - 2 * f)
    return pts[i] * (1 - f) + pts[np.minimum(i + 1, k - 1)] * f

def pink(n, seed):
    r = np.random.default_rng(seed)
    w = r.standard_normal(n)
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, w)

def gate(n, t0, t1, fade=1.0):
    """0..1 window over the whole timeline."""
    tt = np.arange(n) / SR
    return np.clip(np.minimum((tt - t0) / fade, (t1 - tt) / fade), 0, 1) ** 1.5

def reverb_ir(seconds=3.2, seed=5, damp=0.6):
    n = int(seconds * SR)
    r = np.random.default_rng(seed)
    tt = np.arange(n) / SR
    ir = r.standard_normal((n, 2)) * np.exp(-tt * 6.9 / seconds)[:, None]
    # darker as it decays
    lo = lp(ir, 9000); hi = ir - lo
    ir = lo + hi * np.exp(-tt * 4 / damp)[:, None]
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum(0, keepdims=True))

def convolve(x, ir, wet):
    y = np.stack([signal.oaconvolve(x[:, c].astype(np.float32), ir[:, c].astype(np.float32))[: len(x)] for c in range(2)], -1)
    return (x * (1 - wet) + y * wet).astype(np.float32)

# ---------------------------------------------------------------- piano via FluidSynth
def render_midi(notes, program=0, gain=0.9):
    """notes: list of (t, dur, pitch, vel). Returns stereo float array aligned to t=0."""
    pm = pretty_midi.PrettyMIDI(initial_tempo=60)
    inst = pretty_midi.Instrument(program=program)
    for t, d, p, v in notes:
        inst.notes.append(pretty_midi.Note(velocity=int(np.clip(v, 1, 127)), pitch=int(p), start=max(0, t), end=max(0, t) + d))
    inst.control_changes.append(pretty_midi.ControlChange(64, 127, 0.0))  # sustain pedal held (we lift by note length)
    inst.control_changes.append(pretty_midi.ControlChange(64, 0, 0.01))
    pm.instruments.append(inst)
    with tempfile.TemporaryDirectory() as d:
        mid, wav = pathlib.Path(d) / "a.mid", pathlib.Path(d) / "a.wav"
        pm.write(str(mid))
        subprocess.run(["fluidsynth", "-ni", "-q", "-g", str(gain), "-r", str(SR), "-R", "0", "-C", "0", "-F", str(wav), SF2, str(mid)], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        a, sr = sf.read(str(wav))
    assert sr == SR
    return a if a.ndim == 2 else np.stack([a, a], -1)

NOTE = pretty_midi.note_name_to_number
def P(names): return [NOTE(n) for n in names.split()]

# ---------------------------------------------------------------- synth pad and bell
def pad_note(freq, dur, att=2.5, rel=3.5, bright=0.5, seed=0):
    n = int((dur + rel) * SR)
    tt = np.arange(n) / SR
    out = np.zeros((n, 2))
    r = np.random.default_rng(seed)
    for ch in range(2):
        s = np.zeros(n)
        for det in (-5, 0, 5):
            f = freq * 2 ** ((det + r.uniform(-1.5, 1.5)) / 1200)
            ph = r.random() * 6.28
            for h, amp in ((1, 1.0), (2, 0.45 * bright), (3, 0.22 * bright), (4, 0.10 * bright), (5, 0.05 * bright)):
                s += amp * np.sin(2 * np.pi * f * h * tt + ph * h)
        lfo = 1 + 0.06 * np.sin(2 * np.pi * (0.11 + 0.03 * ch) * tt + r.random() * 6)
        out[:, ch] = s * lfo
    e = np.ones(n); na = int(att * SR); e[:na] = np.linspace(0, 1, na) ** 1.6
    nd = int(dur * SR); e[nd:] = np.linspace(1, 0, n - nd) ** 2
    return lp(out * e[:, None], 2400) * 0.06

def pad_chord(t, dur, names, gain=1.0, **kw):
    for i, p in enumerate(P(names)):
        place("music", pad_note(440 * 2 ** ((p - 69) / 12), dur, seed=int(t * 10) + i, **kw), t, gain)

def bell(freq, dur=5.0, gain=0.3):
    n = int(dur * SR); tt = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, amp, dec in ((1, 1, 1.6), (2.76, 0.4, 2.6), (5.4, 0.22, 4.0), (8.93, 0.1, 6.0), (0.5, 0.25, 1.0)):
        s += amp * np.sin(2 * np.pi * freq * ratio * tt) * np.exp(-tt * dec)
    s *= np.minimum(1, tt / 0.004)
    return s * gain

# ---------------------------------------------------------------- foley
def key_click(kind="key", seed=0):
    r = np.random.default_rng(seed)
    n = int(0.09 * SR); tt = np.arange(n) / SR
    nz = r.standard_normal(n) * np.exp(-tt * (260 if kind == "key" else 160))
    click = bp(nz, 1800, 7000) * (0.55 if kind == "key" else 0.7)
    thump = np.sin(2 * np.pi * (140 if kind == "key" else 95) * tt) * np.exp(-tt * 70) * (0.25 if kind == "key" else 0.5)
    # key release a few tens of ms later
    rel = np.zeros(n); k = int((0.045 + r.random() * 0.03) * SR)
    rel[k:] = bp(r.standard_normal(n - k) * np.exp(-np.arange(n - k) / SR * 400), 2500, 8000)[: n - k] * 0.2
    return (click + thump + rel) * (0.8 + 0.4 * r.random())

def tick(seed=0, heavy=False):
    r = np.random.default_rng(seed)
    n = int(0.06 * SR); tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * (2300 if not heavy else 900) * tt) * np.exp(-tt * (220 if not heavy else 120))
    s += bp(r.standard_normal(n), 1500, 6000) * np.exp(-tt * 300) * 0.5
    return s * 0.5

def drop():
    n = int(1.6 * SR); tt = np.arange(n) / SR
    f = 700 + 900 * (1 - np.exp(-tt * 60))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 18) * 0.6
    s += np.sin(2 * np.pi * 260 * tt) * np.exp(-tt * 9) * 0.25
    s += bp(np.random.default_rng(3).standard_normal(n), 800, 4000) * np.exp(-tt * 40) * 0.15
    return s

def bird_song(seed, kind=0):
    r = np.random.default_rng(seed)
    parts = []
    syl = r.integers(3, 7)
    base = r.uniform(2600, 4300)
    for k in range(syl):
        d = r.uniform(0.05, 0.13) if kind == 0 else r.uniform(0.16, 0.32)
        n = int(d * SR); tt = np.arange(n) / SR
        if kind == 0:   # sparrow-like chirp
            f = base * (1 + r.uniform(-0.15, 0.2) * np.sin(np.pi * tt / d)) * (1 + 0.03 * np.sin(2 * np.pi * 70 * tt))
        else:           # slow two-note whistle
            f = np.linspace(base * 0.75, base * (0.62 if k % 2 else 0.85), n)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / d) ** 2
        parts.append(s)
        parts.append(np.zeros(int(r.uniform(0.04, 0.12) * SR)))
    return hp(np.concatenate(parts), 1500) * 0.18

def horn():
    n = int(4.0 * SR); tt = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * tt) * a for f, a in ((311.1, 1), (370.0, 0.8), (622.2, 0.3), (740, 0.2)))
    e = np.minimum(1, tt / 0.25) * np.clip((3.2 - tt) / 0.8, 0, 1)
    return lp(s * e, 900) * 0.25

# ---------------------------------------------------------------- ambience beds
def water_bed(n, seed, size=1.0):
    a = pink(n, seed); b = pink(n, seed + 1)
    st = np.stack([a, b], -1)
    laps = smooth_noise(n, 1.4, seed + 2) ** 3 * 2.2 + 0.25
    body = bp(st, 160, 1100) * laps[:, None]
    splash = bp(st, 1800, 6500) * (smooth_noise(n, 2.5, seed + 3) ** 4)[:, None] * 0.35
    out = body * size + splash
    # small plips
    r = np.random.default_rng(seed + 4)
    for t in np.cumsum(r.exponential(0.9, int(n / SR / 0.9) + 5)):
        i = int(t * SR)
        if i >= n - SR: break
        m = int(0.05 * SR); tt = np.arange(m) / SR
        f = r.uniform(900, 2600)
        out[i:i + m, r.integers(2)] += np.sin(2 * np.pi * np.cumsum(f * (1 + tt * 6)) / SR) * np.exp(-tt * 90) * r.uniform(0.03, 0.12)
    return (out / (np.abs(out).max() + 1e-9)).astype(np.float32)

def wind_bed(n, seed):
    st = np.stack([pink(n, seed), pink(n, seed + 1)], -1)
    g = smooth_noise(n, 0.35, seed + 2) ** 2
    out = lp(st, 700) * (0.3 + g)[:, None]
    whistle = bp(st, 500, 640, order=4) * (smooth_noise(n, 0.2, seed + 3) ** 3)[:, None] * 1.5
    out = out + whistle
    return (out / (np.abs(out).max() + 1e-9)).astype(np.float32)

def reed_bed(n, seed):
    st = np.stack([pink(n, seed), pink(n, seed + 1)], -1)
    fl = smooth_noise(n, 12, seed + 2) ** 2
    out = bp(st, 2500, 9000) * fl[:, None]
    return (out / (np.abs(out).max() + 1e-9)).astype(np.float32)

def room_bed(n, seed, fan=True):
    st = np.stack([pink(n, seed), pink(n, seed + 1)], -1)
    out = lp(st, 260) * 1.0
    if fan: out += bp(st, 300, 1600) * 0.25
    return (out / (np.abs(out).max() + 1e-9)).astype(np.float32)

FULL = {}
for _k, _f in (("water", lambda: water_bed(N, 10)), ("wind", lambda: wind_bed(N, 20)), ("reeds", lambda: reed_bed(N, 30)), ("room", lambda: room_bed(N, 40)), ("pcroom", lambda: room_bed(N, 50, fan=True))):
    FULL[_k] = _f()
WATER_MUFFLED = lp(FULL["water"], 700).astype(np.float32)
WATER_SOFT = lp(FULL["water"], 2000).astype(np.float32)

def bed(name, t0, t1, gain, fade=1.0, src=None):
    s = FULL[name] if src is None else src
    i0, i1 = max(0, t2i(t0)), min(N, t2i(t1))
    g = gate(N, t0, t1, fade)[i0:i1].astype(np.float32)
    mix["amb"][i0:i1] += s[i0:i1] * (g * gain)[:, None]

# ================================================================ PART ONE: terminal 0-42
T0_REC = datetime.datetime(2026, 11, 21, 4, 38, 45, tzinfo=datetime.timezone.utc).timestamp()
SEGS = [((1.2, 6.9), (6.6, 12.3)), ((6.9, 10.4), (12.3, 15.8)), ((10.4, 15.4), (161.0, 166.0)), ((15.4, 17.6), (190.0, 192.2))]
bed("pcroom", 1.0, 41.0, 0.05, fade=0.6)
keys = [l.split(" ", 1) for l in (V1 / "recording" / "keys.txt").read_text().splitlines() if l.strip()]
nk = 0
for ts, k in keys:
    rt = float(ts) - T0_REC
    for (f0, f1), (r0, r1) in SEGS:
        if r0 <= rt < r1:
            ft = f0 + (rt - r0)
            kind = "enter" if k in ("ENTER", "⏎") else ("space" if k.strip() == "" else "key")
            place("sfx", key_click(kind, nk), ft, 0.32, pan=0.1)
            nk += 1
# a low drone under the work, a single note at the freeze
drone = np.zeros(int(34 * SR)); tt = np.arange(len(drone)) / SR
for f, a in ((103.83, 1.0), (155.56, 0.5), (207.65, 0.25)):
    drone += a * np.sin(2 * np.pi * f * tt + 0.3 * np.sin(2 * np.pi * 0.07 * tt))
drone *= env_ar(len(drone), 6, 5) * 0.012
place("music", lp(drone, 600), 7.0)
pn = [(17.75, 6.0, NOTE("Eb5"), 46)]
# the fork: one note per step of the window; the three branches; the two picks
pn += [(25.6, 1.4, NOTE("Ab4"), 38), (26.6, 1.4, NOTE("C5"), 38), (27.6, 2.0, NOTE("Eb5"), 42)]
pn += [(28.2, 3.0, NOTE("Bb4"), 34), (28.45, 3.0, NOTE("Db5"), 32), (28.7, 3.0, NOTE("F5"), 34)]
pn += [(31.0, 3.4, NOTE("F5"), 48), (31.0, 3.4, NOTE("Ab3"), 34), (34.2, 3.4, NOTE("Db5"), 46), (34.2, 3.4, NOTE("Db3"), 34)]
pn += [(37.6, 4.0, NOTE("Ab2"), 36), (37.6, 4.0, NOTE("Eb4"), 30), (38.4, 4.0, NOTE("C5"), 32)]
place("music", render_midi(pn), 0.0, 1.0)
pad_chord(28.0, 12.0, "Ab2 Eb3 C4", gain=0.35, att=3.0, rel=3.0, bright=0.3)

# ================================================================ PART TWO: the world 42-171.6
place("sfx", drop(), 42.15, 0.5)
# ---- ambience
bed("water", 42.0, 47.6, 0.11, fade=1.2)        # the crane climbs away from the water...
bed("wind", 42.0, 58.0, 0.035)
bed("wind", 46.0, 53.4, 0.07, fade=1.6)          # ...into open air above the roofs
bed("reeds", 48.0, 53.0, 0.025, fade=1.4)
bed("water", 52.4, 58.0, 0.11, fade=0.5)         # cut: back down on the water
bed("room", 57.0, 65.8, 0.06, fade=0.8)
bed("water", 57.0, 65.8, 0.05, src=WATER_MUFFLED)
for k in range(8):                       # the classroom clock, quiet
    place("sfx", tick(100 + k), 58.0 + k, 0.07, pan=0.3)
bed("water", 65.0, 79.0, 0.13, fade=1.0)
bed("wind", 64.0, 98.4, 0.05, fade=1.5)
bed("wind", 72.6, 79.6, 0.09, fade=1.2)     # the gust: 后来车站把名字交给了风
bed("reeds", 72.8, 79.6, 0.07, fade=1.2)
place("amb", np.stack([horn(), horn()], -1) * np.array([[0.6, 0.4]]), 76.4, 0.08)   # far away; no train comes
bed("room", 79.0, 98.4, 0.03, fade=1.0)
for k in range(9):                       # the station clock
    place("sfx", tick(200 + k, heavy=True), 84.3 + k, 0.10 if k < 4 else 0.06, pan=-0.2)
bed("room", 98.4, 105.4, 0.05)
bed("water", 105.4, 111.0, 0.07)
for k in range(5):                       # the second hand runs the wrong way: reversed ticks
    place("sfx", tick(300 + k)[::-1], 111.3 + k, 0.13)
bed("room", 111.0, 116.0, 0.05, fade=0.5)
bed("water", 116.0, 121.0, 0.07, fade=0.5)
bed("room", 121.0, 126.0, 0.05, fade=0.5)
bed("wind", 121.0, 126.0, 0.07, fade=0.5)
bed("water", 126.0, 135.0, 0.10, fade=0.5)
# 河流还不知道自己的名字: the river falls silent with the picture (flow 132.4 -> 134.6)
mix["amb"][t2i(132.2):t2i(134.8)] *= np.linspace(1, 0, t2i(134.8) - t2i(132.2))[:, None] ** 2
mix["amb"][t2i(134.8):t2i(139.6)] = 0
bed("water", 139.6, 144.6, 0.09, fade=0.4)
bed("wind", 144.6, 154.6, 0.04, fade=0.6)
for k in range(5):
    place("sfx", tick(400 + k, heavy=True), 150.0 + k, 0.08, pan=-0.1)
bed("water", 154.6, 159.8, 0.06)
bed("water", 159.6, 171.6, 0.06, fade=2.0, src=WATER_SOFT)
bed("room", 159.6, 171.6, 0.035, fade=2.0)
for k in range(11):                     # the classroom clock again, the only other sound
    place("sfx", tick(500 + k), 160.0 + k, 0.05 * (1 - k / 14), pan=0.25)
# birds in the morning (not at night, not in the silence)
r = np.random.default_rng(77)
for (a, b, dens) in ((105.8, 111.0, 1.2), (116.0, 121.0, 1.0), (121.0, 126.0, 0.5), (126.0, 131.6, 1.2), (139.8, 154.6, 0.8)):
    t = a + r.random()
    while t < b - 0.8:
        place("amb", bird_song(int(t * 100), kind=int(r.random() < 0.3)), t, r.uniform(0.18, 0.4) * (0.35 if 121 <= t < 126 else 1), pan=r.uniform(-0.8, 0.8))
        t += r.exponential(2.0 / dens) + 0.6
# 回声在黎明之前又叫了一个秋天: one call and its echoes
call = bird_song(9001, kind=1)
for k in range(5):
    place("amb", lp(call, 5000 - k * 800), 156.0 + k * 0.52, 0.32 * 0.55 ** k, pan=-0.3 + k * 0.15)
place("amb", bird_song(9100, kind=1), 164.2, 0.10, pan=0.7)     # far away, once, in the last stillness

# ---- music
# poem one, dusk, A-flat major -> F minor at nightfall
CH = {
    "Abmaj9": "Ab2 Eb3 G3 C4 Bb4", "Fm9": "F2 C3 Ab3 Eb4 G4", "Dbmaj9": "Db2 Ab2 F3 C4 Eb4", "Eb7sus": "Eb2 Bb2 Ab3 Bb3 Db4",
    "Fm": "F2 C3 F3 Ab3 C4", "Bbm9": "Bb1 F2 Db3 Ab3 C4", "Csus": "C2 G2 F3 G3 C4", "C": "C2 G2 E3 G3 C4",
    "Cadd9": "C2 G2 D3 E3 G3", "Am9": "A1 E2 C3 G3 B3", "Fmaj7#11": "F1 C2 A2 E3 B3", "G6": "G1 D2 B2 E3 G3",
    "Fmaj7": "F1 C2 A2 E3 G3", "C/E": "E2 G2 C3 D3 G3", "Dm9": "D2 A2 C3 E3 F3", "Am": "A1 E2 A2 C3 E3",
}
prog1 = [(43.0, 54.0, "Abmaj9"), (54.0, 62.0, "Fm9"), (62.0, 69.0, "Dbmaj9"), (69.0, 74.0, "Eb7sus"), (74.0, 82.0, "Fm"),
         (82.0, 89.0, "Dbmaj9"), (89.0, 94.5, "Bbm9"), (94.5, 99.0, "Csus")]
for a, b, c in prog1:
    pad_chord(a, b - a + 0.6, CH[c], gain=0.55 if a < 74 else 0.42, att=2.4, rel=3.0, bright=0.45 if a < 74 else 0.3)
pn = []
for a, b, c in prog1:
    root = P(CH[c])[0]
    pn.append((a + 0.05, min(6, b - a), root, 40))
    pn.append((a + 0.6, min(5, b - a), P(CH[c])[2] + 12, 30))
# an original melody, sparse; phrases answer the lines rather than doubling them
mel1 = [(50.6, "Eb5", 2.0), (52.4, "C5", 1.4), (53.6, "Bb4", 3.0), (58.2, "Ab4", 1.6), (59.6, "C5", 1.2), (60.6, "Eb5", 3.4),
        (66.2, "F5", 1.4), (67.4, "Eb5", 1.4), (68.6, "C5", 3.4), (75.0, "C5", 2.0), (77.0, "Ab4", 3.6),
        (82.6, "F4", 1.6), (84.0, "Ab4", 1.6), (85.4, "C5", 3.6), (90.4, "Db5", 2.4), (93.0, "C5", 4.0)]
pn += [(t, d, NOTE(nm), 44 if t < 74 else 38) for t, nm, d in mel1]
# the shadow sweep: a C major chord, played and then turned around in time
place("music", render_midi(pn), 0.0, 0.95)
sw = render_midi([(0.0, 5.5, p, 60) for p in P("C3 G3 D4 E4 G4 C5")] + [(0.15, 5.5, NOTE("E5"), 50)])
sw = sw[: int(5.6 * SR)][::-1] * np.linspace(0.2, 1, int(5.6 * SR))[:, None]
place("music", sw, 104.4 - 5.6, 0.9)
place("music", bell(1046.5, 6.0, 0.10), 104.4, 1.0, pan=0.1)
place("music", bell(783.99, 6.0, 0.06), 104.42, 1.0, pan=-0.2)
# poem two, morning, C major: higher, lighter, more space
prog2 = [(104.4, 112.0, "Cadd9"), (112.0, 120.0, "Am9"), (120.0, 126.0, "Fmaj7#11"), (126.0, 132.8, "G6")]
for a, b, c in prog2:
    pad_chord(a, b - a + 0.6, CH[c], gain=0.45, att=2.0, rel=2.6, bright=0.55)
pn = [(a + 0.05, min(6, b - a), P(CH[c])[0], 38) for a, b, c in prog2]
mel2 = [(106.2, "G5", 1.6), (107.6, "E5", 1.6), (109.0, "D5", 3.0), (113.2, "C5", 1.4), (114.4, "E5", 1.4), (115.6, "A5", 3.2),
        (117.8, "G5", 2.6), (121.8, "A5", 1.4), (123.0, "G5", 1.4), (124.2, "E5", 3.0), (127.0, "D5", 1.6), (128.4, "B4", 1.6), (129.8, "D5", 2.6)]
pn += [(t, d, NOTE(nm), 40) for t, nm, d in mel2]
pn.append((132.6, 6.0, NOTE("E6"), 34))   # one high note at 「河流还不知道自己的名字」 that is left to decay into nothing
place("music", render_midi(pn), 0.0, 0.95)
# after the silence: the world returns before the music does
prog3 = [(141.0, 146.0, "Fmaj7"), (146.0, 150.4, "C/E"), (150.4, 155.0, "Dm9"), (155.0, 163.5, "Am")]
for a, b, c in prog3:
    pad_chord(a, b - a + 0.6, CH[c], gain=0.38 if a < 155 else 0.3, att=2.6, rel=3.4, bright=0.4 if a < 155 else 0.22)
pn = [(a + 0.05, min(6, b - a), P(CH[c])[0], 34) for a, b, c in prog3]
mel3 = [(142.4, "E5", 2.0), (144.2, "C5", 3.0), (147.0, "D5", 1.4), (148.2, "E5", 3.0), (151.2, "F5", 1.6), (152.6, "E5", 1.6),
        (154.0, "C5", 3.0), (157.0, "A4", 4.0), (160.4, "E4", 7.0)]
pn += [(t, d, NOTE(nm), 36 if t < 157 else 30) for t, nm, d in mel3]
place("music", render_midi(pn), 0.0, 0.9)
# hard rule: no music during the silence of the nameless river
fade_out = np.ones(N); i0, i1 = t2i(133.0), t2i(136.6)
fade_out[i0:i1] = np.linspace(1, 0, i1 - i0) ** 1.5; fade_out[i1:t2i(140.6)] = 0
mix["music"] *= fade_out[:, None]

# ---------------------------------------------------------------- mixdown
ir = reverb_ir(3.6, 5)
music = convolve(mix["music"], ir, 0.38)
amb = convolve(mix["amb"], reverb_ir(1.4, 6, 0.3), 0.15)
sfx = convolve(mix["sfx"], reverb_ir(0.7, 7, 0.2), 0.12)
master = music * 1.0 + amb * 1.0 + sfx * 1.0
# global fades: the opening black, the last stillness, the end card
master[: t2i(1.0)] = 0
end = gate(N, 0.0, 171.6, 2.2); master *= end[:, None]
master = np.tanh(master * 1.3) / 1.3
master /= np.abs(master).max() + 1e-9
master *= 0.9
sf.write(OUT / "mix.wav", master.astype(np.float32), SR, subtype="FLOAT")
for k in ("music", "amb", "sfx"):
    sf.write(OUT / f"stem_{k}.wav", (mix[k] / (np.abs(mix[k]).max() + 1e-9) * 0.9).astype(np.float32), SR, subtype="FLOAT")
print("wrote", OUT / "mix.wav", round(len(master) / SR, 2), "s")
