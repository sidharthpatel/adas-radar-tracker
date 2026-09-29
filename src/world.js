// The "ground truth" simulation: a handful of vehicles cruising a highway,
// simulated in the ego car's own reference frame so the ego never has to
// move (its speed is simply subtracted from everyone else's). This is also
// exactly what a real radar measures — relative range and closing speed.
const LANE_Y = { left: -3.5, mid: 0, right: 3.5 };
const RESPAWN_AHEAD = 90; // a vehicle that falls this far behind ego respawns ahead
const RESPAWN_BEHIND = -20; // a vehicle that pulls this far ahead respawns behind

export const VEHICLE_KINDS = [
  { model: 'traffic_sedan', speed: 24, lane: 'mid' },
  { model: 'traffic_hatchback', speed: 27, lane: 'left' },
  { model: 'traffic_suv', speed: 22, lane: 'right' },
  { model: 'traffic_wagon', speed: 26, lane: 'left' },
  { model: 'traffic_compact', speed: 20, lane: 'right' },
];

export class World {
  constructor() {
    this.egoSpeed = 25; // m/s (≈ 56 mph) — the reference speed; only relative motion matters
    this.vehicles = VEHICLE_KINDS.map((k, i) => ({
      id: i,
      model: k.model,
      baseSpeed: k.speed,
      y: LANE_Y[k.lane],
      x: 20 + i * 15, // staggered starting gaps
    }));
  }

  /** Advance every vehicle's position by dt seconds, relative to the ego. */
  step(dt) {
    for (const v of this.vehicles) {
      v.x += (v.baseSpeed - this.egoSpeed) * dt;
      if (v.x > RESPAWN_AHEAD) v.x -= RESPAWN_AHEAD - RESPAWN_BEHIND;
      if (v.x < RESPAWN_BEHIND) v.x += RESPAWN_AHEAD - RESPAWN_BEHIND;
    }
  }

  /**
   * What the radar actually sees this frame: noisy (x, y) for vehicles inside
   * the forward cone, dropped entirely (no detection at all) for anything
   * outside it — exactly how a real radar's field of view works.
   */
  detect({ rangeM, halfFovRad, noiseStd, dropoutProb, rng }) {
    const detections = [];
    for (const v of this.vehicles) {
      if (v.x <= 0) continue; // behind the ego, outside a forward-facing radar
      const range = Math.hypot(v.x, v.y);
      const bearing = Math.atan2(v.y, v.x);
      if (range > rangeM || Math.abs(bearing) > halfFovRad) continue;
      if (rng() < dropoutProb) continue; // a real radar misses returns sometimes
      detections.push({
        vehicleId: v.id,
        x: v.x + gaussian(rng) * noiseStd,
        y: v.y + gaussian(rng) * noiseStd,
      });
    }
    return detections;
  }
}

/** Standard normal sample via Box-Muller, using a caller-supplied RNG for reproducibility. */
function gaussian(rng) {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
