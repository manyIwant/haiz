/* V3 walking: analytical acceleration, capsule collisions and continuous floor support. */
(function (root) {
  'use strict';
  const SUBSTEP = .075, MAX_STEP = .24, GROUND_LIMIT = .4, EPSILON = 1e-7;
  const BODY_BOTTOM = .2, BODY_TOP = 1.7;
  const contains = (bounds, x, z) => x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
  const validBounds = bounds => bounds && [bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ].every(Number.isFinite) &&
    bounds.minX <= bounds.maxX && bounds.minZ <= bounds.maxZ;

  function rampProgress(surface, x, z) {
    const { from, to } = surface;
    const dx = to.x - from.x, dz = to.z - from.z;
    return ((x - from.x) * dx + (z - from.z) * dz) / (dx * dx + dz * dz);
  }

  function heightAt(surface, x, z) {
    if (!validBounds(surface) || !contains(surface, x, z)) return null;
    if (!surface.from && !surface.to) return Number.isFinite(surface.height) ? surface.height : null;
    const { from, to } = surface;
    if (!from || !to || ![from.x, from.z, from.y, to.x, to.z, to.y].every(Number.isFinite)) return null;
    const progress = rampProgress(surface, x, z);
    return Number.isFinite(progress) ? from.y + (to.y - from.y) * Math.max(0, Math.min(1, progress)) : null;
  }

  function groundExit(surfaces, position, x, z, floorY) {
    if (floorY <= EPSILON) return true;
    if (floorY > MAX_STEP + EPSILON) return false;
    return surfaces.some(surface => {
      if (!surface.from || heightAt(surface, position.x, position.z) === null) return false;
      const progress = rampProgress(surface, x, z);
      return (Math.abs(surface.from.y) <= EPSILON && progress <= 0) ||
        (Math.abs(surface.to.y) <= EPSILON && progress >= 1);
    });
  }

  function supportAt(core, surfaces, position, x, z, floorY) {
    const covered = surfaces.map(surface => ({ surface, height: heightAt(surface, x, z) }))
      .filter(candidate => candidate.height !== null);
    const reachable = covered.filter(candidate => Math.abs(candidate.height - floorY) <= MAX_STEP + EPSILON)
      .sort((a, b) => Math.abs(a.height - floorY) - Math.abs(b.height - floorY));
    if (reachable.length) return core.floorHeight(x, z, [reachable[0].surface], floorY);
    // Upper slabs do not capture a person on the ground; a high ramp side is a wall.
    if (covered.some(candidate => candidate.surface.from)) return null;
    return groundExit(surfaces, position, x, z, floorY) ? 0 : null;
  }

  function overlaps(x, z, collider, radius) {
    const px = Math.max(collider.minX, Math.min(x, collider.maxX));
    const pz = Math.max(collider.minZ, Math.min(z, collider.maxZ));
    return (x - px) ** 2 + (z - pz) ** 2 < radius ** 2;
  }

  /**
   * @param {{bounds:object,colliders?:Array<object>,collisionIndex?:object}} world
   * @param {{surfaces?:Array<object>,colliders?:Array<object>,rooms?:Array<object>}} [teaching]
   * @returns {{step:Function,reset:Function,currentRoom:Function}}
   */
  function create(world, teaching = {}) {
    const core = root.HaizV3Core, motion = root.CampusMotion;
    if (!core || !motion?.blocked) throw new Error('V3 walking requires HaizV3Core and CampusMotion.');
    if (!validBounds(world?.bounds)) throw new TypeError('V3 walking requires finite world bounds.');
    const surfaces = teaching?.surfaces || [], colliders = teaching?.colliders || [], rooms = teaching?.rooms || [];
    const radius = Number.isFinite(motion.RADIUS) ? motion.RADIUS : .32;
    let velocity = { x: 0, z: 0 };

    function blocked(x, z, floorY) {
      const bounds = world.bounds;
      if (x < bounds.minX + radius || x > bounds.maxX - radius ||
          z < bounds.minZ + radius || z > bounds.maxZ - radius) return true;
      if (floorY < GROUND_LIMIT && motion.blocked(x, z, world.collisionIndex || world.colliders || [], bounds, radius)) return true;
      return colliders.some(collider => collider.minY < floorY + BODY_TOP && collider.maxY > floorY + BODY_BOTTOM &&
        overlaps(x, z, collider, radius));
    }

    function moveAxis(position, floorY, axis, delta) {
      const next = { ...position, [axis]: position[axis] + delta };
      const height = supportAt(core, surfaces, position, next.x, next.z, floorY);
      if (height === null || blocked(next.x, next.z, height)) return { position, floorY, blocked: true };
      return { position: next, floorY: height, blocked: false };
    }

    /** Reset momentum after pausing, teleporting or changing navigation mode. @returns {void} */
    function reset() { velocity = { x: 0, z: 0 }; }

    /**
     * Returns a new horizontal position; the runtime applies its own eye height.
     * @param {{x:number,z:number}} pos
     * @param {{x?:number,y?:number,run?:boolean,speedScale?:number}} input
     * @param {number} yaw
     * @param {number} dt
     * @param {number} [floorY=0]
     * @returns {{position:object,floorY:number,distance:number,velocity:{x:number,z:number}}}
     */
    function step(pos, input, yaw, dt, floorY = 0) {
      if (!Number.isFinite(pos?.x) || !Number.isFinite(pos?.z)) throw new TypeError('V3 walking requires a finite position.');
      const initialFloor = Number.isFinite(floorY) ? floorY : 0;
      if (!Number.isFinite(dt) || dt <= 0) {
        reset();
        return { position: { ...pos }, floorY: initialFloor, distance: 0, velocity: { ...velocity } };
      }
      const integrated = core.stepMotion({ velocity }, input, yaw, dt);
      const steps = Math.max(1, Math.ceil(Math.hypot(integrated.delta.x, integrated.delta.z) / SUBSTEP));
      let position = { ...pos }, height = initialFloor, distance = 0, blockedX = false, blockedZ = false;
      for (let i = 0; i < steps; i++) {
        const start = position;
        if (!blockedX && integrated.delta.x) {
          const moved = moveAxis(position, height, 'x', integrated.delta.x / steps);
          position = moved.position; height = moved.floorY; blockedX = moved.blocked;
        }
        if (!blockedZ && integrated.delta.z) {
          const moved = moveAxis(position, height, 'z', integrated.delta.z / steps);
          position = moved.position; height = moved.floorY; blockedZ = moved.blocked;
        }
        distance += Math.hypot(position.x - start.x, position.z - start.z);
      }
      velocity = { x: blockedX ? 0 : integrated.velocity.x, z: blockedZ ? 0 : integrated.velocity.z };
      return { position, floorY: height, distance, velocity: { ...velocity } };
    }

    /** @param {number} x @param {number} z @param {number} [floorY=0] @returns {object|null} */
    function currentRoom(x, z, floorY = 0) {
      if (![x, z, floorY].every(Number.isFinite)) return null;
      const room = rooms.find(room => contains(room, x, z) && floorY >= room.minY - EPSILON && floorY < room.maxY - EPSILON);
      if (room) return room;
      return floorY < GROUND_LIMIT ? root.CampusInteriors?.currentRoom(x, z) || null : null;
    }

    return Object.freeze({ step, reset, currentRoom });
  }

  root.HaizV3Walker = Object.freeze({ create });
})(window);
