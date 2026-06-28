import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const safePath = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^([/\\])+/, '');
    const file = join(root, safePath);
    if (!file.startsWith(root)) throw new Error('Forbidden');
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}).listen(process.env.PORT || 4173, () => console.log(`Sticker Drift: http://localhost:${process.env.PORT || 4173}`));
