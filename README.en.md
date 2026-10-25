# HAIZ — Digital Campus Journal

[简体中文](README.md) · **English**

**Still learning. Still making.**

HAIZ is an independent, unofficial campus journal and spatial web experiment centered on the Fucheng campus of Hainan Middle School in Haikou, China. It combines editorial storytelling, campus photography, approximate 3D architecture, and small interactive creative tools.

Built by [manyIWant](https://github.com/manyIWant). HAIZ is **not** an official school website, admissions service, student-information system, or school-endorsed product.

## What is in `main`

The default branch currently contains a static, self-hostable experience. The most useful entry points are:

| Experience | Path | What it does |
| --- | --- | --- |
| Cinematic entrance | `index.html` | A transition from a wider geographic view into the campus |
| Campus journal | `journal.html` | Photography-led editorial pages and local campus stories |
| Walkable campus | `campus-3d.html` | An exploratory, first-person architectural **interpretation**, not a survey-grade replica |
| Route studio | `director.html` | Compose and revisit routes and local camera views |
| Creative darkroom | `darkroom.html` | Turn gestures into short synthesized musical patterns; export images and WAV files |
| Windowsill | `windowsill/index.html` | A separately attributed interactive desk, local notes, timers and creative tools |
| Research pages | `architecture.html`, `memory-walk.html` | Materials, photographs, landmarks, and reflective explorations |

The project includes locally bundled browser assets, including Three.js and fonts, rather than requiring a production JavaScript build server for the published pages.

## Try it locally

Clone the repository and serve its root directory over HTTP:

```bash
git clone https://github.com/manyIWant/haiz.git
cd haiz
python3 -m http.server 8000
```

Open `http://localhost:8000/`. Some resources and browser APIs work differently from `file://` URLs, so the HTTP preview is preferable.

For the existing Node-based test and content-generation scripts:

```bash
npm ci
npm test
npm run build
```

`npm run build` regenerates site assets/pages from the sources; review the resulting Git diff before committing. Browser and WebGL tests have additional local Chromium/Playwright requirements. See [README.md](README.md) for the complete command list.

## Design and architecture

HAIZ treats the school as a **place**, not just a list of announcements. Photography, approximate spatial data, weather studies, progressive asset loading, and finite motion transitions are intended to support exploration.

See [DESIGN.md](DESIGN.md) and the dated technical notes in [docs/](docs/). Real locations and historical material are distinguished from generated geometry, illustrative interiors, fictional writing, and proposal-only features.

## Mobile / Flow development status

Experimental mobile shells, native Android/iOS packaging, the Study interface, and the Flow pilot are being developed in separate feature branches and draft pull requests. **They are not part of the released default-branch website**, and a passing browser test does not mean an APK/IPA has passed physical-device acceptance or that a real school backend is connected.

Do not treat simulated teacher/student screens as real school authentication. Do not submit real student or teacher records to demonstration services.

## Privacy and sharing

The default static site's optional notes, exploration history, and creative drafts are intended to remain in the current browser's local storage. Some explicit sharing links carry user-selected creative data within the link itself; anyone receiving such a link can read what it contains. Clearing local browser storage does not revoke a previously shared link.

Do not include personal records, login credentials, private school materials, or API secrets in bug reports or example content. See [SECURITY.md](SECURITY.md) for reporting and repository-hygiene guidance.

## Sources, copyright, and attribution

Third-party source code, 3D models, photography, historic records, and assets retain their respective licenses and attribution requirements. The independent Windowsill adaptation has AGPL-3.0 obligations documented in [windowsill/SOURCE.md](windowsill/SOURCE.md); model credit details are in [assets/walk/models/NOTICE.md](assets/walk/models/NOTICE.md).

The presence of an asset in this repository does **not** imply that it is public domain or can be relicensed. Please check the individual source and license notices before reuse.

---

**A creative project rooted in a real campus, open to readers and developers everywhere.**
