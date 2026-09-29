// Multi-object tracker: turns a stream of noisy, unlabeled detections into
// stable tracks. This is the "which blip is which car" problem every radar
// system has to solve — nearest-neighbor gating is the simplest real answer.
import { KalmanTrack2D } from './kalman.js';

const GATE_DISTANCE = 5; // meters — a detection farther than this from a track's
                          // prediction is treated as a different object. Kept
                          // well under the 3.5m lane width so adjacent-lane
                          // vehicles never get confused for one another.
const MAX_MISSES = 8; // frames a track can go undetected before it's dropped

export class MultiObjectTracker {
  constructor() {
    this.tracks = new Map(); // id -> KalmanTrack2D
    this.nextId = 1;
  }

  /**
   * @param {Array<{x:number,y:number}>} detections noisy detections this frame
   * @param {number} dt seconds since the last step
   * @param {number} measurementNoiseStd current sensor noise (so filters can
   *   be re-tuned live when the user drags the noise slider)
   */
  step(detections, dt, measurementNoiseStd) {
    for (const track of this.tracks.values()) {
      track.predict(dt);
      track.setNoise(measurementNoiseStd);
    }

    // Greedy nearest-neighbor association: repeatedly pick the closest
    // (track, detection) pair under the gate, until nothing more matches.
    const trackIds = [...this.tracks.keys()];
    const unmatchedDet = new Set(detections.map((_, i) => i));
    const unmatchedTrack = new Set(trackIds);
    const pairs = [];
    for (const id of trackIds) {
      const [px, py] = this.tracks.get(id).position;
      for (let i = 0; i < detections.length; i++) {
        const d = Math.hypot(detections[i].x - px, detections[i].y - py);
        if (d <= GATE_DISTANCE) pairs.push({ id, i, d });
      }
    }
    pairs.sort((a, b) => a.d - b.d);
    for (const { id, i } of pairs) {
      if (!unmatchedTrack.has(id) || !unmatchedDet.has(i)) continue;
      this.tracks.get(id).update(detections[i].x, detections[i].y);
      unmatchedTrack.delete(id);
      unmatchedDet.delete(i);
    }

    // Unmatched detections start new tentative tracks.
    for (const i of unmatchedDet) {
      const id = this.nextId++;
      this.tracks.set(id, new KalmanTrack2D(detections[i].x, detections[i].y, measurementNoiseStd));
    }

    // Tracks that have gone quiet too long are dropped (e.g. left radar range).
    for (const [id, track] of this.tracks) {
      if (track.misses > MAX_MISSES) this.tracks.delete(id);
    }

    return this.tracks;
  }

  reset() {
    this.tracks.clear();
    this.nextId = 1;
  }
}
