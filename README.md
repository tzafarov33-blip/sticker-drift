# Sticker Drift 3D

Commercial-style browser racing game for Yandex Games powered by Three.js/WebGL.

## Features

- WebGL renderer using Three.js, ACES tone mapping, soft shadows, Bloom, SSAO, HDRI environment lighting and runtime GLTF loading.
- Real GLTF vehicle assets are loaded at runtime, then upgraded with PBR metallic paint, glass, headlights, brake lights, wheels and brake discs.
- Open-world inspired regions use Poly Haven CC0 HDR/PBR assets for sky lighting and asphalt, plus roads, markings, buildings, trees, signs and wet reflections.
- Vehicle systems for acceleration, braking, tire grip, inertia, drifting, nitro, traffic collisions and first-person/third-person cameras.
- Garage economy with purchasable cars and stronger stats for more expensive vehicles.
- Modern glassmorphism UI designed for Yandex Games reward flows.

## Run locally

```bash
npm start
```

Then open <http://localhost:4173>.

> The game imports Three.js modules, GLTF vehicle assets, Poly Haven HDRI lighting and Poly Haven asphalt textures at runtime. Internet access is required when running locally unless you vendor the modules/assets.

## Controls

- `A`/`D` or arrow keys: steer.
- `S` or down arrow: brake.
- `Shift`: toggle drift mode.
- `Ctrl`: hold nitro.
- `C` or `V`: switch between third-person and first-person cockpit camera.

## Check

```bash
npm run build
```
