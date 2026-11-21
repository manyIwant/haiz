"""字级 n-gram 诗歌生成器：从 corpus.txt 学习，生成五言绝句。"""
import random
import re
import sys
from collections import Counter, defaultdict

BOS, EOS = "<", ">"


def load_lines(path, length=5):
    text = open(path, encoding="utf-8").read()
    segs = re.split(r"[，。！？、\s]+", text)
    return [s for s in segs if len(s) == length]


class NGram:
    def __init__(self, n=3):
        self.n = n
        # counts[k][context] -> Counter(next_char)，k 为上下文长度
        self.counts = [defaultdict(Counter) for _ in range(n)]

    def train(self, lines):
        for line in lines:
            toks = [BOS] * (self.n - 1) + list(line) + [EOS]
            for i in range(self.n - 1, len(toks)):
                for k in range(self.n):
                    ctx = tuple(toks[i - k:i])
                    self.counts[k][ctx][toks[i]] += 1

    def next_char(self, history, rng, backoff=0.25):
        """带随机回退的采样：以一定概率退到更低阶，让组合更多样。"""
        for k in range(self.n - 1, -1, -1):
            ctx = tuple(history[-k:]) if k else ()
            dist = self.counts[k].get(ctx)
            if not dist:
                continue
            if k > 0 and rng.random() < backoff:
                continue
            chars, weights = zip(*dist.items())
            return rng.choices(chars, weights)[0]
        raise RuntimeError("empty model")

    def gen_line(self, rng, length=5, tries=500):
        for _ in range(tries):
            hist = [BOS] * (self.n - 1)
            out = []
            while len(out) < length:
                c = self.next_char(hist, rng)
                if c in (BOS, EOS):
                    break
                out.append(c)
                hist.append(c)
            # 末字须能自然收句：在语料里该字后面出现过句末标记
            if len(out) == length and EOS in self.counts[1][(out[-1],)]:
                return "".join(out)
        raise RuntimeError("could not generate a line")


def gen_poem(model, seen, rng):
    lines = []
    while len(lines) < 4:
        line = model.gen_line(rng)
        # 不照抄语料原句，也不在一首诗里重复
        if line in seen or line in lines:
            continue
        lines.append(line)
    return f"{lines[0]}，{lines[1]}。\n{lines[2]}，{lines[3]}。"


if __name__ == "__main__":
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else None
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    rng = random.Random(seed)
    corpus = load_lines("corpus.txt")
    model = NGram(n=3)
    model.train(corpus)
    seen = set(corpus)
    for i in range(count):
        print(f"其{'一二三四五六七八九十'[i]}\n{gen_poem(model, seen, rng)}\n")
