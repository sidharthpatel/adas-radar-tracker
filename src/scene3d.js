import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const loadModel = (path) =>
  new Promise((resolve, reject) => loader.load(path, (gltf) => resolve(gltf.scene), undefined, reject));

export class Scene3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xaec4d4);
    this.scene.fog = new THREE.Fog(0xaec4d4, 25, 95);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
    this.camera.position.set(-9, -8, 3.4);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(12, 0, 0.6);
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 60;
    this.controls.update();

    this._addLights();
    this._addGround();

    this.trafficMeshes = new Map(); // model name -> Object3D template (hidden)
    this.trafficInstances = new Map(); // vehicle id -> Object3D in scene
    this.egoMesh = null;

    this.detectionPool = [];
    this.trackPool = [];
    this._buildOverlayPools(24);
    this.radarCone = this._buildRadarCone();
    this.scene.add(this.radarCone);

    window.addEventListener('resize', () => this.resize());
  }

  _addLights() {
    const hemi = new THREE.HemisphereLight(0xdfefff, 0x30353c, 1.1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
    sun.position.set(30, -40, 45);
    sun.castShadow = true;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun);
  }

  _addGround() {
    // Broad ground plane beyond the road shoulders so the scene doesn't look
    // like it's floating in a void.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshStandardMaterial({ color: 0x6d7a5a, roughness: 1, fog: true }),
    );
    ground.receiveShadow = true;
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    this.scene.add(ground);
  }

  _buildRadarCone() {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4fd1ff,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    group.add(mesh);
    group.userData.mesh = mesh;
    // Emanate from the sensor's real-world mount point: the ego car's front
    // bumper/grille, off the ground — not a wedge painted on the pavement.
    group.position.set(2.1, 0.5, 0);
    return group;
  }

  /**
   * Rebuild the radar beam geometry — called whenever range/FOV sliders
   * change. It's a true 3D cone (apex at the sensor, spreading in both
   * azimuth and a fixed, narrower elevation angle — real automotive radar
   * beams are wide horizontally and thin vertically), not a flat sector.
   */
  updateRadarCone(rangeM, halfFovRad) {
    const halfElevRad = halfFovRad * 0.3; // beams fan out far more side-to-side than up-down
    const halfH = rangeM * Math.tan(halfElevRad);
    const segs = 32;

    const positions = [0, 0, 0]; // index 0: apex
    const topRim = [];
    const bottomRim = [];
    for (let i = 0; i <= segs; i++) {
      const a = -halfFovRad + (2 * halfFovRad * i) / segs;
      const x = Math.cos(a) * rangeM;
      const z = Math.sin(a) * rangeM;
      topRim.push(positions.length / 3);
      positions.push(x, halfH, z);
      bottomRim.push(positions.length / 3);
      positions.push(x, -halfH, z);
    }

    const index = [];
    for (let i = 0; i < segs; i++) {
      // top and bottom fans (apex -> rim), plus the far end-cap strip between them
      index.push(0, topRim[i], topRim[i + 1]);
      index.push(0, bottomRim[i + 1], bottomRim[i]);
      index.push(topRim[i], bottomRim[i], topRim[i + 1]);
      index.push(topRim[i + 1], bottomRim[i], bottomRim[i + 1]);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    this.radarCone.userData.mesh.geometry.dispose();
    this.radarCone.userData.mesh.geometry = geo;
  }

  _buildOverlayPools(n) {
    const detGeo = new THREE.SphereGeometry(0.18, 10, 8);
    const detMat = new THREE.MeshBasicMaterial({ color: 0xff5a3c });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(detGeo, detMat);
      m.visible = false;
      this.scene.add(m);
      this.detectionPool.push(m);
    }

    for (let i = 0; i < n; i++) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0x37e08a, wireframe: true }),
      );
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0x37e08a, 0.6, 0.35);
      const group = new THREE.Group();
      group.add(box, arrow);
      group.visible = false;
      this.scene.add(group);
      this.trackPool.push({ group, box, arrow });
    }
  }

  async loadAssets(onProgress) {
    const names = ['road', 'ego_car', 'traffic_sedan', 'traffic_hatchback', 'traffic_suv', 'traffic_wagon', 'traffic_compact'];
    let done = 0;
    for (const name of names) {
      const model = await loadModel(`models/${name}.glb`);
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      if (name === 'road') {
        model.receiveShadow = true;
        this.scene.add(model);
      } else if (name === 'ego_car') {
        this.egoMesh = model;
        this.scene.add(model);
      } else {
        model.visible = false;
        this.trafficMeshes.set(name, model);
      }
      done++;
      onProgress?.(done / names.length);
    }
  }

  /** Ensure a visible instance exists in the scene for this traffic vehicle id. */
  _instanceFor(vehicle) {
    let inst = this.trafficInstances.get(vehicle.id);
    if (!inst) {
      inst = this.trafficMeshes.get(vehicle.model).clone(true);
      inst.visible = true;
      this.scene.add(inst);
      this.trafficInstances.set(vehicle.id, inst);
    }
    return inst;
  }

  // The simulation (world.js, tracker.js) works in a plain 2D ground plane:
  // (x, y) = (forward, lateral), height is implicitly 0. three.js and the
  // glTF models it loads use Y as the up-axis, not Z — so every ground-plane
  // (x, y) from the simulation maps to three.js (x, 0, y), and "up" is Y.

  syncVehicles(vehicles) {
    for (const v of vehicles) {
      const inst = this._instanceFor(v);
      inst.position.set(v.x, 0, v.y);
    }
  }

  /** detections: [{x,y}]. tracks: Map(id -> KalmanTrack2D). */
  syncOverlay(detections, tracks, opts) {
    detections.forEach((d, i) => {
      const m = this.detectionPool[i];
      if (!m) return;
      m.visible = opts.showDetections;
      m.position.set(d.x, 1.3, d.y);
    });
    for (let i = detections.length; i < this.detectionPool.length; i++) this.detectionPool[i].visible = false;

    const active = [...tracks.values()].filter((t) => t.hits >= 2); // skip one-frame-old tentative tracks
    active.forEach((t, i) => {
      const slot = this.trackPool[i];
      if (!slot) return;
      slot.group.visible = opts.showTracks;
      const [px, py] = t.position;
      const [vx, vy] = t.velocity;
      slot.group.position.set(px, 0.05, py);
      const size = 1 + t.positionUncertainty * 0.6;
      slot.box.scale.set(2.0, size, 1.1); // (length, height, width) — height grows with uncertainty
      slot.box.position.y = size / 2; // sit the box on the ground instead of centering it through it
      const speed = Math.hypot(vx, vy);
      if (speed > 0.3) {
        slot.arrow.setDirection(new THREE.Vector3(vx, 0, vy).normalize());
        slot.arrow.setLength(Math.min(speed * 0.3, 4), 0.5, 0.3);
        slot.arrow.visible = true;
      } else {
        slot.arrow.visible = false;
      }
    });
    for (let i = active.length; i < this.trackPool.length; i++) this.trackPool[i].group.visible = false;
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  render(now = performance.now()) {
    this.controls.update();
    // A slow opacity pulse so the cone reads as an active beam, not a static
    // translucent prop.
    const t = now / 1000;
    this.radarCone.userData.mesh.material.opacity = 0.12 + 0.07 * (0.5 + 0.5 * Math.sin(t * 2.2));
    this.renderer.render(this.scene, this.camera);
  }
}
