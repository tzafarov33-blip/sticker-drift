import { readFile } from 'node:fs/promises';

const required = ['index.html', 'src/main.js', 'src/styles.css', 'server.js'];
for (const file of required) {
  const text = await readFile(file, 'utf8');
  if (!text.trim()) throw new Error(`${file} is empty`);
}
console.log('Static game files are present and readable.');
