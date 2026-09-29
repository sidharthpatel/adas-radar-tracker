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
$('reset').onclick = () => tracker.reset();

function resize() {
  const wrap = canvas.parentElement;
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  scene3d.resize();
}
window.addEventListener('resize', resize);

window.__debug = { world, tracker, scene3d, state };

async function boot() {
  $('loading').hidden = false;
  await scene3d.loadAssets((p) => ($('loading-bar').style.width = `${p * 100}%`));
  $('loading').hidden = true;
  resize();
  applyRadarCone();
  requestAnimationFrame(loop);
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
  }

  scene3d.render();
  requestAnimationFrame(loop);
}

boot();
