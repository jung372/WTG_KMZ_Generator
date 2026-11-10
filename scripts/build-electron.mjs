import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist-electron', { recursive: true });
for (const name of ['main', 'preload']) {
  await build({ entryPoints: [`electron/${name}.ts`], bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron'], outfile: `dist-electron/${name}.cjs` });
}
await mkdir('docs', { recursive: true });
const packages = ['react', 'react-dom', 'scheduler', 'three', 'fflate'];
let licenses = 'WTG KMZ Generator third-party notices\nElectron runtime notices: see LICENSE.electron.txt and LICENSES.chromium.html in the application runtime.\n\n';
for (const name of packages) {
  const pkg = JSON.parse(await readFile(`node_modules/${name}/package.json`, 'utf8'));
  let license;
  for (const file of ['LICENSE', 'LICENSE.txt', 'LICENSE.md']) {
    try { license = await readFile(`node_modules/${name}/${file}`, 'utf8'); break; } catch {}
  }
  if (!license) throw new Error(`Missing license: ${name}`);
  licenses += `${name} ${pkg.version}\n${license}\n\n`;
}
await writeFile('docs/THIRD_PARTY_LICENSES.txt', licenses);
