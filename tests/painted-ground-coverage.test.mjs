import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../package.json', import.meta.url));
const { createCanvas, Path2D, DOMMatrix } = require('@napi-rs/canvas');
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.Path2D = Path2D;
globalThis.DOMMatrix = DOMMatrix;
const threeURL = new URL('../lanren/vendor/three/three.module.min.js', import.meta.url).href;
const moduleURL = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const atmosURL = moduleURL(readFileSync(new URL('../lanren/ruhua-stroll/atmos.js', import.meta.url), 'utf8').replace("'three'", JSON.stringify(threeURL)));
const groundURL = moduleURL(readFileSync(new URL('../lanren/ruhua-stroll/ground.js', import.meta.url), 'utf8')
  .replace("'three'", JSON.stringify(threeURL)).replace("'./atmos.js'", JSON.stringify(atmosURL)));
const THREE = await import(threeURL);
const { createGround } = await import(groundURL);

test('installed terrain replaces old paint and grass only inside its transformed triangles', () => {
  const ground = createGround({ frame: { ground: 0, sheet: { x0: -10, z0: -10, x1: 10, z1: 10 } }, features: [] }, [], 256);
  const root = new THREE.Group();
  root.position.set(2, 0, 1);
  root.rotation.y = Math.PI / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 8, 8, 0, 0], 3));
  geometry.setIndex([0, 1, 2]);
  const surface = new THREE.Mesh(geometry);
  surface.name = 'site.ground.forecourt.road';
  root.add(surface);
  const lawnGeometry = geometry.clone();
  lawnGeometry.translate(0, 0.15, 0);
  const lawn = new THREE.Mesh(lawnGeometry);
  const lawnGroup = new THREE.Group();
  lawnGroup.name = 'site.ground.forecourt.lawns';
  lawnGroup.position.x = -10;
  lawnGroup.add(lawn);
  root.add(lawnGroup);
  const sample = (canvas, x, z) => {
    const pixelsPerMetre = canvas.width / ground.paint.span;
    const px = Math.floor((x - ground.paint.x0) * pixelsPerMetre);
    const py = Math.floor((z - ground.paint.z0) * pixelsPerMetre);
    return [...canvas.getContext('2d').getImageData(px, py, 1, 1).data];
  };
  const outside = sample(ground.paint.c, 8, -5);
  ground.coverSurface(root);
  assert.equal(sample(ground.paint.c, 3, 0)[3], 0, 'overlapping old floor must be removed');
  assert.equal(sample(ground.mask.c, 3, 0)[0], 0, 'old grass must not grow through the replacement');
  assert.deepEqual(sample(ground.paint.c, 8, -5), outside, 'triangle bounds must not erase the uncovered corner');
  assert.equal(sample(ground.paint.c, -5, 5)[3], 255, 'surrounding campus stays covered');
  assert.equal(sample(ground.mask.c, 3, 10)[0], 255, 'the replacement lawn keeps its grass');
  assert.equal(sample(ground.mask.c, 3, 10)[2], 10, 'grass roots follow the raised 15 cm lawn');
});
