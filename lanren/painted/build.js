// Layer 4 · the campus buildings, painted — and still the buildings.
//
// Geometry, positions, storeys, decks and colliders are the Blender V3 campus as surveyed for HAIZ; nothing
// here moves a vertex. What changes is how a wall is painted:
//
//   planes    clean value zones: the painted light (art.js) with a brush-carried terminator and shadow
//             shapes, so a lit wall, a shaded wall and a shadow across a wall are three clear areas
//   walls     a gouache wash — large soft patches that shift hue more than value — level plaster strokes
//             near, rain streaks down from the sills, the warm foot where the paving's light bounces up
//   rhythm    a band of soft shade under every 3.6 m storey line: the shadow a slab, an eave or an open
//             corridor throws, the rhythm a teaching block has from across the lawn
//   variety   each building (a 26 m cell of the campus) gets its own small shift of tint and wear, so the
//             repeated modules of a block of classrooms are not one colour
//   glass     the sky in a few painted values and, along the horizon, the campus's own crowns as a dark
//             ragged band — what a window across a lawn of trees actually shows
//
// (Painted Valley's village draws tiles and shutters from the wall's own coordinates; the idea is shared,
// the walls are HAIZ's.)
import { celPlus, ART } from './art.js';
import { SHADOW_PRE } from './ground.js';

const WALL_CORE = /* glsl */`
  float kS = uArt * uArtL.z;
  float hgt = vWP.y - uGroundY;
  float vertical = 1.0 - abs(N.y);
  vec2 tng = normalize(vec2(-N.z, N.x) + 1e-4);
  float along = dot(vWP.xz, tng);
  vec2 wq = vec2(along, hgt);
  float foot = artFoot(vWP);
  float bh = aHash(floor(vWP.xz / 26.0) + 0.37);
  vec2 pq = vertical > 0.5 ? wq : vWP.xz;
  float wash = artDab(pq / vec2(8.5, 5.5) + bh * 3.1);
  float plaster = artStroke(pq / vec2(3.4, 0.8) + 0.7) * artVis(0.5, foot);
  float drip = artStroke(vec2(wq.y / 6.0, wq.x / 0.8) + bh * 1.7);
#ifdef ART_FLATTEN
  // the photographed texture under the paint is mostly painted out: a background painter does not draw every stone
  vec3 a0 = mix(albedo, uMean * diffuse, kS * 0.75);
#else
  vec3 a0 = albedo;
#endif
  // two washes of the wall's colour, the brush deciding where each lies (a painted wall, not a noisy one)
  float wT = 0.04 + 0.12 * smoothstep(0.03, 0.25, foot);
  vec3 a = a0 * mix(0.95, 1.035, smoothstep(0.5 - wT, 0.5 + wT, 0.5 + wash * 2.0)) * (1.0 + plaster * 0.04);
  a *= mix(vec3(0.975, 0.99, 1.03), vec3(1.03, 1.0, 0.95), clamp(0.5 + wash * 2.2, 0.0, 1.0));
  float sill = smoothstep(0.32, 0.6, fract(hgt / 3.6));
  a *= 1.0 - vertical * smoothstep(0.1, 0.32, drip) * (0.08 + 0.1 * uWet) * smoothstep(1.0, 4.0, hgt) * sill;
  a *= mix(vec3(0.97, 0.985, 1.01), vec3(1.035, 1.0, 0.965), bh);
  float band = smoothstep(0.8, 0.985, fract(hgt / 3.6)) * vertical * step(1.2, hgt);
  float aoS = ao * (1.0 - band * 0.22);
  // a flat wall is lit or shaded as a whole: no brush on its terminator (that is for round things)
  vec3 col = artLight(a, N, vWP, shadow, aoS, soft + 0.015, 0.0);
`;
const WALL_AFTER = /* glsl */`
{
${WALL_CORE}
  col += a * uGroundAmb * uSunColor * 0.24 * wallBounce * max(uSunDir.y, 0.2);
  outCol = mix(outCol, col, kS);
}
`;
const PLAIN_AFTER = /* glsl */`
{
${WALL_CORE}
  outCol = mix(outCol, col, kS);
}
`;
const GLASS_AFTER = /* glsl */`
{
  float kS = uArt * uArtL.z;
  vec3 V = normalize(cameraPosition - vWP);
  vec3 R = reflect(-V, N);
  float fres = 0.16 + 0.84 * pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float hgt = vWP.y - uGroundY;
  vec2 tng = normalize(vec2(-N.z, N.x) + 1e-4);
  float along = dot(vWP.xz, tng);
  float az = atan(R.x, R.z);
  float top = 0.05 + 0.12 * aNoise(vec2(az * 5.0 + along * 0.015, 1.3)) + 0.05 * aNoise(vec2(az * 19.0, 4.1));
  top *= mix(1.0, 0.45, smoothstep(4.0, 16.0, hgt));
  float trees = (1.0 - smoothstep(top - 0.012, top + 0.012, R.y)) * smoothstep(-0.3, -0.06, R.y);
  vec3 treeC = vec3(0.05, 0.11, 0.07) * (uSkyAmb * 0.9 + uSunColor * 0.22);
  float l = artLuma(outCol);
  float lq = artSteps(clamp(l * 1.1, 0.0, 1.0), 3.0, 0.1) / 1.1;
  vec3 painted = outCol * mix(1.0, lq / max(l, 1e-4), 0.7);
  // each pane painted as a painter does glass: the sky's light laid in from the top of the pane, fading down,
  // a lighter diagonal on some, the value of each pane its own
  vec2 pane = vec2(floor(along / 1.75), floor(hgt / 3.6));
  float ph = aHash(pane + 5.3), py = fract(hgt / 3.6);
  vec3 skyTop = skyColor(normalize(vec3(R.x, max(R.y, 0.08) + 0.25, R.z)));
  float sheen = smoothstep(0.35, 0.95, py) * mix(0.18, 0.42, ph) * (1.0 - uLamps * 0.8);
  float diag = smoothstep(0.9, 0.93, fract((along * 0.6 + hgt * 0.9) * 0.22 + ph * 3.0)) * (1.0 - smoothstep(0.95, 0.99, fract((along * 0.6 + hgt * 0.9) * 0.22 + ph * 3.0))) * step(0.55, ph);
  painted = mix(painted, skyTop * 0.85, sheen + diag * 0.35);
  painted = mix(painted, treeC, trees * clamp(fres * 1.4, 0.0, 0.85) * (1.0 - uLamps * 0.6));
  outCol = mix(outCol, painted, kS);
}
`;

export function upgradeBuildings(world) {
  const c = world.campus;
  if (!c) return { materials: 0 };
  const cache = new Map();
  const up = (m) => {
    if (!m?.userData?.celOpts) return m;
    if (!cache.has(m)) {
      const isGlass = m.name === 'glass' || m.name === 'campus-Interior';
      const isWall = (m.userData.celOpts.fragment?.albedo || '').includes('wallBounce');
      const flat = /uMean/.test(m.userData.celOpts.fragment?.head || '');
      const n = celPlus(m, {
        key: isGlass ? 'glass' : isWall ? 'wall' : 'build', info: isGlass ? 'vec4(0.0, 0.0, 1.0, 0.12)' : 'vec4(0.0, 0.0, 1.0, 0.4)',
        fragment: { head: '#define ART_LAYER uArtL.z\n', pre: SHADOW_PRE('1.9'), after: isGlass ? GLASS_AFTER : isWall ? WALL_AFTER : PLAIN_AFTER },
      });
      if (flat) n.defines = { ...(n.defines || {}), ART_FLATTEN: '' };
      cache.set(m, n);
    }
    return cache.get(m);
  };
  c.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(up) : up(o.material);
  });
  return { materials: cache.size, uniforms: ART };
}
