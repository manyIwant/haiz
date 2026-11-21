"""The fork at "有一": verify, from the real session files, everything the film states.

Reads only files written during the recorded session (../spring-no-recipient/session-files):
  corpus_things.txt  — the corpus Claude Code wrote
  output_things.txt  — the 80 lines the program printed (seed 1)
and checks that
  * line 37 「河上有一条河很长」 and line 23 「我家门前有一个名字」 are in that output, unedited;
  * re-running modern.py with the recorded arguments reproduces the file exactly;
  * at context "有一" the trigram counts are 条:1 个:1 座:1 (each 1/3), and lists the corpus
    sentences each branch comes from;
  * every step of both lines is possible under the model (count > 0).
Writes film/data/fork.js for the film.
"""
import json, pathlib, subprocess, sys
from collections import Counter, defaultdict

V2 = pathlib.Path(__file__).resolve().parent.parent
SF = V2.parent / "spring-no-recipient" / "session-files"
BOS, EOS, N = "<", ">", 3

corpus = [l.strip() for l in (SF / "corpus_things.txt").read_text(encoding="utf-8").splitlines() if l.strip()]
output = (SF / "output_things.txt").read_text(encoding="utf-8").splitlines()
rerun = subprocess.run([sys.executable, "modern.py", "1", "80", "corpus_things.txt"], cwd=SF, capture_output=True, text=True).stdout.splitlines()
assert rerun == output, "re-run does not reproduce output_things.txt"

counts = defaultdict(Counter)
for s in corpus:
    t = [BOS] * (N - 1) + list(s) + [EOS]
    for i in range(N - 1, len(t)):
        counts["".join(t[i - 2:i])][t[i]] += 1

def steps(line):
    t = [BOS] * (N - 1) + list(line) + [EOS]
    out = []
    for i in range(N - 1, len(t)):
        ctx, ch = "".join(t[i - 2:i]), t[i]
        d = counts[ctx]
        assert d[ch] > 0, (line, ctx, ch)
        out.append(dict(ctx=ctx, pick=ch, n=d[ch], total=sum(d.values()), options=sorted(d.items(), key=lambda kv: -kv[1])))
    return out

lines = {}
for no, text in ((37, "河上有一条河很长"), (23, "我家门前有一个名字")):
    row = output[no - 1]
    assert row.strip().startswith(f"{no}.") and row.split(". ", 1)[1] == text, row
    lines[no] = dict(text=text, steps=steps(text))

fork = counts["有一"]
assert dict(fork) == {"条": 1, "个": 1, "座": 1}, fork
src = {c: [s for s in corpus if "有一" + c in s] for c in fork}
data = dict(fork=dict(ctx="有一", options={c: dict(n=n, total=sum(fork.values()), sources=src[c]) for c, n in fork.items()}),
            lines=lines, corpus_size=len(corpus))
(V2 / "film" / "data" / "fork.js").write_text("window.FORK = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
print(json.dumps(data["fork"], ensure_ascii=False))
print("line 37 steps:", [(s["ctx"], s["pick"], f'{s["n"]}/{s["total"]}') for s in lines[37]["steps"]])
print("line 23 steps:", [(s["ctx"], s["pick"], f'{s["n"]}/{s["total"]}') for s in lines[23]["steps"]])
