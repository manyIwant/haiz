"""现代汉语版：纯三元模型（只看前两个字，不回退），逐行生成句子。"""
import random
import sys

from ngram import BOS, EOS, NGram


def gen_sentence(model, rng, max_len=40):
    hist = [BOS] * (model.n - 1)
    out = []
    while len(out) < max_len:
        c = model.next_char(hist, rng, backoff=0.0)  # 不回退，严格只看前两个字
        if c == EOS:
            break
        out.append(c)
        hist.append(c)
    return "".join(out)


if __name__ == "__main__":
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else None
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 40
    path = sys.argv[3] if len(sys.argv) > 3 else "corpus_modern.txt"
    n = int(sys.argv[4]) if len(sys.argv) > 4 else 3  # 看前 n-1 个字
    rng = random.Random(seed)
    corpus = [l.strip() for l in open(path, encoding="utf-8") if l.strip()]
    model = NGram(n=n)
    model.train(corpus)
    seen = set(corpus)
    for i in range(count):
        s = gen_sentence(model, rng)
        mark = "  [语料原句]" if s in seen else ""
        print(f"{i + 1:2d}. {s}{mark}")
