import { MultiSurfaceGroundDetector, sampleDiscreteStairs } from '../engine/foot-ik-terrain.js';

/**
 * Exact discrete stair flights on Round 2 Campus (Three.js world XZ coordinates: tz = -sy).
 * Upgrades Round 2's continuous linear ramp bounds in collision.js into crisp horizontal
 * granite treads so procedural Foot IK steps up & down cleanly without hover or clip.
 */
const CAMPUS_STAIR_FLIGHTS = [
  // Block 1 portico steps (sy 6.9 -> 5.6 => tz -6.9 -> -5.6, rise 0.60 -> 1.05)
  { minX: -10.5, maxX: 10.5, minZ: -6.9, maxZ: -5.6, axis: 'z', yStart: 0.60, yEnd: 1.05, steps: 3 },
  // Forecourt West red granite front steps (sy 31.45 -> 29.8 => tz -31.45 -> -29.8, rise 0.148 -> 0.60)
  { minX: -12.5, maxX: -4.0, minZ: -31.45, maxZ: -29.8, axis: 'z', yStart: 0.148, yEnd: 0.60, steps: 4 },
  // Forecourt East red granite front steps
  { minX: 3.5, maxX: 12.5, minZ: -31.45, maxZ: -29.8, axis: 'z', yStart: 0.148, yEnd: 0.60, steps: 4 },
  // East plaza grey steps (sy 21.65 -> 20.5 => tz -21.65 -> -20.5, rise 0.15 -> 0.60)
  { minX: 14.5, maxX: 52.0, minZ: -21.65, maxZ: -20.5, axis: 'z', yStart: 0.15, yEnd: 0.60, steps: 3 },
  // West plaza grey steps
  { minX: -36.0, maxX: -14.5, minZ: -21.65, maxZ: -20.5, axis: 'z', yStart: 0.15, yEnd: 0.60, steps: 3 },
  // Art Education Center portico stairs facing Yanchi (sy -130.6 -> -132.5 => tz 130.6 -> 132.5, rise 0.15 -> 1.45)
  { minX: 28.5, maxX: 41.5, minZ: 130.6, maxZ: 132.5, axis: 'z', yStart: 0.15, yEnd: 1.45, steps: 8 },
];

/**
 * Create a high-precision R3 GroundDetector wrapping Round 2 CampusSpatial + quantized stairs.
 */
export function createCampusGroundDetector(spatial, optionalMeshes = []) {
  const analyticalHeight = (tx, tz, _refY, outNormal) => {
    const stepY = sampleDiscreteStairs(CAMPUS_STAIR_FLIGHTS, tx, tz);
    if (stepY !== null) {
      outNormal.set(0, 1, 0);
      return stepY;
    }
    const cy = spatial.heightAtThree(tx, tz);
    // Finite-difference surface normal for gentle campus terrain transitions
    const eps = 0.12;
    const hdx = spatial.heightAtThree(tx + eps, tz) - spatial.heightAtThree(tx - eps, tz);
    const hdz = spatial.heightAtThree(tx, tz + eps) - spatial.heightAtThree(tx, tz - eps);
    outNormal.set(-hdx / (2 * eps), 1, -hdz / (2 * eps)).normalize();
    return cy;
  };

  return new MultiSurfaceGroundDetector({
    meshes: optionalMeshes,
    analyticalHeight,
  });
}
