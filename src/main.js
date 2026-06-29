import * as THREE from 'https://esm.sh/three@0.179.1';
import { EffectComposer } from 'https://esm.sh/three@0.179.1/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.179.1/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.179.1/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'https://esm.sh/three@0.179.1/examples/jsm/postprocessing/SSAOPass.js';
import { SMAAPass } from 'https://esm.sh/three@0.179.1/examples/jsm/postprocessing/SMAAPass.js';
import { GLTFLoader } from 'https://esm.sh/three@0.179.1/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'https://esm.sh/three@0.179.1/examples/jsm/loaders/RGBELoader.js';
import { DRACOLoader } from 'https://esm.sh/three@0.179.1/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'https://esm.sh/three@0.179.1/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'https://esm.sh/three@0.179.1/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkeleton } from 'https://esm.sh/three@0.179.1/examples/jsm/utils/SkeletonUtils.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const viewport = $('#viewport');
const panels = { menu: $('#ui'), garage: $('#garage'), settings: $('#settings'), hud: $('#hud'), pause: $('#pause') };
const loading = { root: $('#loadingScreen'), fill: $('#loadingFill'), percent: $('#loadingPercent'), status: $('#loadingStatus'), asset: $('#loadingAsset'), tip: $('#loadingTip'), meter: $('.loading-meter') };
const hud = { speed: $('#speed'), gear: $('#gear'), rpm: $('#rpmFill'), drift: $('#driftScore'), checkpoint: $('#checkpoint'), camera: $('#cameraMode') };
const toast = $('#toast');
const carList = $('#carList');
const qualitySelect = $('#qualitySelect');
const coinEls = $$('[data-coins]');
const carEls = $$('[data-car]');
const cameraLabels = $$('[data-camera-label]');

const VEHICLES = [
  { id: 'toycar', name: 'GLTF Sports Coupe', price: 0, color: 0xd8dde6, speed: 220, grip: 1.0, mass: 1180, url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ToyCar/glTF-Binary/ToyCar.glb', source: 'Khronos glTF Sample Models', license: 'free sample asset' },
  { id: 'truck', name: 'GLTF Utility Truck', price: 2000, color: 0x2a7fff, speed: 178, grip: 0.86, mass: 1780, url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf', source: 'Khronos glTF Sample Models', license: 'free sample asset' }
];
const ASSETS = { hdri: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/outdoor_workshop_1k.hdr', textures: [] };
const TIPS = ['Hold Shift to rotate the car into a drift before the corner.', 'Space changes camera instantly: third, close, cockpit and first person.', 'Smooth throttle control keeps grip higher and lap times lower.', 'All race assets are compiled before the HUD appears.'];
const state = { coins: 0, owned: ['toycar'], selected: 'toycar', quality: 'balanced', audio: true, ...(JSON.parse(localStorage.getItem('sd-vehicle-save') || 'null') || {}) };

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x07101d, 0.012);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 900);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, state.quality === 'high' ? 2 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.append(renderer.domElement);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const ssao = new SSAOPass(scene, camera, innerWidth, innerHeight);
ssao.kernelRadius = 14;
ssao.minDistance = 0.002;
ssao.maxDistance = 0.13;
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.44, 0.9);
const smaa = new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
composer.addPass(renderPass);
composer.addPass(ssao);
composer.addPass(bloom);
composer.addPass(smaa);

const clock = new THREE.Clock();
const keys = new Set();
const carRig = { root: new THREE.Group(), model: null, wheels: [], steering: [], body: null };
const world = { root: new THREE.Group(), checkpoints: [], activeCheckpoint: 0, roadRadius: 82, roadWidth: 12 };
const vehicleBody = { position: new THREE.Vector3(0, 0, 74), velocity: new THREE.Vector3(), heading: Math.PI, steer: 0, yawVelocity: 0, speed: 0, rpm: 0, gear: 1, drift: 0, driftTotal: 0, airborne: 0 };
const cameraModes = ['Third Person', 'Close Third', 'Cockpit', 'First Person'];
let cameraModeIndex = 0;
let raceReady = false;
let paused = false;
let preloadPromise = null;
let audioContext = null;
let engineOsc = null;
let engineGain = null;

scene.add(world.root, carRig.root);

class AssetPipeline {
  constructor() {
    this.manager = new THREE.LoadingManager();
    this.models = new Map();
    this.textures = new Map();
    this.audios = new Map();
    this.materials = new Map();
    this.hdri = null;
    this.manualLoaded = 0;
    this.manualTotal = 11;
    this.networkLoaded = 0;
    this.networkTotal = 1;
    this.manager.onProgress = (url, loaded, total) => {
      this.networkLoaded = loaded;
      this.networkTotal = Math.max(total, 1);
      this.paint(`Streaming ${url.split('/').pop()}`, url.split('/').pop());
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
  step(label, asset = label) { this.manualLoaded += 1; this.paint(label, asset); }
  paint(label, asset) {
    const network = this.networkLoaded / Math.max(this.networkTotal, 1);
    const manual = this.manualLoaded / this.manualTotal;
    const pct = Math.min(99, Math.round((network * 0.62 + manual * 0.38) * 100));
    loading.root.classList.remove('hidden');
    loading.fill.style.width = `${pct}%`;
    loading.percent.textContent = `${pct}%`;
    loading.status.textContent = label;
    loading.asset.textContent = asset;
    loading.meter.setAttribute('aria-valuenow', `${pct}`);
    loading.tip.textContent = TIPS[this.manualLoaded % TIPS.length];
  }
  async preloadAll() {
    this.paint('Preparing dependency graph', 'LoadingManager');
    await Promise.all([this.loadHdri(ASSETS.hdri), ...ASSETS.textures.map((url) => this.loadTexture(url)), ...VEHICLES.map((v) => this.loadVehicle(v))]);
    this.step('Applying HDRI lighting', 'HDR reflections');
    scene.environment = this.hdri;
    scene.background = this.hdri;
    this.step('Building optimized race world', 'Road, guard rails, lights');
    buildRaceWorld();
    this.step('Creating audio cache', 'Engine, brake, drift, wind');
    await this.prepareAudio();
    this.step('Preparing selected vehicle', vehicle().name);
    await setVehicle(vehicle());
    this.step('Compiling PBR and post FX shaders', 'renderer.compileAsync');
    await this.compileShaders();
    this.step('Final GPU warmup', 'Bloom, SSAO, SMAA');
    composer.render();
    loading.fill.style.width = '100%';
    loading.percent.textContent = '100%';
    loading.status.textContent = 'Race ready';
    loading.asset.textContent = 'All assets resident';
    loading.meter.setAttribute('aria-valuenow', '100');
    await delay(250);
    loading.root.classList.add('hidden');
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
    const promise = this.textureLoader.loadAsync(url).then((texture) => configureTexture(texture, true));
    this.textures.set(url, promise);
    return promise;
  }
  async loadVehicle(data) {
    if (this.models.has(data.id)) return this.models.get(data.id);
    const promise = this.gltf.loadAsync(data.url).then((gltf) => {
      tuneVehicleMaterials(gltf.scene, data);
      prepareModelBounds(gltf.scene);
      return gltf.scene;
    });
    this.models.set(data.id, promise);
    return promise;
  }
  async instanceVehicle(data) { return cloneSkeleton(await this.loadVehicle(data)); }
  async prepareAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    ['engine', 'brake', 'drift', 'wind', 'menu'].forEach((name) => this.audios.set(name, makeToneBuffer(audioContext, name)));
  }
  async compileShaders() {
    const compileGroup = new THREE.Group();
    for (const data of VEHICLES) compileGroup.add(cloneSkeleton(await this.loadVehicle(data)));
    scene.add(compileGroup);
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    scene.remove(compileGroup);
  }
  dispose() { this.draco.dispose(); this.ktx2.dispose(); }
}
const assets = new AssetPipeline();

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function vehicle() { return VEHICLES.find((v) => v.id === state.selected) || VEHICLES[0]; }
function save() { localStorage.setItem('sd-vehicle-save', JSON.stringify(state)); }
function show(panelName) { Object.values(panels).forEach((panel) => panel.classList.add('hidden')); panels[panelName].classList.remove('hidden'); }
function notify(text) { toast.textContent = text; toast.classList.remove('hidden'); clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.add('hidden'), 2200); }
function reward(n) { state.coins += n; save(); syncUi(); notify(`+${n} coins`); }
function syncUi() {
  coinEls.forEach((el) => { el.textContent = Math.floor(state.coins); });
  carEls.forEach((el) => { el.textContent = vehicle().name; });
  cameraLabels.forEach((el) => { el.textContent = cameraModes[cameraModeIndex]; });
  qualitySelect.value = state.quality;
  renderGarage();
}
function renderGarage() {
  carList.innerHTML = VEHICLES.map((data) => {
    const owned = state.owned.includes(data.id);
    const active = state.selected === data.id;
    return `<article class="car-card"><h3>${data.name}</h3><p>${data.source} • ${data.license}</p>${bar('Top speed', data.speed / 220)}${bar('Grip', data.grip)}<button data-buy="${data.id}" ${active ? 'disabled' : ''}>${owned ? (active ? 'Selected' : 'Select') : `Buy ${data.price}`}</button></article>`;
  }).join('');
}
function bar(label, value) { return `<small>${label}</small><div class="bar"><i style="width:${Math.round(value * 100)}%"></i></div>`; }
function mat(key, factory) { if (!assets.materials.has(key)) assets.materials.set(key, factory()); return assets.materials.get(key); }
function configureTexture(texture, color) { texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); if (color) texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true; return texture; }
function tuneVehicleMaterials(root, data) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    sourceMaterials.forEach((material) => {
      if (!material) return;
      ['map', 'emissiveMap', 'clearcoatMap'].forEach((slot) => { if (material[slot]) configureTexture(material[slot], true); });
      ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach((slot) => { if (material[slot]) configureTexture(material[slot], false); });
    });
    const name = object.name.toLowerCase();
    if (/glass|window|windshield/.test(name)) object.material = mat(`glass-${data.id}`, () => new THREE.MeshPhysicalMaterial({ color: 0xbbe8ff, metalness: 0, roughness: 0.02, transmission: 0.55, thickness: 0.16, transparent: true, opacity: 0.58, envMapIntensity: 2.2 }));
    else if (/tire|rubber/.test(name)) object.material = mat('tire-rubber', () => new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.55, metalness: 0.03 }));
    else if (/brake|disc|rotor|rim|wheel/.test(name)) object.material = mat('wheel-metal', () => new THREE.MeshStandardMaterial({ color: 0xc6ced9, metalness: 0.9, roughness: 0.16, envMapIntensity: 1.7 }));
    else if (/light|lamp|head/.test(name)) object.material = mat('headlight', () => new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffe7aa, emissiveIntensity: 1.7 }));
    else if (/tail|brake/.test(name)) object.material = mat('taillight', () => new THREE.MeshStandardMaterial({ color: 0xff1835, emissive: 0xff0014, emissiveIntensity: 1.8 }));
    else object.material = mat(`paint-${data.id}`, () => new THREE.MeshPhysicalMaterial({ color: data.color, metalness: 0.84, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.9 }));
    if (object.geometry) object.geometry.computeBoundingSphere();
    object.frustumCulled = true;
  });
}
function prepareModelBounds(root) {
  const bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  root.userData.center = center.toArray();
  root.userData.lift = size.y * 0.5;
  root.userData.scale = 4.35 / Math.max(size.x, size.y, size.z);
}
async function setVehicle(data) {
  const model = await assets.instanceVehicle(data);
  while (carRig.root.children.length) carRig.root.remove(carRig.root.children[0]);
  carRig.model = model;
  carRig.wheels = [];
  carRig.steering = [];
  const center = new THREE.Vector3().fromArray(model.userData.center || [0, 0, 0]);
  model.position.sub(center);
  model.position.y += model.userData.lift || 0;
  model.scale.setScalar(model.userData.scale || 1);
  model.traverse((object) => {
    const name = object.name.toLowerCase();
    if (/wheel|tire|rim/.test(name)) carRig.wheels.push(object);
    if (/front|steer/.test(name) && /wheel|tire|rim/.test(name)) carRig.steering.push(object);
  });
  carRig.root.add(model);
}
function buildRaceWorld() {
  if (world.root.children.length) return;
  const asphalt = mat('asphalt', () => new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.88, metalness: 0.02, envMapIntensity: 0.35 }));
  const grass = mat('grass', () => new THREE.MeshStandardMaterial({ color: 0x163b22, roughness: 0.95, metalness: 0 }));
  const curbRed = mat('curb-red', () => new THREE.MeshStandardMaterial({ color: 0xb3212f, roughness: 0.5 }));
  const curbWhite = mat('curb-white', () => new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.46 }));
  const terrain = new THREE.Mesh(new THREE.CircleGeometry(140, 128), grass);
  terrain.rotation.x = -Math.PI / 2;
  terrain.receiveShadow = true;
  world.root.add(terrain);
  const road = new THREE.Mesh(new THREE.RingGeometry(world.roadRadius - world.roadWidth * 0.5, world.roadRadius + world.roadWidth * 0.5, 192, 2), asphalt);
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  world.root.add(road);
  addInstancedPlanes('lane-mark', 96, 0.34, 3.2, 0xffffff, 0, world.roadRadius, 0.018, true);
  addCurbs(curbRed, curbWhite);
  addGuardRails();
  addStreetLights();
  addNature();
  addMountains();
  addCheckpoints();
}
function addInstancedPlanes(name, count, width, height, color, offset, radius, y, dashed) {
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = mat(name, () => new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.02, envMapIntensity: 0.6 }));
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const scale = dashed && i % 2 ? new THREE.Vector3(0.001, 0.001, 0.001) : new THREE.Vector3(1, 1, 1);
    matrix.compose(new THREE.Vector3(Math.sin(angle) * (radius + offset), y, Math.cos(angle) * (radius + offset)), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -angle)), scale);
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  world.root.add(mesh);
}
function addCurbs(red, white) {
  const geometry = new THREE.PlaneGeometry(1.1, 2.7);
  [world.roadRadius - 6.4, world.roadRadius + 6.4].forEach((radius, side) => {
    const mesh = new THREE.InstancedMesh(geometry, side ? red : white, 128);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 128; i += 1) {
      const angle = (i / 128) * Math.PI * 2;
      matrix.compose(new THREE.Vector3(Math.sin(angle) * radius, 0.021, Math.cos(angle) * radius), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -angle)), new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true;
    world.root.add(mesh);
  });
}
function addGuardRails() {
  const railMat = mat('guard-rail', () => new THREE.MeshStandardMaterial({ color: 0xaab4c3, metalness: 0.82, roughness: 0.28, envMapIntensity: 1.2 }));
  const geometry = new THREE.CylinderGeometry(0.08, 0.08, 3.0, 8);
  const mesh = new THREE.InstancedMesh(geometry, railMat, 128);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 128; i += 1) {
    const angle = (i / 128) * Math.PI * 2;
    matrix.compose(new THREE.Vector3(Math.sin(angle) * 92, 0.9, Math.cos(angle) * 92), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, -angle)), new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  world.root.add(mesh);
}
function addStreetLights() {
  const poleMat = mat('light-pole', () => new THREE.MeshStandardMaterial({ color: 0x2a303a, metalness: 0.78, roughness: 0.22 }));
  const lampMat = mat('lamp-glow', () => new THREE.MeshStandardMaterial({ color: 0xfff3c2, emissive: 0xffd27a, emissiveIntensity: 1.4 }));
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.11, 5.5, 10);
  const lampGeo = new THREE.SphereGeometry(0.28, 12, 8);
  const poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, 24);
  const lampMesh = new THREE.InstancedMesh(lampGeo, lampMat, 24);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2;
    const position = new THREE.Vector3(Math.sin(angle) * 99, 2.75, Math.cos(angle) * 99);
    matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    poleMesh.setMatrixAt(i, matrix);
    matrix.compose(position.clone().setY(5.6), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    lampMesh.setMatrixAt(i, matrix);
  }
  poleMesh.instanceMatrix.needsUpdate = true;
  lampMesh.instanceMatrix.needsUpdate = true;
  poleMesh.castShadow = true;
  lampMesh.castShadow = true;
  world.root.add(poleMesh, lampMesh);
}
function addNature() {
  const trunk = mat('trunk', () => new THREE.MeshStandardMaterial({ color: 0x54351f, roughness: 0.82 }));
  const leaf = mat('leaf', () => new THREE.MeshStandardMaterial({ color: 0x1f7a3b, roughness: 0.78 }));
  const rock = mat('rock', () => new THREE.MeshStandardMaterial({ color: 0x5d6470, roughness: 0.9 }));
  const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 8), trunk, 90);
  const leafMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1.2, 3.1, 9), leaf, 90);
  const rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.8, 0), rock, 42);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 90; i += 1) {
    const angle = (i * 2.399963) % (Math.PI * 2);
    const radius = 112 + (i % 5) * 7;
    const scale = 0.75 + (i % 4) * 0.12;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    matrix.compose(new THREE.Vector3(x, 1.1, z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
    trunkMesh.setMatrixAt(i, matrix);
    matrix.compose(new THREE.Vector3(x, 3.4, z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
    leafMesh.setMatrixAt(i, matrix);
  }
  for (let i = 0; i < 42; i += 1) {
    const angle = (i * 1.719) % (Math.PI * 2);
    const radius = 105 + (i % 6) * 8;
    const scale = 0.55 + (i % 3) * 0.18;
    matrix.compose(new THREE.Vector3(Math.sin(angle) * radius, 0.45, Math.cos(angle) * radius), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0)), new THREE.Vector3(scale, scale * 0.65, scale));
    rockMesh.setMatrixAt(i, matrix);
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  leafMesh.instanceMatrix.needsUpdate = true;
  rockMesh.instanceMatrix.needsUpdate = true;
  trunkMesh.castShadow = leafMesh.castShadow = rockMesh.castShadow = true;
  world.root.add(trunkMesh, leafMesh, rockMesh);
}
function addMountains() {
  const material = mat('mountains', () => new THREE.MeshStandardMaterial({ color: 0x29394a, roughness: 0.96, envMapIntensity: 0.2 }));
  const mesh = new THREE.InstancedMesh(new THREE.ConeGeometry(12, 38, 5), material, 20);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 20; i += 1) {
    const angle = (i / 20) * Math.PI * 2;
    const scale = 0.7 + (i % 5) * 0.16;
    matrix.compose(new THREE.Vector3(Math.sin(angle) * 185, 18, Math.cos(angle) * 185), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0)), new THREE.Vector3(scale, scale, scale));
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  world.root.add(mesh);
}
function addCheckpoints() {
  const material = mat('checkpoint', () => new THREE.MeshStandardMaterial({ color: 0x73e7ff, emissive: 0x1eb8ff, emissiveIntensity: 0.55, transparent: true, opacity: 0.55 }));
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const gate = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.12, 8, 42, Math.PI), material);
    gate.position.set(Math.sin(angle) * world.roadRadius, 4, Math.cos(angle) * world.roadRadius);
    gate.rotation.set(Math.PI / 2, 0, -angle);
    gate.userData.angle = angle;
    world.checkpoints.push(gate);
    world.root.add(gate);
  }
}
function makeToneBuffer(context, name) {
  const duration = name === 'engine' ? 1 : 0.25;
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  const frequency = { engine: 90, brake: 280, drift: 180, wind: 55, menu: 660 }[name] || 220;
  for (let i = 0; i < data.length; i += 1) data[i] = Math.sin(i / context.sampleRate * frequency * Math.PI * 2) * (1 - i / data.length) * 0.18;
  return buffer;
}
function startEngineAudio() {
  if (!state.audio || !audioContext || engineOsc) return;
  engineOsc = audioContext.createOscillator();
  engineGain = audioContext.createGain();
  engineOsc.type = 'sawtooth';
  engineGain.gain.value = 0.025;
  engineOsc.connect(engineGain).connect(audioContext.destination);
  engineOsc.start();
}
function updateAudio() {
  if (!engineOsc || !engineGain) return;
  engineOsc.frequency.setTargetAtTime(70 + Math.abs(vehicleBody.speed) * 8, audioContext.currentTime, 0.04);
  engineGain.gain.setTargetAtTime(state.audio && raceReady && !paused ? 0.018 + Math.min(Math.abs(vehicleBody.speed) / 80, 1) * 0.035 : 0, audioContext.currentTime, 0.05);
}
function resetRace() {
  vehicleBody.position.set(0, 0, 74);
  vehicleBody.velocity.set(0, 0, 0);
  vehicleBody.heading = Math.PI;
  vehicleBody.steer = 0;
  vehicleBody.yawVelocity = 0;
  vehicleBody.speed = 0;
  vehicleBody.drift = 0;
  vehicleBody.driftTotal = 0;
  world.activeCheckpoint = 0;
}
async function enterRace() {
  if (!preloadPromise) preloadPromise = assets.preloadAll();
  await preloadPromise;
  resetRace();
  raceReady = true;
  paused = false;
  show('hud');
  if (audioContext && audioContext.state === 'suspended') await audioContext.resume();
  startEngineAudio();
}
function updatePhysics(dt) {
  const data = vehicle();
  const throttle = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 0.55 : 0);
  const brake = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1 : 0;
  const steerInput = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
  const forward = new THREE.Vector3(Math.sin(vehicleBody.heading), 0, Math.cos(vehicleBody.heading));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const forwardSpeed = vehicleBody.velocity.dot(forward);
  const lateralSpeed = vehicleBody.velocity.dot(right);
  const grip = THREE.MathUtils.lerp(7.2, 3.0, brake) * data.grip;
  vehicleBody.steer = THREE.MathUtils.lerp(vehicleBody.steer, steerInput, dt * 7.5);
  vehicleBody.velocity.addScaledVector(forward, throttle * 38 * dt);
  vehicleBody.velocity.addScaledVector(forward, -Math.sign(forwardSpeed) * brake * 24 * dt);
  vehicleBody.velocity.addScaledVector(right, -lateralSpeed * grip * dt);
  vehicleBody.velocity.multiplyScalar(1 - dt * 0.48);
  if (vehicleBody.velocity.length() > data.speed / 3.6) vehicleBody.velocity.setLength(data.speed / 3.6);
  vehicleBody.speed = vehicleBody.velocity.length();
  const steerPower = THREE.MathUtils.clamp(vehicleBody.speed / 24, 0.12, 1.25);
  vehicleBody.yawVelocity = vehicleBody.steer * steerPower * 1.18 + lateralSpeed * 0.012;
  vehicleBody.heading += vehicleBody.yawVelocity * dt;
  vehicleBody.position.addScaledVector(vehicleBody.velocity, dt);
  const radius = Math.hypot(vehicleBody.position.x, vehicleBody.position.z);
  const half = world.roadWidth * 0.56;
  if (Math.abs(radius - world.roadRadius) > half) {
    const targetRadius = THREE.MathUtils.clamp(radius, world.roadRadius - half, world.roadRadius + half);
    const angle = Math.atan2(vehicleBody.position.x, vehicleBody.position.z);
    const correction = new THREE.Vector3(Math.sin(angle) * targetRadius, 0, Math.cos(angle) * targetRadius);
    vehicleBody.position.lerp(correction, dt * 6);
    vehicleBody.velocity.multiplyScalar(0.965);
  }
  vehicleBody.drift = Math.max(0, Math.abs(lateralSpeed) - 2.8) * (brake ? 1.35 : 0.35);
  vehicleBody.driftTotal += vehicleBody.drift * dt * 8;
  vehicleBody.rpm = THREE.MathUtils.clamp((Math.abs(forwardSpeed) % 18) / 18 + Math.abs(throttle) * 0.28, 0.08, 1);
  vehicleBody.gear = Math.max(1, Math.min(6, Math.floor(Math.abs(forwardSpeed) / 9) + 1));
  updateCheckpoints();
}
function updateCheckpoints() {
  const gate = world.checkpoints[world.activeCheckpoint];
  if (!gate) return;
  if (vehicleBody.position.distanceTo(gate.position.clone().setY(0)) < 10) {
    world.activeCheckpoint = (world.activeCheckpoint + 1) % world.checkpoints.length;
    state.coins += 25;
    save();
    syncUi();
    notify('+25 checkpoint');
  }
  world.checkpoints.forEach((checkpoint, index) => { checkpoint.visible = index === world.activeCheckpoint; });
}
function updateCarVisuals(dt) {
  carRig.root.position.copy(vehicleBody.position);
  carRig.root.rotation.y = vehicleBody.heading;
  const roll = THREE.MathUtils.clamp(-vehicleBody.steer * vehicleBody.speed * 0.006, -0.11, 0.11);
  const pitch = THREE.MathUtils.clamp(-vehicleBody.velocity.length() * 0.002, -0.08, 0.04);
  if (carRig.model) carRig.model.rotation.set(pitch, 0, roll);
  carRig.wheels.forEach((wheel) => { wheel.rotation.x -= dt * vehicleBody.speed * 3.2; });
  carRig.steering.forEach((wheel) => { wheel.rotation.y = vehicleBody.steer * 0.42; });
}
function updateCamera(dt) {
  const heading = vehicleBody.heading;
  const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  let target = vehicleBody.position.clone();
  let position = vehicleBody.position.clone();
  if (cameraModeIndex === 0) { position.addScaledVector(forward, -12).add(new THREE.Vector3(0, 5.2, 0)); target.addScaledVector(forward, 8).add(new THREE.Vector3(0, 1.7, 0)); }
  if (cameraModeIndex === 1) { position.addScaledVector(forward, -6.2).add(new THREE.Vector3(0, 2.8, 0)); target.addScaledVector(forward, 8).add(new THREE.Vector3(0, 1.2, 0)); }
  if (cameraModeIndex === 2) { position.addScaledVector(forward, 0.45).addScaledVector(right, -0.25).add(new THREE.Vector3(0, 1.45, 0)); target.addScaledVector(forward, 12).add(new THREE.Vector3(0, 1.35, 0)); }
  if (cameraModeIndex === 3) { position.addScaledVector(forward, 1.8).add(new THREE.Vector3(0, 1.25, 0)); target.addScaledVector(forward, 14).add(new THREE.Vector3(0, 1.2, 0)); }
  camera.position.lerp(position, 1 - Math.exp(-dt * 7.5));
  camera.lookAt(target);
}
function updateHud() {
  hud.speed.textContent = Math.round(vehicleBody.speed * 3.6);
  hud.gear.textContent = vehicleBody.speed < 0.4 ? 'N' : vehicleBody.gear;
  hud.rpm.style.width = `${Math.round(vehicleBody.rpm * 100)}%`;
  hud.drift.textContent = Math.round(vehicleBody.driftTotal);
  hud.checkpoint.textContent = `${world.activeCheckpoint + 1}/${world.checkpoints.length || 6}`;
  hud.camera.textContent = cameraModes[cameraModeIndex].replace(' Person', '');
}
function applyQuality() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, state.quality === 'high' ? 2 : state.quality === 'balanced' ? 1.5 : 1.15));
  ssao.enabled = state.quality !== 'performance';
  bloom.enabled = state.quality !== 'performance';
  composer.setSize(innerWidth, innerHeight);
}
function animate() {
  const dt = Math.min(0.033, clock.getDelta());
  if (raceReady && !paused) {
    updatePhysics(dt);
    updateCarVisuals(dt);
    updateCamera(dt);
    updateHud();
    updateAudio();
  }
  composer.render();
  requestAnimationFrame(animate);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });
addEventListener('beforeunload', () => assets.dispose());
document.addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (event.code === 'Space') { cameraModeIndex = (cameraModeIndex + 1) % cameraModes.length; syncUi(); }
  if (event.code === 'KeyP' && raceReady) { paused = !paused; show(paused ? 'pause' : 'hud'); }
});
document.addEventListener('keyup', (event) => keys.delete(event.code));
document.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-action],[data-buy]');
  if (!action) return;
  if (action.dataset.action === 'play') await enterRace();
  if (action.dataset.action === 'garage') show('garage');
  if (action.dataset.action === 'settings') show('settings');
  if (action.dataset.action === 'menu') { raceReady = false; paused = false; show('menu'); }
  if (action.dataset.action === 'pause') { paused = true; show('pause'); }
  if (action.dataset.action === 'resume') { paused = false; show('hud'); }
  if (action.dataset.action === 'reward1000') reward(1000);
  if (action.dataset.action === 'reward2000') reward(2000);
  if (action.dataset.action === 'audio') { state.audio = !state.audio; save(); notify(state.audio ? 'Audio enabled' : 'Audio muted'); }
  if (action.dataset.buy) {
    const selected = VEHICLES.find((item) => item.id === action.dataset.buy);
    if (state.owned.includes(selected.id)) state.selected = selected.id;
    else if (state.coins >= selected.price) { state.coins -= selected.price; state.owned.push(selected.id); state.selected = selected.id; }
    else notify('Not enough coins');
    save();
    syncUi();
    if (raceReady) await setVehicle(vehicle());
  }
});
qualitySelect.addEventListener('change', () => { state.quality = qualitySelect.value; save(); applyQuality(); });

applyQuality();
syncUi();
show('menu');
loading.root.classList.add('hidden');
animate();
