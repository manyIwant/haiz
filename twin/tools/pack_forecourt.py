"""Make a double-clickable, network-free viewer from the repository assets."""
import argparse
import base64
import json
from pathlib import Path
import re

TWIN = Path(__file__).resolve().parents[1]


def pack(output):
    template = TWIN/'viewer/forecourt.html'
    html = template.read_text()
    def inline(match):
        source = (template.parent/match[1]).read_text()
        return '<script>'+re.sub(r'</script',r'<\\/script',source,flags=re.I)+'</script>'
    html = re.sub(r'<script src="([^"]+)"></script>',inline,html)
    assets = TWIN/'assets/atelier'
    manifest = json.loads((assets/'manifest.json').read_text())
    data = {'camera':json.loads((TWIN/'evidence/calibration/jiaoxuelou-1600.report.json').read_text()),
            'parts':{key:base64.b64encode((assets/detail['file']).read_bytes()).decode('ascii')
                     for key,detail in manifest['parts'].items()}}
    html = html.replace('<script>\n(async ()', '<script>window.forecourtBundle='+json.dumps(data,separators=(',',':'))+';</script>\n<script>\n(async ()')
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(html)
    print(output, round(output.stat().st_size/1024**2,1),'MiB')


if __name__=='__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('output',type=Path)
    pack(parser.parse_args().output)
