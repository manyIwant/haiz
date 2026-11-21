"""Trace the real trigram model recorded in the film.

Everything here is recomputed from the files Claude Code wrote during the recorded
session (session-files/corpus_things.txt, corpus_modern.txt, ngram.py, modern.py).
We do NOT re-generate poetry: we only explain lines the real program already printed.

For every explained line we record, step by step:
  * the two-character context the model looked at (with "<" as start padding),
  * the full next-character distribution the model would sample from (raw counts),
  * which character the real run actually printed.
We also compute a "seam" decomposition: the fewest corpus sentences whose fragments,
overlapping by exactly the two-character context, reproduce the line. This is an
explanation of *why the line is possible*, not a claim about hidden internal choices —
the program samples characters by count, it never picks a sentence.
"""
import json, pathlib, subprocess, sys
from collections import Counter, defaultdict

root = pathlib.Path(__file__).resolve().parent.parent
SF = root / "session-files"
BOS, EOS = "<", ">"
N = 3

def load(name):
    return [l.strip() for l in (SF / name).read_text(encoding="utf-8").splitlines() if l.strip()]

def train(corpus):
    counts = defaultdict(Counter)
    for line in corpus:
        toks = [BOS] * (N - 1) + list(line) + [EOS]
        for i in range(N - 1, len(toks)):
            counts[tuple(toks[i - N + 1:i])][toks[i]] += 1
    return counts

def steps_for(line, counts, corpus):
    toks = [BOS] * (N - 1) + list(line) + [EOS]
    out = []
    for i in range(N - 1, len(toks)):
        ctx = tuple(toks[i - N + 1:i]); ch = toks[i]
        dist = counts.get(ctx)
        assert dist and dist[ch] > 0, f"line not generable at {ctx}->{ch}: {line}"
        occ = []
        for si, s in enumerate(corpus):
            st = [BOS] * (N - 1) + list(s) + [EOS]
            for j in range(N - 1, len(st)):
                if tuple(st[j - N + 1:j]) == ctx and st[j] == ch:
                    occ.append([si, j - (N - 1)])
        out.append({"ctx": "".join(ctx), "pick": ch,
                    "dist": sorted(dist.items(), key=lambda kv: (-kv[1], kv[0])),
                    "total": sum(dist.values()), "occ": occ})
    return out

def seams(line, corpus):
    """Greedy longest-match cover; consecutive pieces overlap by N-1 tokens (optimal for substring-closed sets)."""
    toks = [BOS] * (N - 1) + list(line) + [EOS]
    padded = [[BOS] * (N - 1) + list(s) + [EOS] for s in corpus]
    def find(a, b):  # tokens a..b (exclusive) inside one sentence?
        seg = toks[a:b]
        for si, st in enumerate(padded):
            for j in range(len(st) - len(seg) + 1):
                if st[j:j + len(seg)] == seg:
                    return si, j
        return None
    pieces, a = [], 0
    while True:
        b = len(toks)
        while b > a + N - 1 and find(a, b) is None:
            b -= 1
        si, j = find(a, b)
        # convert to character indices in the visible line (strip padding)
        pieces.append({"sent": si, "from": max(a - (N - 1), 0), "to": min(b - (N - 1), len(line)),
                       "sent_from": max(j - (N - 1), 0)})
        if b >= len(toks):
            break
        a = b - (N - 1)
    return pieces

def raw_run(args):
    r = subprocess.run([sys.executable, "modern.py", *map(str, args)], cwd=SF, capture_output=True, text=True, check=True)
    return r.stdout

if __name__ == "__main__":
    things, modern = load("corpus_things.txt"), load("corpus_modern.txt")
    ct, cm = train(things), train(modern)
    out80 = raw_run([1, 80, "corpus_things.txt"])
    assert out80 == (SF / "output_things.txt").read_text(encoding="utf-8"), "recorded run not reproducible"
    out40 = raw_run([1, 40, "corpus_modern.txt"])
    raw80 = [l[4:].replace("  [语料原句]", "") for l in out80.splitlines()]
    copies80 = [("[语料原句]" in l) for l in out80.splitlines()]
    raw40 = [l[4:].replace("  [语料原句]", "") for l in out40.splitlines()]
    def explain(line, counts, corpus, tag):
        return {"line": line, "corpus": tag, "steps": steps_for(line, counts, corpus), "seams": seams(line, corpus)}
    hero = ["外面的雨还没有给我回信", "钟停了，我也没有看见我", "信封上的雪很厚", "我家门前有一个名字",
            "夏天的时候留给我回信", "他一直没有给我的名字", "我坐在车站的钟", "河上有一条河很长", "伞已经十点了"]
    daily = ["外面有点饿了", "电梯今天又要加班了", "书里的故事有点堵车"]
    for h in hero: assert h in raw80, h
    for d in daily: assert d in raw40, d
    data = {
        "corpus_things": things, "corpus_modern": modern,
        "raw80": raw80, "copies80": copies80, "raw40": raw40,
        "n_sweep": {k: (SF / f"output_things_n{k}.txt").read_text(encoding="utf-8").splitlines() for k in (1, 2, 5)},
        "explain": {**{h: explain(h, ct, things, "things") for h in hero},
                    **{d: explain(d, cm, modern, "modern") for d in daily}},
        "stats": {"things_sentences": len(things), "things_chars": sum(map(len, things)),
                  "things_contexts": len(ct), "modern_sentences": len(modern)},
    }
    (root / "data/trace.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
    (root / "data/trace.js").write_text("window.TRACE=" + json.dumps(data, ensure_ascii=False) + ";\n")
    for h in hero + daily:
        e = data["explain"][h]; corp = things if e["corpus"] == "things" else modern
        print(h, " = ", " + ".join(f'[{corp[p["sent"]]}]' for p in e["seams"]))
    e = data["explain"]["外面的雨还没有给我回信"]
    for s in e["steps"]:
        print(s["ctx"], "->", s["pick"], s["total"], s["dist"][:8])
    print(data["stats"])
