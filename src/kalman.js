// Constant-velocity Kalman filter for a single tracked object on the ground
// plane. State x = [px, py, vx, vy]ᵀ. Measurements are noisy (px, py) only —
// velocity is inferred, not measured, which is the whole point of the filter.
//
// This is plain 4x4 matrix algebra (no external deps) written out explicitly
// rather than via a generic matrix class, since the state size never changes.

export class KalmanTrack2D {
  /**
   * @param {number} px initial position x
   * @param {number} py initial position y
   * @param {number} measurementNoiseStd standard deviation of sensor noise (meters)
   */
  constructor(px, py, measurementNoiseStd) {
    this.x = [px, py, 0, 0]; // [px, py, vx, vy]
    // Initial uncertainty: confident in position (we just saw it), clueless about velocity.
    this.P = diag([1, 1, 25, 25]);
    this.setNoise(measurementNoiseStd);
    this.age = 0; // frames since track was created
    this.misses = 0; // consecutive frames with no matching detection
    this.hits = 1; // total frames matched to a detection
  }

  setNoise(measurementNoiseStd) {
    const r = measurementNoiseStd ** 2;
    this.R = [[r, 0], [0, r]];
  }

  /** Advance the model by dt seconds with no new measurement (prediction only). */
  predict(dt) {
    // Constant-velocity motion model.
    const F = [
      [1, 0, dt, 0],
      [0, 1, 0, dt],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    // Process noise: allow for gentle acceleration we don't model explicitly.
    const q = 2.5;
    const Q = [
      [q * dt ** 3 / 3, 0, q * dt ** 2 / 2, 0],
      [0, q * dt ** 3 / 3, 0, q * dt ** 2 / 2],
      [q * dt ** 2 / 2, 0, q * dt, 0],
      [0, q * dt ** 2 / 2, 0, q * dt],
    ];
    this.x = mulVec(F, this.x);
    this.P = addM(mulM(mulM(F, this.P), transpose(F)), Q);
    this.age++;
    this.misses++;
  }

  /** Fold in a noisy [px, py] measurement. Call after predict() for this step. */
  update(px, py) {
    const H = [[1, 0, 0, 0], [0, 1, 0, 0]];
    const Ht = transpose(H);
    const z = [px, py];
    const y = subVec(z, mulVec(H, this.x)); // innovation
    const S = addM(mulM(mulM(H, this.P), Ht), this.R);
    const K = mulM(mulM(this.P, Ht), inv2(S)); // Kalman gain (4x2)
    this.x = addVec(this.x, mulVec(K, y));
    const I = diag([1, 1, 1, 1]);
    this.P = mulM(subM(I, mulM(K, H)), this.P);
    this.misses = 0;
    this.hits++;
  }

  get position() {
    return [this.x[0], this.x[1]];
  }
  get velocity() {
    return [this.x[2], this.x[3]];
  }
  /** 1-sigma position uncertainty, for drawing a shrinking/growing confidence ring. */
  get positionUncertainty() {
    return Math.sqrt(Math.max(this.P[0][0], this.P[1][1]));
  }
}

// --- tiny matrix helpers, sized for this file's fixed dimensions only ---
function diag(d) {
  return d.map((v, i) => d.map((_, j) => (i === j ? v : 0)));
}
function mulM(A, B) {
  const n = A.length, m = B[0].length, k = B.length;
  const out = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let l = 0; l < k; l++) s += A[i][l] * B[l][j];
      out[i][j] = s;
    }
  return out;
}
function mulVec(A, v) {
  return A.map((row) => row.reduce((s, a, j) => s + a * v[j], 0));
}
function addM(A, B) {
  return A.map((row, i) => row.map((v, j) => v + B[i][j]));
}
function subM(A, B) {
  return A.map((row, i) => row.map((v, j) => v - B[i][j]));
}
function addVec(a, b) {
  return a.map((v, i) => v + b[i]);
}
function subVec(a, b) {
  return a.map((v, i) => v - b[i]);
}
function transpose(A) {
  return A[0].map((_, j) => A.map((row) => row[j]));
}
/** Inverse of a 2x2 matrix (the innovation covariance S is always 2x2 here). */
function inv2(A) {
  const [[a, b], [c, d]] = A;
  const det = a * d - b * c;
  return [[d / det, -b / det], [-c / det, a / det]];
}
