"""Convert the raw `script` recording (out.bin + timing.txt) into an event index.

Output data/cast.json: {"cols","rows","events":[[t_seconds, byte_end], ...]}
The film player feeds out.bin[0:byte_end] into xterm.js, so the picture on screen is
exactly what the real Claude Code process printed — nothing is redrawn by hand.
"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
raw = (root / "recording/out.bin").read_bytes()
# util-linux `script` writes a one-line header ("Script started on ...") and a trailer.
HEADER = raw.index(b"\n") + 1
t, off, ev = 0.0, HEADER, []
for line in (root / "recording/timing.txt").read_text().split("\n"):
    if not line.strip():
        continue
    d, n = line.split()
    t += float(d); off += int(n)
    ev.append([round(t, 4), off])
tail = raw[off:]
assert tail.strip().startswith(b"Script done"), tail[:80]
(root / "data/cast.json").write_text(json.dumps({"cols": 100, "rows": 30, "header": HEADER, "events": ev}))
print(len(ev), "events", round(t, 2), "s", len(raw), "bytes")

# Also emit a JS bundle so the film page works from file:// without a server.
import base64
(root / "data/recording.js").write_text(
    "window.RECORDING=" + json.dumps({"cols": 100, "rows": 30, "header": HEADER, "events": ev,
                                       "b64": base64.b64encode(raw).decode()}) + ";\n")
