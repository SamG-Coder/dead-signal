import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';

const port = Number(process.env.PORT || 4173);
const addresses = Object.values(networkInterfaces()).flat()
  .filter(address => address.family === 'IPv4' && !address.internal)
  .map(address => address.address);
const urls = addresses.map(address => `http://${address}:${port}`);
const routes = new Map([
  ['/', ['public/index.html', 'text/html']],
  ['/style.css', ['public/style.css', 'text/css']],
  ['/game.js', ['public/game.js', 'text/javascript']],
  ['/yard.js', ['public/yard.js', 'text/javascript']],
  ['/favicon.svg', ['public/favicon.svg', 'image/svg+xml']],
  ['/vendor/three.module.js', ['node_modules/three/build/three.module.js', 'text/javascript']],
  ['/vendor/three.core.js', ['node_modules/three/build/three.core.js', 'text/javascript']]
]);
const qr = urls.length ? await QRCode.toBuffer(urls[0], { width: 200, margin: 2 }) : null;

createServer(async (request, response) => {
  const path = request.url.split('?')[0];
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    let body;
    let type;
    if (path === '/network.json') {
      body = JSON.stringify({ urls });
      type = 'application/json';
    } else if (path === '/join.png' && qr) {
      body = qr;
      type = 'image/png';
    } else if (routes.has(path)) {
      const [file, contentType] = routes.get(path);
      body = await readFile(new URL(file, import.meta.url));
      type = contentType;
    } else {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': type,
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    console.error(error);
    response.writeHead(500).end();
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Dead Signal is ready. PC http://localhost:${port}`);
  urls.forEach(url => console.log(`Phone ${url}`));
});
