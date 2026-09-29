# Radar Track

An interactive 3D demo of a Kalman filter tracking vehicles from noisy,
radar-style detections on a highway.

    npm install
    npm run dev

- `src/kalman.js` — constant-velocity Kalman filter for one tracked object
- `src/tracker.js` — multi-object tracking: nearest-neighbor data association,
  track spawn/confirm/drop lifecycle
- `src/world.js` — the "ground truth" simulation (vehicles cruising a highway,
  relative to the ego car) and the radar's field-of-view detection model
- `src/scene3d.js` — three.js rendering: loads the exported vehicle/road
  models, draws the radar cone and the raw-detection / filtered-track overlay
- `blender/` — Blender scripts used to build the scene assets (see below)

## Assets

Vehicle models are adapted from the [Generic passenger car
pack](https://sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5)
by Comrade1280, licensed [CC Attribution
4.0](https://creativecommons.org/licenses/by/4.0/). Individual body styles
were extracted, recolored, and re-exported for this project.
