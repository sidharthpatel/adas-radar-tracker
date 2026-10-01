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

## Deployment

Deployed as a Cloudflare Worker with static assets, bound to a path on
`sidharthpatel.com` (not a subdomain) rather than its own Pages project —
this keeps it fully independent of the portfolio site's own deployment.

**Deployment is automatic**, via Cloudflare Workers Builds connected to this
repo: every push to `main` triggers a build (`npm run build`) and deploy
(`wrangler deploy`) on Cloudflare's own infrastructure. There is no manual
deploy step — don't run `wrangler deploy` by hand against this project;
let the connected build handle it. Build status and logs live under the
`radar-tracker` Worker's **Builds** tab in the Cloudflare dashboard.

Live at <https://sidharthpatel.com/projects/radar-tracker/>.

Because the route is path-prefixed, `vite.config.js` sets `base:
'/projects/radar-tracker/'` so built asset URLs resolve correctly, and
`worker.js` strips that prefix before delegating to the static asset
binding (Workers Assets expects uploaded files to mirror the route's path,
which a Vite build doesn't produce on its own).
