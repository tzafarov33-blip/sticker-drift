import * as THREE from 'https://esm.sh/three@0.179.1';
import { EffectComposer } from 'https://esm.sh/three@0.179.1/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.179.1/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.179.1/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'https://esm.sh/three@0.179.1/examples/jsm/postprocessing/SSAOPass.js';
import { GLTFLoader } from 'https://esm.sh/three@0.179.1/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'https://esm.sh/three@0.179.1/examples/jsm/loaders/RGBELoader.js';
import { DRACOLoader } from 'https://esm.sh/three@0.179.1/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'https://esm.sh/three@0.179.1/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'https://esm.sh/three@0.179.1/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkeleton } from 'https://esm.sh/three@0.179.1/examples/jsm/utils/SkeletonUtils.js';

const viewport = document.querySelector('#viewport');
const ui = document.querySelector('#ui');
const garage = document.querySelector('#garage');
const hud = document.querySelector('#hud');
const toast = document.querySelector('#toast');
const speedEl = document.querySelector('#speed');
const nitroEl = document.querySelector('#nitro');
const driveModeEl = document.querySelector('#driveMode');
const cameraModeEl = document.querySelector('#cameraMode');
const carList = document.querySelector('#carList');
const loadingScreen = document.querySelector('#loadingScreen');
const loadingFill = document.querySelector('#loadingFill');
const loadingPercent = document.querySelector('#loadingPercent');
const loadingStatus = document.querySelector('#loadingStatus');
const loadingDetail = document.querySelector('#loadingDetail');
const coinEls = document.querySelectorAll('[data-coins]');
const carEls = document.querySelectorAll('[data-car]');

const VEHICLES = [
  { id: 'toycar', name: 'GLTF Sports Coupe', price: 0, color: 0xd8dde6, accent: 0x0b1220, speed: 42, grip: 0.9, source: 'Khronos glTF Sample Models', license: 'free sample asset', url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ToyCar/glTF-Binary/ToyCar.glb' },
  { id: 'truck', name: 'GLTF Utility Truck', price: 2000, color: 0x2a7fff, accent: 0x05070c, speed: 35, grip: 0.82, source: 'Khronos glTF Sample Models', license: 'free sample asset', url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf' }
];

const ASSETS = {
  hdri: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/outdoor_workshop_1k.hdr',
  textures: []
};

const state = JSON.parse(localStorage.getItem('sd-vehicle-save') || 'null') || { coins: 0, owned: ['toycar'], selected: 'toycar' };
const rig = { root: new THREE.Group(), model: null, wheels: [], steering: [], brakes: [], body: null, spin: 0, steer: 0, suspension: 0, camera: 'orbit', turntable: 0 };
const scratchWorld = new THREE.Vector3();
let studioReady = false;
let activeLoad = null;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x080b14, 0.018);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 500);
camera.position.set(5, 2.4, 7);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.append(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const ssao = new SSAOPass(scene, camera, innerWidth, innerHeight);
ssao.kernelRadius = 18;
ssao.minDistance = 0.002;
ssao.maxDistance = 0.16;
composer.addPass(ssao);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.5, 0.86));

scene.add(rig.root);
const hemi = new THREE.HemisphereLight(0xdcecff, 0x111318, 1.1);
const key = new THREE.DirectionalLight(0xffffff, 5.2);
const rim = new THREE.DirectionalLight(0x7dc7ff, 2.6);
key.position.set(-6, 8, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.2;
key.shadow.camera.far = 80;
key.shadow.camera.left = -12;
key.shadow.camera.right = 12;
key.shadow.camera.top = 12;
key.shadow.camera.bottom = -12;
rim.position.set(7, 4, -7);
scene.add(hemi, key, rim);

const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x11151c, metalness: 0.15, roughness: 0.22, envMapIntensity: 1.25 });
const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 96), floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const markerGeometry = new THREE.PlaneGeometry(0.12, 1.15);
const markerMaterial = new THREE.MeshStandardMaterial({ color: 0xfff3c1, metalness: 0.05, roughness: 0.38, envMapIntensity: 0.8 });
const trackMarkers = new THREE.InstancedMesh(markerGeometry, markerMaterial, 28);
const markerMatrix = new THREE.Matrix4();
for (let i = 0; i < trackMarkers.count; i += 1) {
  const angle = (i / trackMarkers.count) * Math.PI * 2;
  markerMatrix.compose(new THREE.Vector3(Math.sin(angle) * 5.8, 0.012, Math.cos(angle) * 5.8), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -angle)), new THREE.Vector3(1, 1, 1));
  trackMarkers.setMatrixAt(i, markerMatrix);
}
trackMarkers.instanceMatrix.needsUpdate = true;
trackMarkers.receiveShadow = true;
scene.add(trackMarkers);

class AssetPipeline {
  constructor() {
    this.manager = new THREE.LoadingManager();
    this.models = new Map();
    this.textures = new Map();
    this.materials = new Map();
    this.hdri = null;
    this.progress = { loaded: 0, total: 1, manualLoaded: 0, manualTotal: 1, label: 'Initializing asset pipeline' };
    this.manager.onProgress = (url, loaded, total) => {
      this.progress.loaded = loaded;
      this.progress.total = Math.max(total, 1);
      this.progress.label = `Streaming ${url.split('/').pop()}`;
      this.paintProgress();
    };
    this.draco = new DRACOLoader(this.manager).setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.ktx2 = new KTX2Loader(this.manager).setTranscoderPath('https://unpkg.com/three@0.179.1/examples/jsm/libs/basis/').detectSupport(renderer);
    this.gltf = new GLTFLoader(this.manager);
    this.gltf.setDRACOLoader(this.draco);
    this.gltf.setKTX2Loader(this.ktx2);
    this.gltf.setMeshoptDecoder(MeshoptDecoder);
    this.rgbe = new RGBELoader(this.manager);
    this.textureLoader = new THREE.TextureLoader(this.manager);
  }

  paintProgress(extra = 0) {
    const network = this.progress.loaded / Math.max(this.progress.total, 1);
    const manual = this.progress.manualLoaded / Math.max(this.progress.manualTotal, 1);
    const pct = Math.min(99, Math.round(((network * 0.72) + (manual * 0.28) + extra) * 100));
    loadingFill.style.width = `${pct}%`;
    loadingPercent.textContent = `${pct}%`;
    loadingStatus.textContent = this.progress.label;
  }

  setManual(label, loaded, total) {
    this.progress.label = label;
    this.progress.manualLoaded = loaded;
    this.progress.manualTotal = Math.max(total, 1);
    this.paintProgress();
  }

  async preloadAll() {
    loadingScreen.classList.remove('hidden');
    this.setManual('Queuing GLTF, texture, HDRI, and shader workloads', 0, 5);
    await Promise.all([this.loadHdri(ASSETS.hdri), ...ASSETS.textures.map((url) => this.loadTexture(url)), ...VEHICLES.map((v) => this.loadVehicle(v))]);
    this.setManual('Building PBR materials and mip chains', 2, 5);
    this.applyEnvironment();
    this.setManual('Compiling material variants', 3, 5);
    await this.compileScene();
    this.setManual('Warming post-processing shaders', 4, 5);
    composer.render();
    this.setManual('Race scene ready', 5, 5);
    loadingFill.style.width = '100%';
    loadingPercent.textContent = '100%';
    loadingStatus.textContent = 'All assets resident on CPU and GPU';
    loadingDetail.textContent = 'Models, textures, HDRI, materials, shadows and reflections are ready.';
    await new Promise((resolve) => setTimeout(resolve, 220));
    loadingScreen.classList.add('hidden');
  }

  async loadHdri(url) {
    if (this.hdri) return this.hdri;
    this.hdri = await this.rgbe.loadAsync(url);
    this.hdri.mapping = THREE.EquirectangularReflectionMapping;
    this.hdri.needsUpdate = true;
    return this.hdri;
  }

  async loadTexture(url) {
    if (this.textures.has(url)) return this.textures.get(url);
    const promise = this.textureLoader.loadAsync(url).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return texture;
    });
    this.textures.set(url, promise);
    return promise;
  }

  async loadVehicle(vehicleData) {
    if (this.models.has(vehicleData.id)) return this.models.get(vehicleData.id);
    const promise = this.gltf.loadAsync(vehicleData.url).then((gltf) => {
      const sceneRoot = gltf.scene;
      tuneMaterials(sceneRoot, vehicleData);
      optimizeSceneGraph(sceneRoot);
      bindPreparedBounds(sceneRoot);
      return sceneRoot;
    });
    this.models.set(vehicleData.id, promise);
    return promise;
  }

  async compileScene() {
    const compileTarget = new THREE.Group();
    for (const vehicleData of VEHICLES) {
      compileTarget.add(cloneSkeleton(await this.loadVehicle(vehicleData)));
    }
    scene.add(compileTarget);
    const compile = renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve(renderer.compile(scene, camera));
    await compile;
    scene.remove(compileTarget);
  }

  applyEnvironment() {
    scene.environment = this.hdri;
    scene.background = this.hdri;
  }

  async instantiateVehicle(vehicleData) {
    const source = await this.loadVehicle(vehicleData);
    return cloneSkeleton(source);
  }

  dispose() {
    this.draco.dispose();
    this.ktx2.dispose();
  }
}

const assets = new AssetPipeline();

function vehicle() { return VEHICLES.find((v) => v.id === state.selected) || VEHICLES[0]; }
function save() { localStorage.setItem('sd-vehicle-save', JSON.stringify(state)); }
function sync() { coinEls.forEach((e) => { e.textContent = Math.floor(state.coins); }); carEls.forEach((e) => { e.textContent = vehicle().name; }); renderGarage(); }
function show(panel) { [ui, garage, hud].forEach((e) => e.classList.add('hidden')); panel.classList.remove('hidden'); }
function notify(text) { toast.textContent = text; toast.classList.remove('hidden'); clearTimeout(notify.t); notify.t = setTimeout(() => toast.classList.add('hidden'), 2200); }
function reward(n) { state.coins += n; save(); sync(); notify(`+${n} монет`); }
function paintMaterial(v) { return new THREE.MeshPhysicalMaterial({ color: v.color, metalness: 0.86, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, reflectivity: 1, envMapIntensity: 1.8 }); }
function glassMaterial() { return new THREE.MeshPhysicalMaterial({ color: 0xbbe8ff, metalness: 0, roughness: 0.02, transmission: 0.55, thickness: 0.16, transparent: true, opacity: 0.58, envMapIntensity: 2 }); }
function cachedMaterial(key, factory) { if (!assets.materials.has(key)) assets.materials.set(key, factory()); return assets.materials.get(key); }
function configureTexture(texture, colorTexture = true) { texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); if (colorTexture) texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true; }
function tuneMaterials(root, v) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const existing = Array.isArray(o.material) ? o.material : [o.material];
    existing.forEach((material) => {
      if (!material) return;
      ['map', 'emissiveMap', 'clearcoatMap'].forEach((slot) => { if (material[slot]) configureTexture(material[slot], true); });
      ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach((slot) => { if (material[slot]) configureTexture(material[slot], false); });
    });
    const n = o.name.toLowerCase();
    if (/glass|window|windshield/.test(n)) o.material = cachedMaterial(`glass-${v.id}`, glassMaterial);
    else if (/tire|rubber/.test(n)) o.material = cachedMaterial('tire-rubber', () => new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.52, metalness: 0.04 }));
    else if (/brake|disc|rotor|rim|wheel/.test(n)) o.material = cachedMaterial('polished-wheel-metal', () => new THREE.MeshStandardMaterial({ color: 0xbcc3cc, metalness: 0.9, roughness: 0.16, envMapIntensity: 1.5 }));
    else if (/light|lamp|head/.test(n)) o.material = cachedMaterial('warm-headlight', () => new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffe7aa, emissiveIntensity: 1.7 }));
    else if (/tail|brake/.test(n)) o.material = cachedMaterial('red-tail-light', () => new THREE.MeshStandardMaterial({ color: 0xff1835, emissive: 0xff0014, emissiveIntensity: 1.8 }));
    else o.material = cachedMaterial(`paint-${v.id}`, () => paintMaterial(v));
  });
}
function optimizeSceneGraph(root) { root.traverse((o) => { if (o.isMesh) { o.frustumCulled = true; if (o.geometry) o.geometry.computeBoundingSphere(); } }); }
function bindPreparedBounds(root) {
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  root.userData.preparedCenter = center.toArray();
  root.userData.preparedScale = 4.6 / Math.max(size.x, size.y, size.z);
  root.userData.preparedLift = size.y * 0.5;
}
function bindRig(root) {
  rig.wheels = [];
  rig.steering = [];
  rig.brakes = [];
  rig.body = root;
  const center = new THREE.Vector3().fromArray(root.userData.preparedCenter || [0, 0, 0]);
  root.position.sub(center);
  root.position.y += root.userData.preparedLift || 0;
  root.scale.setScalar(root.userData.preparedScale || 1);
  root.traverse((o) => {
    const n = o.name.toLowerCase();
    if (/wheel|tire|rim/.test(n)) {
      rig.wheels.push(o);
      if (o.getWorldPosition(scratchWorld).z < 0) rig.steering.push(o);
    }
    if (/brake|disc|rotor/.test(n)) rig.brakes.push(o);
  });
}
function removeCurrentVehicle() { while (rig.root.children.length) rig.root.remove(rig.root.children[0]); rig.model = null; rig.wheels = []; rig.steering = []; rig.brakes = []; }
async function loadSelectedVehicle() {
  const v = vehicle();
  const model = await assets.instantiateVehicle(v);
  removeCurrentVehicle();
  rig.model = model;
  bindRig(rig.model);
  rig.root.add(rig.model);
  return model;
}
function renderGarage() { carList.innerHTML = VEHICLES.map((v) => { const owned = state.owned.includes(v.id); const active = state.selected === v.id; return `<article class="car-card"><h3>${v.name}</h3><p>${v.source} • ${v.license}</p>${bar('Скорость', v.speed / 42)}${bar('Сцепление', v.grip)}<button data-buy="${v.id}" ${active ? 'disabled' : ''}>${owned ? (active ? 'В студии' : 'Выбрать') : `Купить за ${v.price}`}</button></article>`; }).join(''); }
function bar(label, value) { return `<small>${label}</small><div class="bar"><i style="width:${Math.round(value * 100)}%"></i></div>`; }
function animateRig(dt) {
  if (!studioReady) return;
  rig.turntable += dt * 0.18;
  rig.spin += dt * (speedEl.dataset.motion === '1' ? 12 : 2.6);
  rig.steer = THREE.MathUtils.lerp(rig.steer, Math.sin(performance.now() * 0.0012) * 0.42, dt * 4);
  rig.suspension = Math.sin(performance.now() * 0.004) * 0.035;
  rig.root.rotation.y = rig.turntable;
  if (rig.model) rig.model.position.y = rig.suspension;
  rig.wheels.forEach((w) => { w.rotation.x -= dt * rig.spin; });
  rig.steering.forEach((w) => { w.rotation.y = rig.steer; });
  const orbit = rig.camera === 'interior' ? new THREE.Vector3(0.15, 1.2, 0.15) : new THREE.Vector3(Math.sin(rig.turntable) * 6, 2.2, Math.cos(rig.turntable) * 6);
  camera.position.lerp(orbit, dt * 3);
  camera.lookAt(0, rig.camera === 'interior' ? 1.05 : 0.75, 0);
  speedEl.textContent = speedEl.dataset.motion === '1' ? '120' : '0';
  nitroEl.textContent = '100';
  driveModeEl.textContent = 'Vehicle Studio';
  cameraModeEl.textContent = rig.camera === 'interior' ? 'Interior' : 'Exterior';
}
function loop() { const dt = Math.min(0.033, clock.getDelta()); animateRig(dt); composer.render(); requestAnimationFrame(loop); }
async function enterStudio() {
  if (!activeLoad) activeLoad = assets.preloadAll();
  await activeLoad;
  await loadSelectedVehicle();
  studioReady = true;
  show(hud);
}

const clock = new THREE.Clock();
loop();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });
addEventListener('beforeunload', () => assets.dispose());
document.addEventListener('keydown', (e) => { if (e.code === 'KeyC') rig.camera = rig.camera === 'interior' ? 'orbit' : 'interior'; if (e.code === 'Space') speedEl.dataset.motion = speedEl.dataset.motion === '1' ? '0' : '1'; });
document.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-action],[data-buy]');
  if (!a) return;
  if (a.dataset.action === 'play') await enterStudio();
  if (a.dataset.action === 'garage') show(garage);
  if (a.dataset.action === 'menu') show(ui);
  if (a.dataset.action === 'camera') rig.camera = rig.camera === 'interior' ? 'orbit' : 'interior';
  if (a.dataset.action === 'reward1000') reward(1000);
  if (a.dataset.action === 'reward2000') reward(2000);
  if (a.dataset.buy) {
    const v = VEHICLES.find((x) => x.id === a.dataset.buy);
    if (state.owned.includes(v.id)) {
      state.selected = v.id;
      if (studioReady) await loadSelectedVehicle();
    } else if (state.coins >= v.price) {
      state.coins -= v.price;
      state.owned.push(v.id);
      state.selected = v.id;
      save();
      sync();
      if (studioReady) await loadSelectedVehicle();
    } else notify('Недостаточно монет');
    save();
    sync();
  }
});

sync();
show(ui);
loadingScreen.classList.add('hidden');
