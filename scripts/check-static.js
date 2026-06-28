import { readFile } from 'node:fs/promises';

const required = ['index.html', 'src/main.js', 'src/styles.css', 'server.js'];
for (const file of required) {
  const text = await readFile(file, 'utf8');
  if (!text.trim()) throw new Error(`${file} is empty`);
}
const main = await readFile('src/main.js', 'utf8');
if (!main.includes('three@')) throw new Error('Three.js runtime import is missing');
if (main.includes('getContext(\'2d\')') || main.includes('getContext("2d")')) throw new Error('Canvas2D is forbidden for the 3D renderer');
console.log('Three.js WebGL game files are present and readable.');
