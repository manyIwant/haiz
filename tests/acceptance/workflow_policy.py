#!/usr/bin/env python3
"""Static policy check for .github/workflows/*.yml.

Failures (exit 1):
  - the file is not valid YAML or has no `on:` / `jobs:`
  - a `pull_request_target` trigger (runs fork code with a write token)
  - untrusted PR/issue text interpolated straight into a `run:` script (script injection)
  - a workflow that runs on pull_request pushes git commits, requests a Pages build or deploys,
    in a job/step that is not guarded to non-PR events

Warnings (reported, exit 0):
  - no top-level `permissions:` block (token defaults to the repository setting)
  - a job without `timeout-minutes` (default is 6 hours)
  - an action pinned to a moving branch (@main / @master)

Usage: python3 tests/acceptance/workflow_policy.py [--json out.json] [workflow.yml ...]
       python3 tests/acceptance/workflow_policy.py --expect-fail tests/fixtures/workflow-policy/*.yml   (self-test)
"""
import json
import pathlib
import re
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
UNTRUSTED = re.compile(
    r"\$\{\{\s*github\.(?:event\.(?:pull_request\.(?:title|body|head\.ref|head\.label)|issue\.(?:title|body)"
    r"|comment\.body|review\.body|head_commit\.message|commits)|head_ref)[^}]*\}\}")
WRITES = [
    (re.compile(r"\bgit\s+push\b"), "git push"),
    (re.compile(r"pages/builds"), "Pages build request"),
    (re.compile(r"\bwrangler\s+(?:pages\s+)?deploy\b"), "wrangler deploy"),
    (re.compile(r"\bgh\s+release\s+create\b"), "gh release create"),
]
DEPLOY_ACTIONS = ("actions/deploy-pages", "peaceiris/actions-gh-pages", "JamesIves/github-pages-deploy-action")
NON_PR_GUARD = re.compile(r"github\.event_name\s*!=\s*'pull_request'|github\.event_name\s*==\s*'(?:push|schedule|workflow_dispatch|release)'|github\.ref\s*==\s*'refs/heads/|startsWith\(github\.ref,\s*'refs/(?:heads|tags)/")


def triggers(doc):
    # PyYAML (YAML 1.1) reads the bare key `on` as boolean True.
    on = doc.get("on", doc.get(True))
    if on is None:
        return None
    if isinstance(on, str):
        return {on}
    if isinstance(on, list):
        return set(on)
    return set(on.keys())


def check(path):
    rel = str(path.relative_to(ROOT))
    out = {"file": rel, "failures": [], "warnings": []}
    try:
        doc = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as e:
        out["failures"].append(f"invalid YAML: {str(e).splitlines()[0]}")
        return out
    if not isinstance(doc, dict):
        out["failures"].append("not a mapping")
        return out
    on = triggers(doc)
    jobs = doc.get("jobs")
    if on is None:
        out["failures"].append("no `on:` triggers")
    if not isinstance(jobs, dict) or not jobs:
        out["failures"].append("no jobs")
        return out
    on = on or set()
    if "pull_request_target" in on:
        out["failures"].append("uses pull_request_target (fork code would run with a write token)")
    if "permissions" not in doc:
        out["warnings"].append("no top-level permissions block")
    pr = bool(on & {"pull_request", "pull_request_target"})
    for name, job in jobs.items():
        if not isinstance(job, dict):
            continue
        if "uses" in job:  # reusable workflow call
            continue
        if "timeout-minutes" not in job:
            out["warnings"].append(f"job `{name}` has no timeout-minutes")
        job_guarded = bool(NON_PR_GUARD.search(str(job.get("if", ""))))
        for i, step in enumerate(job.get("steps") or []):
            if not isinstance(step, dict):
                continue
            label = f"job `{name}` step {i + 1}" + (f" ({step['name']})" if step.get("name") else "")
            uses = str(step.get("uses", ""))
            if re.search(r"@(main|master)$", uses):
                out["warnings"].append(f"{label} uses a moving ref: {uses}")
            run = str(step.get("run", ""))
            if UNTRUSTED.search(run):
                out["failures"].append(f"{label} interpolates untrusted event text into run: (pass it through env: instead)")
            if not pr or job_guarded or NON_PR_GUARD.search(str(step.get("if", ""))):
                continue
            for rx, what in WRITES:
                if rx.search(run):
                    out["failures"].append(f"{label} runs `{what}` on pull_request without a non-PR guard")
            if uses.startswith(DEPLOY_ACTIONS):
                out["failures"].append(f"{label} deploys ({uses}) on pull_request without a non-PR guard")
    return out


def main(argv):
    json_out = None
    expect_fail = "--expect-fail" in argv
    argv = [a for a in argv if a != "--expect-fail"]
    if "--json" in argv:
        i = argv.index("--json")
        json_out = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    files = [pathlib.Path(a).resolve() for a in argv] or sorted((ROOT / ".github/workflows").glob("*.y*ml"))
    results = [check(p) for p in files]
    failed = [r for r in results if r["failures"]]
    for r in results:
        mark = "✗" if r["failures"] else "✓"
        print(f"{mark} {r['file']}")
        for f in r["failures"]:
            print(f"    - {f}")
        for w in r["warnings"]:
            print(f"    ! {w}")
    print(f"\n{len(results) - len(failed)}/{len(results)} workflows pass policy; "
          f"{sum(len(r['warnings']) for r in results)} warning(s).")
    if json_out:
        pathlib.Path(json_out).parent.mkdir(parents=True, exist_ok=True)
        pathlib.Path(json_out).write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if expect_fail:
        missed = [r["file"] for r in results if not r["failures"]]
        if missed:
            print("self-test: unsafe workflow(s) passed: " + ", ".join(missed))
            return 1
        print("self-test: every unsafe workflow was caught.")
        return 0
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
