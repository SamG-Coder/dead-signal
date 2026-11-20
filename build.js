import { copyFile, cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const output = join(root, 'dist');
const vendor = join(output, 'vendor');
const three = join(root, 'node_modules', 'three');

await cp(join(root, 'public'), output, { recursive: true });
await mkdir(vendor, { recursive: true });
await Promise.all([
  copyFile(join(three, 'build', 'three.module.js'), join(vendor, 'three.module.js')),
  copyFile(join(three, 'build', 'three.core.js'), join(vendor, 'three.core.js')),
  copyFile(join(three, 'LICENSE'), join(vendor, 'three-LICENSE.txt')),
  writeFile(join(output, 'network.json'), JSON.stringify({ urls: [] }))
]);
