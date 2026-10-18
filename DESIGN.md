# haiz · Architecture, not interface spectacle

Reference research: [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md), commit `3b605329240ce735b510037cca322f1831fdd7f8`, especially `design-md/oura/DESIGN.md` and `design-md/linear.app/DESIGN.md`. Their analysis is MIT licensed; attribution is in `assets/vendor/AWESOME-DESIGN-MD-LICENSE.txt`. This is an independent adaptation, not an Oura or Linear brand reproduction.

## Visual language

The campus photography and 3D architecture carry the experience. Reading pages use warm paper `#f7f3eb`, charcoal `#292e2a`, quiet green `#293f36`, muted text `#626e62` and a restrained clay accent. The world-view tools use translucent charcoal `#172b24`, warm light text and 1px edges. Do not let interface panels obscure the architecture.

Large Chinese headings use the existing system serif stack; body/UI use bundled Sora and system Chinese fonts. No proprietary typefaces are copied. Separate large editorial statements from small, functional labels. Section rhythm is generous; imagery is large; notes are readable and not reduced to decorative hairlines.

Use 8px UI corners, 12–16px media/card corners, and full rounding for compact actions. A photograph is not a floating tilted card. Let original image proportions remain legible; do not crop a campus photo to imply a different building or remove authorship marks.

## Motion

Finite, soft entrances: 15px / 700ms with `cubic-bezier(.22,1,.36,1)`. Dialogs use a short 250ms reveal. Hover images may scale slightly within their frame; the entire reading page does not drift. Chapter navigation tracks actual sections. Respect reduced motion, keyboard focus, coarse-pointer use and document visibility; do not add an always-running visual effects loop.

## Architecture

Model proportions, negative space and lighting precede microtexture. Curved roof surfaces and eave ends are real geometry. Window reveals are real depth. Dome seams, stair profiles, mullions and layered cornices remain visible in silhouette and shadow. A detailed color image on a block is not sufficient.

Preserve existing spatial anchors and classroom access. Keep survey uncertainty explicit. Actual photographs and the model appear as separate reference views; do not paste a photo in front of the camera and call it higher-fidelity modelling. Licensed decorative models are credited as creative set dressing, not records of the real campus.

## Verification

Inspect fresh browser screenshots of Fengqitang, the library and a teaching block before accepting visual work. Automated geometry checks cannot establish photorealism. Check the silhouette, camera crop, highlight intensity, shadow direction, local texture scale, mobile overflow and failure fallback. Record limitations without claiming a photographic reconstruction.
