import { Raycaster, Matrix3, DoubleSide, Vector3 } from 'three';

const DOWN = new Vector3(0, -1, 0);
const UP = new Vector3(0, 1, 0);
const INSIDE_SEARCH = 1000;
const INSIDE_TOLERANCE = 1e-6;

function singleSided(hit) {
  const mat = hit.object?.material;
  if (!mat || !hit.face) return false;
  const used = Array.isArray(mat) ? mat[hit.face.materialIndex] : mat;
  return used !== undefined && used.side !== DoubleSide;
}

/**
 * Multi-surface GroundDetector compatible with three-procedural-locomotion v0.11.0.
 * Combines high-precision analytical ground/stair surfaces (for R2/R3 heightfields
 * and quantized stairs) with optional Three.js mesh raycasting.
 */
export class MultiSurfaceGroundDetector {
  /**
   * @param {Object} opts
   * @param {import('three').Object3D[]} [opts.meshes]
   * @param {(x:number, z:number, refY:number, outNormal:import('three').Vector3) => number|null} [opts.analyticalHeight]
   */
  constructor({ meshes = [], analyticalHeight = null } = {}) {
    this.targets = meshes;
    this.analyticalHeight = analyticalHeight;
    this.raycaster = new Raycaster();
    this.normalMatrix = new Matrix3();
    this.above = new Vector3();
    this.hits = [];
    this.tmpNormal = new Vector3(0, 1, 0);
  }

  castDown(origin, maxDistance, out) {
    let bestY = -Infinity;
    let found = false;
    out.normal.set(0, 1, 0);

    // 1. Optional analytical height + discrete stairs
    if (this.analyticalHeight) {
      this.tmpNormal.set(0, 1, 0);
      const ay = this.analyticalHeight(origin.x, origin.z, origin.y, this.tmpNormal);
      if (ay !== null && Number.isFinite(ay)) {
        const dist = origin.y - ay;
        if (dist <= maxDistance && dist >= -0.42) {
          bestY = ay;
          out.point.set(origin.x, ay, origin.z);
          out.normal.copy(this.tmpNormal).normalize();
          if (out.normal.y < 0) out.normal.negate();
          out.distance = dist;
          found = true;
        }
      }
    }

    // 2. Raycast against terrain/stair/prop meshes if provided
    if (this.targets && this.targets.length > 0) {
      this.raycaster.set(this.above.set(origin.x, origin.y + INSIDE_SEARCH, origin.z), DOWN);
      this.raycaster.near = 0;
      this.raycaster.far = INSIDE_SEARCH + maxDistance;
      this.hits.length = 0;
      this.raycaster.intersectObjects(this.targets, true, this.hits);

      let top = null;
      let ground = null;
      for (const hit of this.hits) {
        if (hit.point.y <= origin.y) {
          ground = hit;
          break;
        }
        if (hit.point.y >= origin.y + INSIDE_TOLERANCE && singleSided(hit)) {
          top = hit;
        }
      }
      const chosen = top && !this._ceilingBelow(origin, top.point.y) ? top : ground;
      if (chosen) {
        const dist = origin.y - chosen.point.y;
        if (dist <= maxDistance && (!found || chosen.point.y > bestY)) {
          out.point.copy(chosen.point);
          const localN = chosen.normal ?? chosen.face?.normal;
          if (localN) {
            this.normalMatrix.getNormalMatrix(chosen.object.matrixWorld);
            out.normal.copy(localN).applyMatrix3(this.normalMatrix).normalize();
            if (out.normal.y < 0) out.normal.negate();
          } else {
            out.normal.set(0, 1, 0);
          }
          out.distance = dist;
          found = true;
        }
      }
    }

    return found;
  }

  _ceilingBelow(origin, topY) {
    this.raycaster.set(origin, UP);
    this.raycaster.near = 0;
    this.raycaster.far = topY - origin.y - INSIDE_TOLERANCE;
    this.hits.length = 0;
    this.raycaster.intersectObjects(this.targets, true, this.hits);
    return this.hits.some(singleSided);
  }
}

/**
 * Evaluate a list of discrete stair flights so both physical feet and UI terrain
 * queries sample clean flat treads with upward normals (0,1,0).
 *
 * Each flight: { minX, maxX, minZ, maxZ, axis: 'x'|'z', yStart, yEnd, steps }
 */
export function sampleDiscreteStairs(flights, x, z) {
  for (let i = 0; i < flights.length; i++) {
    const f = flights[i];
    if (x < f.minX || x > f.maxX || z < f.minZ || z > f.maxZ) continue;
    const span = f.axis === 'x' ? f.maxX - f.minX : f.maxZ - f.minZ;
    const coord = f.axis === 'x' ? x - f.minX : z - f.minZ;
    const u = Math.min(Math.max(coord / Math.max(span, 1e-4), 0), 0.9999);
    const stepIdx = Math.min(f.steps - 1, Math.floor(u * f.steps));
    const stepFrac = (stepIdx + 0.5) / f.steps;
    return f.yStart + (f.yEnd - f.yStart) * ((stepIdx + 1) / f.steps);
  }
  return null;
}

/**
 * Real-time foot placement & ground-contact telemetry tracker.
 * Used in both the Motion Acceptance Lab and the automated Playwright analyzer.
 */
export class FootTelemetryTracker {
  constructor({ soleOffset = 0.046 } = {}) {
    this.soleOffset = soleOffset;
    this.prevLeft = new Vector3();
    this.prevRight = new Vector3();
    this.hasPrev = false;
    this.maxPenetration = 0;
    this.maxHoverStance = 0;
    this.slideSamples = [];
    this.penetrationSamples = [];
    this.lastMetrics = {
      leftPhase: 'PLANTED',
      rightPhase: 'PLANTED',
      leftSlideMmS: 0,
      rightSlideMmS: 0,
      leftPenetrationMm: 0,
      rightPenetrationMm: 0,
      leftClearanceMm: 0,
      rightClearanceMm: 0,
      leftGroundY: 0,
      rightGroundY: 0,
    };
  }

  reset() {
    this.hasPrev = false;
    this.maxPenetration = 0;
    this.maxHoverStance = 0;
    this.slideSamples.length = 0;
    this.penetrationSamples.length = 0;
  }

  /**
   * Sample actual rendered foot/toe world positions relative to detected ground.
   */
  sample(dt, { leftFootWorld, leftToeWorld, rightFootWorld, rightToeWorld, feetState, detector }) {
    const out = { point: new Vector3(), normal: new Vector3(0, 1, 0), distance: 0 };
    const probe = new Vector3();

    const evalSide = (footPos, toePos, phase, prevPos) => {
      probe.set(footPos.x, footPos.y + 0.65, footPos.z);
      const hit = detector.castDown(probe, 1.8, out);
      const gy = hit ? out.point.y : 0;

      // Actual sole height approximated from ankle bone & toe bone lowest contact
      const ankleSoleY = footPos.y - this.soleOffset;
      const toeSoleY = toePos ? toePos.y - 0.022 : ankleSoleY;
      const minSoleY = Math.min(ankleSoleY, toeSoleY);
      const clearance = minSoleY - gy;
      const penetration = Math.max(0, gy - minSoleY);

      let slideMmS = 0;
      if (this.hasPrev && dt > 1e-4 && phase === 'PLANTED') {
        const horizMove = Math.hypot(footPos.x - prevPos.x, footPos.z - prevPos.z);
        slideMmS = (horizMove / dt) * 1000;
        this.slideSamples.push(slideMmS);
      }
      if (phase === 'PLANTED') {
        this.penetrationSamples.push(penetration * 1000);
        if (penetration > this.maxPenetration) this.maxPenetration = penetration;
        if (clearance > this.maxHoverStance) this.maxHoverStance = clearance;
      }

      return {
        phase,
        slideMmS,
        penetrationMm: penetration * 1000,
        clearanceMm: clearance * 1000,
        groundY: gy,
      };
    };

    const L = evalSide(leftFootWorld, leftToeWorld, feetState.left.phase, this.prevLeft);
    const R = evalSide(rightFootWorld, rightToeWorld, feetState.right.phase, this.prevRight);

    this.prevLeft.copy(leftFootWorld);
    this.prevRight.copy(rightFootWorld);
    this.hasPrev = true;

    this.lastMetrics = {
      leftPhase: L.phase,
      rightPhase: R.phase,
      leftSlideMmS: L.slideMmS,
      rightSlideMmS: R.slideMmS,
      leftPenetrationMm: L.penetrationMm,
      rightPenetrationMm: R.penetrationMm,
      leftClearanceMm: L.clearanceMm,
      rightClearanceMm: R.clearanceMm,
      leftGroundY: L.groundY,
      rightGroundY: R.groundY,
    };
    return this.lastMetrics;
  }

  summary() {
    const p95 = (arr) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
    };
    const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    return {
      samples: this.slideSamples.length,
      slideMeanMmS: mean(this.slideSamples),
      slideP95MmS: p95(this.slideSamples),
      penetrationMaxMm: this.maxPenetration * 1000,
      penetrationP95Mm: p95(this.penetrationSamples),
      hoverMaxMm: this.maxHoverStance * 1000,
    };
  }
}
