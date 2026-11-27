"""Analyze motion telemetry JSON & stitch visual verification contact sheets (pure Python + ffmpeg)."""
from pathlib import Path
import argparse
import json
import math
import subprocess

REPO = Path(__file__).resolve().parents[2]


def percentile(vals, p):
    if not vals:
        return 0.0
    s = sorted(vals)
    idx = min(len(s) - 1, max(0, int(math.floor(len(s) * p / 100.0))))
    return float(s[idx])


def summarize_scenario(samples):
    if not samples:
        return {}
    speeds = [s['speed'] for s in samples]
    l_slides = [s['leftSlideMmS'] for s in samples if s['leftPhase'] == 'PLANTED']
    r_slides = [s['rightSlideMmS'] for s in samples if s['rightPhase'] == 'PLANTED']
    all_slides = l_slides + r_slides
    pen_max = max((s['penetrationMaxMm'] for s in samples), default=0.0)

    head_leads = [abs(s['turnCascade']['headYawDeg']) for s in samples]
    chest_leads = [abs(s['turnCascade']['chestYawDeg']) for s in samples]

    return {
        'frames': len(samples),
        'meanSpeed_m_s': round(sum(speeds) / len(speeds), 3),
        'maxSpeed_m_s': round(max(speeds), 3),
        'footsteps': samples[-1].get('footsteps', 0),
        'stanceSlideMean_mm_s': round(sum(all_slides) / len(all_slides) if all_slides else 0.0, 2),
        'stanceSlideP95_mm_s': round(percentile(all_slides, 95), 2),
        'penetrationMax_mm': round(float(pen_max), 2),
        'maxHeadLead_deg': round(max(head_leads), 2),
        'maxChestLead_deg': round(max(chest_leads), 2),
    }


def make_contact_sheet(shots_paths, out_path, cols=3):
    valid = [REPO / p for p in shots_paths if (REPO / p).exists()]
    if not valid:
        return
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = ['ffmpeg', '-y']
    for p in valid:
        cmd.extend(['-i', str(p)])

    filters = []
    for idx, _ in enumerate(valid):
        filters.append(f'[{idx}:v]scale=640:360[v{idx}]')
    inputs_str = ''.join(f'[v{idx}]' for idx in range(len(valid)))
    if len(valid) == 1:
        filters = ['[0:v]scale=640:360[out]']
    else:
        filters.append(
            f'{inputs_str}xstack=inputs={len(valid)}:layout=' +
            '|'.join(f'{(i % cols) * 640}_{(i // cols) * 360}' for i in range(len(valid))) +
            ':fill=0x181a1c[out]'
        )
    cmd.extend(['-filter_complex', ';'.join(filters), '-map', '[out]', '-frames:v', '1', '-q:v', '3', str(out_path)])
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f'ffmpeg contact sheet failed: {res.stderr}')
    print(f'Saved contact sheet ({len(valid)} panels) -> {out_path}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tag', default='v1')
    args = ap.parse_args()

    raw_path = REPO / f'living-character/data/motion-raw-{args.tag}.json'
    raw = json.loads(raw_path.read_text())

    metrics = {
        'tag': args.tag,
        'errors': len(raw['consoleErrors']) + len(raw['pageErrors']) + len(raw['httpErrors']),
        'renderInfo': raw.get('renderInfo'),
        'scenarios': {k: summarize_scenario(v['samples']) for k, v in raw['scenarios'].items()},
        'compareSummary': raw.get('compareSummary'),
    }

    out_json = REPO / f'living-character/data/motion-metrics-{args.tag}.json'
    out_json.write_text(json.dumps(metrics, indent=2) + '\n')
    print(f'Wrote metrics -> {out_json}')

    shots = raw.get('shots', [])
    half = max(1, (len(shots) + 1) // 2)
    make_contact_sheet(shots[:half], REPO / f'living-character/renders/lab-sheet-{args.tag}-part1.jpg', cols=3)
    make_contact_sheet(shots[half:], REPO / f'living-character/renders/lab-sheet-{args.tag}-part2.jpg', cols=3)


if __name__ == '__main__':
    main()
