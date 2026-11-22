// HAIZ · 入画 — the six-layer painted campus, put together (see docs/painted-campus-20261122.md).
//
//   1 ground     ground.js    gouache marks per kind of ground, painted shadows, a restrained wet sheen
//   2 wind       flora.js     grass rings that hand over blade by blade, crowns and near leaves in one gust field
//   3 sky        palette.js   four painted keys (正午 午后 黄金时刻 日落) over the real weather's simulated light
//   4 榄仁/建筑   flora.js, build.js   crowns lit as volumes in four greens; walls in washes, storey rhythm, glass
//   5 people     figure.js    cel in the campus's own light, ground bounce, rim, hem and hair in the wind
//   6 finish     finish.js    the layered finish: paint where it belongs, structure lines, figure ink, grade
//
// createArt() upgrades the 入画 world in place (lanren/ruhua/world.js + lanren/life) — the same campus,
// the same buildings, the same walker and people, the same transition — and returns the controls the
// director uses: per-layer ramps (the transition raises them in turn), the palette, the A/B switch and
// the debug views.
import { ART, TOGGLES, coverScene } from './art.js';
import { createBrushTexture } from './brush.js';
import { upgradeGround } from './ground.js';
import { upgradeFlora } from './flora.js';
import { upgradeBuildings } from './build.js';
import { createFigureArt } from './figure.js';
import { artPalette, artKey } from './palette.js';

const sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
/**
 * The order the painted layers mature in during the 入画 transition (seconds since the walker stepped aside;
 * T the director's timetable; enterK 0..1 through the exit from the body). Ground, then plants, then
 * buildings; the walker is inked last.
 */
export function layerRamps(stage, since, enterK, T) {
  if (!(stage === 'depart' || stage === 'spread' || stage === 'enter' || stage === 'stroll-finishing')) return [1, 1, 1, 1];
  const f = stage === 'enter' ? sm((enterK - 0.42) / 0.45) : stage === 'stroll-finishing' ? 1 : 0;
  return [sm((since - T.project) / 2.0), sm((since - T.project - 1.0) / 2.4), sm((since - T.front - 0.4) / 2.6), f];
}

export function createArt({ renderer, world, pipeline, layer }) {
  ART.uBrush.value = createBrushTexture(renderer);
  const t0 = performance.now();
  const report = {
    ground: upgradeGround(world),
    flora: upgradeFlora(world),
    buildings: upgradeBuildings(world),
  };
  const figures = createFigureArt(world);
  const finish = pipeline.finish;
  let enabled = true, debug = 0, palette = 1, lastKey = null;
  const ramps = [1, 1, 1, 1];
  const apply = () => {
    ART.uArt.value = enabled ? 1 : 0;
    ART.uArtL.value.set(...ramps);
    if (finish) {
      const u = finish.uniforms;
      // the finish follows the layers: paint with the ground and the plants, lines with the buildings, ink with the people
      u.uKuwa.value = enabled ? Math.max(ramps[0], ramps[1]) : 0;
      u.uStruct.value = enabled ? ramps[2] : 0;
      u.uInk.value = enabled ? ramps[3] : 0;
      u.uDebug.value = debug;
    }
  };
  apply();
  pipeline.beforePainted = (scene) => coverScene(scene, layer);
  const api = {
    report, figures, ART,
    ms: Math.round(performance.now() - t0),
    get enabled() { return enabled; },
    /** A/B: false shows the 入画 world as it was (the same grade, no marks, no finish) */
    setEnabled(on) { enabled = !!on; for (const t of TOGGLES) (enabled ? t.on : t.off)(); apply(); return enabled; },
    /** per-layer ramps 0..1: ground, plants, buildings, people */
    setRamps(g, p, b, f) { ramps[0] = g; ramps[1] = p; ramps[2] = b; ramps[3] = f; apply(); },
    get ramps() { return ramps.slice(); },
    /** 0 final · 1 raw · 2 depth · 3 info · 4 lines · 5 paint only */
    debug(n = (debug + 1) % 6) { debug = n | 0; apply(); return debug; },
    /** the art key over the weather's light (strength 0..1) */
    palette(P, S) {
      const r = artPalette(P, S, enabled ? palette : 0);
      lastKey = r;
      return r.P;
    },
    setPaletteStrength(s) { palette = s; },
    get key() { return lastKey ? { label: lastKey.key.label, weight: +lastKey.weight.toFixed(2) } : null; },
    artKey, layerRamps,
    /** restyle the campus's people as they arrive */
    people(root) { return figures.apply(root); },
  };
  return api;
}
