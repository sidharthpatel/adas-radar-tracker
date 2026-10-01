import { Scene3D } from './scene3d.js';
import { World, mulberry32 } from './world.js';
import { MultiObjectTracker } from './tracker.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const scene3d = new Scene3D(canvas);
const world = new World();
const tracker = new MultiObjectTracker();
const rng = mulberry32(7);

const state = {
  rangeM: 55,
  halfFovDeg: 18,
  noiseStd: 1.0,
  dropoutProb: 0.06,
  playing: true,
  showDetections: true,
  showTracks: true,
};

function applyRadarCone() {
  scene3d.updateRadarCone(state.rangeM, (state.halfFovDeg * Math.PI) / 180);
}

function bindSlider(id, key, outId, fmt = (v) => v) {
  const el = $(id);
  el.oninput = () => {
    state[key] = Number(el.value);
    $(outId).textContent = fmt(state[key]);
    if (key === 'rangeM' || key === 'halfFovDeg') applyRadarCone();
  };
  el.oninput();
}
bindSlider('range', 'rangeM', 'range-out', (v) => `${v} m`);
bindSlider('fov', 'halfFovDeg', 'fov-out', (v) => `±${v}°`);
bindSlider('noise', 'noiseStd', 'noise-out', (v) => `${v.toFixed(1)} m`);
bindSlider('dropout', 'dropoutProb', 'dropout-out', (v) => `${Math.round(v * 100)}%`);

$('toggle-play').onclick = () => {
  state.playing = !state.playing;
  $('toggle-play').textContent = state.playing ? 'Pause' : 'Play';
};
$('toggle-detections').onchange = (e) => (state.showDetections = e.target.checked);
$('toggle-tracks').onchange = (e) => (state.showTracks = e.target.checked);
$('reset').onclick = () => {
  tracker.reset();
  accuracy.raw = null;
  accuracy.filtered = null;
};

function resize() {
  const wrap = canvas.parentElement;
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  scene3d.resize();
}
window.addEventListener('resize', resize);

async function boot() {
  $('loading').hidden = false;
  $('loading-retry').hidden = true;
  $('loading-text').textContent = 'Loading scene…';
  $('loading-bar').style.width = '0%';
  try {
    await scene3d.loadAssets((p) => ($('loading-bar').style.width = `${p * 100}%`));
  } catch (err) {
    console.error('Failed to load the scene:', err);
    $('loading-text').textContent = `Couldn't load the scene: ${err.message}`;
    $('loading-retry').hidden = false;
    return;
  }
  $('loading').hidden = true;
  resize();
  applyRadarCone();
  requestAnimationFrame(loop);
}
$('loading-retry').onclick = boot;

// Rolling (exponentially-smoothed) accuracy stats: how far raw detections and
// filtered track estimates land from the true vehicle position they came
// from. This is the whole point of the filter made visible as a number.
const accuracy = { raw: null, filtered: null };
const SMOOTHING = 0.06;
function ema(prev, sample) {
  return prev === null ? sample : prev + SMOOTHING * (sample - prev);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (state.playing) {
    world.step(dt);
    const detections = world.detect({
      rangeM: state.rangeM,
      halfFovRad: (state.halfFovDeg * Math.PI) / 180,
      noiseStd: state.noiseStd,
      dropoutProb: state.dropoutProb,
      rng,
    });
    const tracks = tracker.step(detections, dt, state.noiseStd);
    scene3d.syncVehicles(world.vehicles);
    scene3d.syncOverlay(detections, tracks, state);
    $('track-count').textContent = tracks.size;
    $('det-count').textContent = detections.length;

    const vehicleById = new Map(world.vehicles.map((v) => [v.id, v]));
    for (const d of detections) {
      const v = vehicleById.get(d.vehicleId);
      if (v) accuracy.raw = ema(accuracy.raw, Math.hypot(d.x - v.x, d.y - v.y));
    }
    for (const t of tracks.values()) {
      const v = vehicleById.get(t.vehicleId);
      if (v && t.hits >= 3) {
        const [px, py] = t.position;
        accuracy.filtered = ema(accuracy.filtered, Math.hypot(px - v.x, py - v.y));
      }
    }
    $('acc-raw').textContent = accuracy.raw === null ? '–' : `${accuracy.raw.toFixed(2)} m`;
    $('acc-filtered').textContent = accuracy.filtered === null ? '–' : `${accuracy.filtered.toFixed(2)} m`;
  }

  scene3d.render(now);
  requestAnimationFrame(loop);
}

boot();
