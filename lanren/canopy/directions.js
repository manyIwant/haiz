// Chapter 03 · 青春 · 生长 — the creative directions are real limbs of the V4 crown.
//
// Each direction owns a sector of the crown around the trunk–crown axis (azimuth in
// degrees, atan2(x − AXIS.x, z − AXIS.z), the same convention as chapters.js). The
// sectors were laid out on the locked tree (seed 2611) so that every direction has
// several real clumps of new growth on the outer shell, and so that the V4 details shot
// (a cluster near 65°) opens onto 摄影 · 影像: light through a leaf is where this
// chapter begins.
//
// A direction also has a temperament: the light it is seen in. Values blend into the
// shot's light (chapters.js LIGHT) while the camera is in that part of the crown; they
// are relative nudges, not a separate lighting rig. sunAz is measured from "behind the
// crown" (the far side of the limb, as V4's details shot lights its cluster): 0 = straight
// through the leaves towards the camera, 180 = from behind the camera.
//
// Main directions are stable. Finer twigs (`twigs`) can grow: a student proposes one,
// an editor de-duplicates and approves it, and only then does it become a twig of its
// parent direction (state: 'approved'). Proposed twigs never create space on the tree.
// Pure data (Node-testable).

export const DIRECTIONS = [
  {
    id: 'photo', zh: '摄影 · 影像', short: '摄影', en: 'Photography & film', sector: [38, 108],
    mood: '低角度的阳光斜穿过叶层，光本身就是材料',
    temper: { sunAz: 116, sunEl: 19, I: 1.12, rays: 0.9, exposure: 1.12, warm: 0.64, contrast: 1.12, sat: 1.06, wind: 1 },
    open: { R: 1.9, reach: 3.2 },   // the limb comes far out: the low sun rakes along it
    twigs: [{ id: 'photo-series', zh: '组照', state: 'approved' }, { id: 'photo-moving', zh: '短片', state: 'approved' }]
  },
  {
    id: 'words', zh: '文学', short: '文学', en: 'Writing', sector: [110, 178],
    mood: '高处的柔光，像纸页上的午后',
    temper: { sunAz: 98, sunEl: 52, I: 0.92, rays: 0.15, exposure: 1.1, warm: 0.74, contrast: 0.97, sat: 0.94, mist: 0.05, wind: 0.6 },
    open: { R: 1.7, reach: 2.9 },   // a narrower, quieter reach
    twigs: [{ id: 'words-poem', zh: '诗', state: 'approved' }, { id: 'words-prose', zh: '散文与小说', state: 'approved' }]
  },
  {
    id: 'sound', zh: '音乐 · 声音', short: '声音', en: 'Music & sound', sector: [180, 248],
    mood: '有风的时候，叶子比平常更响',
    temper: { sunAz: -112, sunEl: 30, I: 1.02, rays: 0.4, exposure: 1.08, warm: 0.8, contrast: 1.04, sat: 1.0, wind: 2.1 },
    open: { R: 2.1, reach: 3.4 },   // loose and wide: room for the wind
    twigs: [{ id: 'sound-field', zh: '环境录音', state: 'approved' }, { id: 'sound-music', zh: '作曲与演奏', state: 'approved' }]
  },
  {
    id: 'image', zh: '绘画 · 设计', short: '绘画', en: 'Drawing & design', sector: [250, 318],
    mood: '正午的晴光，颜色最饱满的时候',
    temper: { sunAz: 148, sunEl: 48, I: 1.1, rays: 0.1, exposure: 1.08, warm: 0.5, contrast: 1.1, sat: 1.16, wind: 0.9 },
    open: { R: 1.8, reach: 3.0 },
    twigs: [{ id: 'image-drawing', zh: '绘画', state: 'approved' }, { id: 'image-type', zh: '字体与版式', state: 'approved' }]
  },
  {
    id: 'code', zh: '数字创作', short: '数字', en: 'Digital & code', sector: [320, 396],   // wraps past north
    mood: '日落之后的蓝色时刻，天光比太阳更亮',
    temper: { sunAz: 120, sunEl: 6, I: 0.58, rays: 0.25, exposure: 1.16, warm: 0.28, contrast: 1.02, sat: 1.0, wind: 0.8 },
    open: { R: 1.8, reach: 3.0 },
    twigs: [{ id: 'code-interactive', zh: '交互与网页', state: 'approved' }]
  }
];

export const byId = (id) => DIRECTIONS.find((d) => d.id === id) || null;

/** The direction whose sector holds azimuth `deg` (null in the gaps between limbs). */
export function directionAt(deg) {
  const a = ((deg % 360) + 360) % 360;
  for (const d of DIRECTIONS) {
    const [a0, a1] = d.sector;
    if ((a >= a0 && a <= a1) || (a1 > 360 && a + 360 <= a1)) return d;
  }
  return null;
}

/** Mid azimuth of a direction's sector (degrees, 0…360). */
export function midAzimuth(d) { return (((d.sector[0] + d.sector[1]) / 2) % 360 + 360) % 360; }

/** Twigs that exist on the tree (approved). Proposed or rejected ones are records, not space. */
export function liveTwigs(d) { return (d?.twigs || []).filter((t) => t.state === 'approved'); }
