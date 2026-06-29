# Sticker Drift Vehicle Studio

Commercial-quality vehicle pipeline slice for a future Yandex Games racing project. This task intentionally focuses only on browser-ready vehicles, not map or gameplay.

## Features

- Three.js WebGL renderer with ACES tone mapping, anti-aliasing, high-quality shadows, Bloom and SSAO.
- HDRI environment lighting via Poly Haven HDR assets for realistic reflections on car paint and glass.
- Runtime GLTF/GLB vehicle loading with `GLTFLoader`; vehicles are never built from cubes or BoxGeometry.
- Vehicle material pass that upgrades loaded meshes to PBR metallic paint, transmissive glass, tire rubber, brake/rim metal, headlights and taillights when named mesh data is available.
- Vehicle rig pass for browser-friendly animation: wheel rotation, steering animation, suspension bounce, exterior orbit camera and interior camera.
- Vehicle asset selector with purchasable entries and Yandex-style rewarded coin actions.

## Run locally

```bash
npm start
```

Then open <http://localhost:4173>.

> The vehicle studio imports Three.js modules, GLTF vehicle assets and Poly Haven HDRI lighting at runtime. Internet access is required unless you vendor the assets.

## Controls

- `C`: switch exterior/interior vehicle camera.
- `Space`: toggle wheel/suspension motion preview.

## Check

```bash
npm run build
```
