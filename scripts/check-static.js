import { readFile } from 'node:fs/promises';

const required = ['index.html', 'src/main.js', 'src/styles.css', 'server.js'];
for (const file of required) {
  const text = await readFile(file, 'utf8');
  if (!text.trim()) throw new Error(`${file} is empty`);
}
const main = await readFile('src/main.js', 'utf8');
if (!main.includes('three@')) throw new Error('Three.js runtime import is missing');
if (!main.includes('GLTFLoader')) throw new Error('GLTFLoader integration is missing');
if (!main.includes('RGBELoader')) throw new Error('HDRI loader integration is missing');
if (!main.includes('polyhaven') && !main.includes('Poly Haven')) throw new Error('Commercial-use HDR/PBR asset source is missing');
if (main.includes('getContext(\'2d\')') || main.includes('getContext("2d")')) throw new Error('Canvas2D is forbidden for the 3D renderer');
for (const primitive of ['BoxGeometry', 'CubeGeometry']) {
  if (main.includes(primitive)) throw new Error(`${primitive} is forbidden for the vehicle system`);
}
for (const forbidden of ['createWorld(', 'trafficGroup', 'coinGroup']) {
  if (main.includes(forbidden)) throw new Error(`Gameplay/map code is out of scope for the vehicle-only task: ${forbidden}`);
}
console.log('Three.js WebGL game files are present and readable.');
