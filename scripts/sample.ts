import { mkdir, writeFile } from 'node:fs/promises';
import { DEFAULT_FORM, validateForm } from '../src/domain';
import { buildTurbineMesh } from '../src/geometry';
import { inputHash, packageKmz, writeKml, writeDae } from '../src/exporters';
async function main() {
  const spec = validateForm(DEFAULT_FORM).spec!;
  const mesh = buildTurbineMesh(spec), hash = await inputHash(spec);
  const bytes = packageKmz(writeKml(spec, 0, hash), writeDae(mesh));
  await mkdir('program/samples', { recursive: true });
  await writeFile('program/samples/synthetic-H120-D175.kmz', bytes);
  await writeFile('program/samples/synthetic-H120-D175.spec.json', JSON.stringify({ spec, hash, triangleCount: mesh.triangleCount }, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
