/* Representative upper classroom: an interpretation, not a measured survey. */
(function (root) {
  'use strict';
  const FLOOR = 3.8, CEILING = 7.4, STAIR_START = 2.2, STAIR_END = 10.8, TREADS = 20;
  const ROOM = { minX: -13.8, maxX: -1.8, minZ: -12.9, maxZ: -1.6 };

  function batcher(T, group, materials) {
    const geometry = new T.BoxGeometry(1, 1, 1), transform = new T.Object3D(), batches = new Map();
    function box(key, x, y, z, width, height, depth, rx = 0) {
      transform.position.set(x, y, z); transform.rotation.set(rx, 0, 0); transform.scale.set(width, height, depth);
      transform.updateMatrix();
      batches.set(key, [...(batches.get(key) || []), transform.matrix.clone()]);
    }
    function flush() {
      for (const [key, matrices] of batches) {
        const mesh = new T.InstancedMesh(geometry, materials[key], matrices.length);
        matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.frustumCulled = false;
        mesh.castShadow = key !== 'paper'; mesh.receiveShadow = true;
        mesh.name = 'yihao-201:' + key; mesh.userData.noMerge = true; mesh.userData.interiorBatch = key;
        group.add(mesh);
      }
    }
    return { box, flush };
  }

  function roomLabel(T, group) {
    // Canvas is optional in the pure geometry tests; room metadata always carries the notice.
    if (!root.document?.createElement) return;
    const canvas = root.document.createElement('canvas'); canvas.width = 768; canvas.height = 192;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#eee9dc'; context.fillRect(0, 0, 768, 192);
    context.fillStyle = '#444c41'; context.textAlign = 'center';
    context.font = '64px sans-serif'; context.fillText('201', 384, 79);
    context.font = '32px sans-serif'; context.fillText('体验性室内，非测绘', 384, 143);
    const texture = new T.CanvasTexture(canvas); texture.encoding = T.sRGBEncoding;
    const label = new T.Mesh(new T.PlaneGeometry(1.3, .325), new T.MeshStandardMaterial({ map: texture, roughness: .9 }));
    label.position.set(-5, FLOOR + 2.85, -1.485); label.name = 'yihao-201:notice'; group.add(label);
  }

  function shell(box, obstacle) {
    // Three slab rectangles leave the stairwell open; the separate landing joins the two sides.
    const rectangles = [[-14.4, -1.45, -13.3, 13.3], [1.45, 14.4, -13.3, 13.3], [-1.45, 1.45, -13.3, 2]];
    for (const [minX, maxX, minZ, maxZ] of [...rectangles, [-1.45, 1.45, 11, 13.2]]) {
      box('floor', (minX + maxX) / 2, FLOOR - .09, (minZ + maxZ) / 2, maxX - minX, .18, maxZ - minZ);
    }
    box('ceiling', 0, CEILING + .06, 0, 28.8, .12, 26.6);
    function wall(id, minX, maxX, minZ, maxZ, minY = FLOOR, maxY = CEILING) {
      box('wall', (minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2, maxX - minX, maxY - minY, maxZ - minZ);
      obstacle(id, minX, maxX, minZ, maxZ, minY, maxY);
    }
    // The outer envelope stays inside the Blender shell without obscuring its upper windows.
    wall('west-end', -14.4, -14.22, -13.3, 13.3);
    wall('east-end', 14.22, 14.4, -13.3, 13.3);
    for (const z of [-13.32, 13.32]) {
      wall('window-sill', -14.4, 14.4, z - .07, z + .07, FLOOR, 4.88);
      wall('window-head', -14.4, 14.4, z - .07, z + .07, 6.8, CEILING);
      // Height-aware boundary collision leaves the actual window opening transparent.
      obstacle('window-edge', -14.4, 14.4, z - .07, z + .07, FLOOR, CEILING);
    }
    wall('classroom-west', -13.92, -13.8, -12.96, -1.5);
    wall('classroom-east', -1.8, -1.68, -12.96, -1.5);
    wall('corridor-west', -13.92, -5.8, -1.7, -1.5);
    wall('corridor-east', -4.2, -1.68, -1.7, -1.5);
    wall('door-header', -5.8, -4.2, -1.7, -1.5, FLOOR + 2.35, CEILING);
    for (const x of [-5.83, -4.17]) box('frame', x, FLOOR + 1.17, -1.48, .06, 2.34, .035);
    box('frame', -5, FLOOR + 2.37, -1.48, 1.72, .06, .035);
    box('dado', -13.76, FLOOR + .065, -7.3, .035, .13, 11.1);
    box('dado', -1.84, FLOOR + .065, -7.3, .035, .13, 11.1);
  }

  function staircase(box, obstacle) {
    const run = STAIR_END - STAIR_START, rise = FLOOR / TREADS, depth = run / TREADS;
    for (let i = 0; i < TREADS; i++) {
      box('floor', 0, (i + .5) * rise, STAIR_START + (i + .5) * depth, 2.3, rise, depth);
    }
    const angle = -Math.atan2(FLOOR, run), length = Math.hypot(FLOOR, run);
    box('wall', 0, FLOOR / 2 - .12, (STAIR_START + STAIR_END) / 2, 2.3, .14, length, angle);
    for (const side of [-1, 1]) {
      const x = side * 1.19;
      box('steel', x, FLOOR / 2 + .98, (STAIR_START + STAIR_END) / 2, .045, .045, length, angle);
      for (let i = 0; i <= 8; i++) {
        const z = STAIR_START + run * i / 8, y = FLOOR * i / 8;
        box('steel', x, y + .48, z, .035, .96, .035);
      }
      // Short collision segments follow the rail slope without a tall AABB blocking the flight.
      for (let i = 0; i < TREADS; i++) {
        const minZ = STAIR_START + i * depth, maxZ = minZ + depth;
        obstacle('stair-rail', x - .025, x + .025, minZ, maxZ, i * rise, (i + 1) * rise + 1.05);
      }
      // Hole guards keep the side route usable and leave the top landing open.
      const guardX = side * 1.45;
      box('steel', guardX, FLOOR + .98, 6.5, .045, .045, 9);
      for (const z of [2, 4.25, 6.5, 8.75, 11]) box('steel', guardX, FLOOR + .49, z, .035, .98, .035);
      obstacle('well-guard', guardX - .025, guardX + .025, 2, 11, FLOOR, FLOOR + 1.05);
    }
    // The south lip protects the main corridor without obstructing the ground stair entrance.
    box('steel', 0, FLOOR + .98, 2, 2.9, .045, .045);
    for (const x of [-1.43, 0, 1.43]) box('steel', x, FLOOR + .49, 2, .035, .98, .035);
    obstacle('well-front-guard', -1.45, 1.45, 1.975, 2.025, FLOOR, FLOOR + 1.05);
    box('steel', 0, FLOOR + .98, 13.18, 2.9, .045, .045);
    obstacle('landing-edge', -1.45, 1.45, 13.155, 13.205, FLOOR, FLOOR + 1.05);
  }

  function furniture(box, obstacle) {
    for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
      const x = -12.1 + col * 2.0, z = -9.55 + row * 1.65;
      box('desk', x, FLOOR + .725, z, .65, .05, .45);
      box('dark', x, FLOOR + .55, z, .54, .025, .35);
      for (const dx of [-.275, .275]) for (const dz of [-.165, .165]) {
        box('steel', x + dx, FLOOR + .35, z + dz, .028, .7, .028);
      }
      const chairZ = z + .65;
      box('chair', x, FLOOR + .435, chairZ, .45, .03, .43);
      box('chair', x, FLOOR + .72, chairZ + .19, .45, .3, .035);
      for (const dx of [-.18, .18]) for (const dz of [-.16, .16]) {
        box('steel', x + dx, FLOOR + .21, chairZ + dz, .026, .42, .026);
      }
      for (const dx of [-.18, .18]) box('steel', x + dx, FLOOR + .61, chairZ + .19, .024, .42, .024);
      box('book', x + .04, FLOOR + .765, z - .02, .22, .03, .29);
      box('paper', x + .04, FLOOR + .783, z - .02, .2, .006, .27);
      obstacle('desk', x - .325, x + .325, z - .225, z + .225, FLOOR, FLOOR + .75);
      obstacle('chair', x - .225, x + .225, chairZ - .215, chairZ + .215, FLOOR, FLOOR + .87);
    }
    box('frame', -7.8, FLOOR + 2, -13.075, 5.2, 1.5, .08);
    box('dark', -7.8, FLOOR + 2, -13.02, 5, 1.32, .035);
    box('desk', -8, FLOOR + .755, -11.6, 1.4, .07, .65);
    for (const dx of [-.6, .6]) box('steel', -8 + dx, FLOOR + .36, -11.6, .04, .72, .5);
    obstacle('teacher-desk', -8.7, -7.3, -11.925, -11.275, FLOOR, FLOOR + .79);
  }

  /**
   * @param {{buildings:Array<{data:{id:string},group:object}>}} world
   * @returns {{group:object,surfaces:Array<object>,colliders:Array<object>,rooms:Array<object>,stair:object}}
   */
  function build(world) {
    const T = root.THREE, materials = root.CampusInteriors?.materials;
    const building = world?.buildings?.find(building => building.data.id === 'yihao');
    if (!T || !materials || !building?.group) throw new Error('Upper teaching interior requires Three.js, interior materials and the yihao root.');
    const parent = building.group, group = new T.Group(); group.name = 'yihao-v3-teaching';
    group.userData.noMerge = true; group.userData.interior = true;
    group.userData.notice = '体验性室内，非测绘';
    parent.add(group); parent.updateWorldMatrix(true, false);
    const batches = batcher(T, group, materials), colliders = [];
    const point = (x, y, z) => new T.Vector3(x, y, z).applyMatrix4(parent.matrixWorld);
    function bounds(minX, maxX, minZ, maxZ, minY, maxY) {
      const corners = [minX, maxX].flatMap(x => [minY, maxY].flatMap(y => [minZ, maxZ].map(z => point(x, y, z))));
      return { minX: Math.min(...corners.map(p => p.x)), maxX: Math.max(...corners.map(p => p.x)),
        minZ: Math.min(...corners.map(p => p.z)), maxZ: Math.max(...corners.map(p => p.z)),
        minY: Math.min(...corners.map(p => p.y)), maxY: Math.max(...corners.map(p => p.y)) };
    }
    function obstacle(id, minX, maxX, minZ, maxZ, minY, maxY) {
      colliders.push({ id: 'yihao-201:' + id, ...bounds(minX, maxX, minZ, maxZ, minY, maxY) });
    }
    shell(batches.box, obstacle); staircase(batches.box, obstacle); furniture(batches.box, obstacle);
    batches.flush(); roomLabel(T, group);
    const flats = [[-14.4, -1.45, -13.3, 13.3], [1.45, 14.4, -13.3, 13.3],
      [-1.45, 1.45, -13.3, 2], [-1.45, 1.45, 11, 13.2]];
    const surfaces = flats.map(([minX, maxX, minZ, maxZ]) => ({
      ...bounds(minX, maxX, minZ, maxZ, FLOOR, FLOOR), height: point(0, FLOOR, 0).y,
    }));
    const ramp = { ...bounds(-1.15, 1.15, STAIR_START, 11.1, 0, FLOOR),
      from: point(0, 0, STAIR_START), to: point(0, FLOOR, STAIR_END) };
    const door = point(-5, FLOOR, -1.6), center = point(-7.8, FLOOR, -7.25);
    const room = { id: 'yihao-201', buildingId: 'yihao', name: '一号教学楼 · 201教室',
      notice: '体验性室内，非测绘', group, deskCount: 20,
      ...bounds(ROOM.minX, ROOM.maxX, ROOM.minZ, ROOM.maxZ, FLOOR, CEILING),
      center: { x: center.x, z: center.z }, door: { x: door.x, z: door.z, width: 1.6 },
      arrival: { x: door.x, z: point(-5, FLOOR, 0).z }, floorY: center.y };
    group.updateMatrixWorld(true);
    return { group, surfaces: [...surfaces, ramp], colliders, rooms: [room],
      stair: { ...ramp, width: 2.3, treads: TREADS, rise: FLOOR / TREADS, floorY: FLOOR } };
  }

  root.HaizV3Teaching = Object.freeze({ build });
})(window);
