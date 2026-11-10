import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('test-results', { recursive: true });
await build({ entryPoints: ['scripts/sample.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'test-results/make-sample.cjs' });
execFileSync(process.execPath, ['test-results/make-sample.cjs'], { stdio: 'inherit' });
await copyFile('docs/사용안내.md', 'program/win-unpacked/사용안내.md');
await copyFile('docs/RELEASE_NOTES.md', 'program/win-unpacked/RELEASE_NOTES.md');
execFileSync('powershell.exe', ['-NoProfile', '-File', path.resolve('scripts/package-folder.ps1')], { stdio: 'inherit', windowsHide: true });
const artifacts = [];
for (const target of ['Setup', 'Portable']) {
  const name = `WTG-KMZ-Generator-${target}-${pkg.version}-x64.exe`;
  let data;
  try { data = await readFile(`program/${name}`); }
  catch (error) {
    if (!['EPERM', 'EACCES'].includes(error.code)) throw error;
    artifacts.push({ file: name, bytes: (await stat(`program/${name}`)).size, sha256: null, readStatus: error.code, executionVerified: false });
    continue;
  }
  if (data[0] !== 0x4d || data[1] !== 0x5a || data.length < 1024 * 1024) throw new Error(`Incomplete Windows executable: ${name}`);
  artifacts.push({ file: name, bytes: (await stat(`program/${name}`)).size, sha256: createHash('sha256').update(data).digest('hex') });
}
const zipName = `WTG-KMZ-Generator-Folder-${pkg.version}-x64.zip`;
const folderZip = await readFile(`program/${zipName}`);
artifacts.push({ file: zipName, bytes: folderZip.length, sha256: createHash('sha256').update(folderZip).digest('hex') });
await copyFile('docs/사용안내.md', 'program/사용안내.md');
await copyFile('docs/PRESET.md', 'program/PRESET.md');
await copyFile('docs/RELEASE_NOTES.md', 'program/RELEASE_NOTES.md');
await copyFile('docs/검증결과.md', 'program/검증결과.md');
await copyFile('docs/THIRD_PARTY_LICENSES.txt', 'program/THIRD_PARTY_LICENSES.txt');
const runtime = await readFile('program/win-unpacked/WTG KMZ Generator.exe');
artifacts.push({ file: 'win-unpacked/WTG KMZ Generator.exe', bytes: runtime.length, sha256: createHash('sha256').update(runtime).digest('hex'), executionVerified: true });
await writeFile('program/SHA256SUMS.txt', artifacts.filter(a => a.sha256).map(a => `${a.sha256}  ${a.file}`).join('\n') + '\n');
const manifest = { appVersion: pkg.version, presetVersion: 'e175-concept-1', generatedAt: new Date().toISOString(), platform: `${os.platform()} ${os.release()} ${os.arch()}`, sourceCommit: null, signing: 'unsigned local test build', verifiedExecutable: 'win-unpacked/WTG KMZ Generator.exe', packaging: 'unmodified Electron runtime; resources/app folder', lockfileHash: createHash('sha256').update(await readFile('package-lock.json')).digest('hex'), artifacts, limitations: ['Concept geometry with estimated dimensions; zero shaft tilt and coning', 'Other-PC and Google Earth visual acceptance pending', 'NSIS Setup/Portable bootstrap execution denied by Windows in this environment; use tested folder EXE', 'No public upload performed'] };
await writeFile('program/release-manifest.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
