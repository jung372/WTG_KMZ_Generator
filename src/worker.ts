import { buildTurbineMesh } from './geometry';
import { inputHash, packageKmz, writeDae, writeKml } from './exporters';
import type { TurbineSpec } from './domain';
self.onmessage = async (event: MessageEvent<{ spec: TurbineSpec; revision: number }>) => {
  const { spec, revision } = event.data;
  try {
    const start = performance.now();
    const mesh = buildTurbineMesh(spec), geometryMs = performance.now() - start;
    const hash = await inputHash(spec);
    const bytes = packageKmz(writeKml(spec, revision, hash), writeDae(mesh));
    self.postMessage({ ok: true, spec, revision, mesh, bytes, hash, geometryMs, totalMs: performance.now() - start }, { transfer: [bytes.buffer] });
  } catch (error) { self.postMessage({ ok: false, revision, message: error instanceof Error ? error.message : '모델 생성 실패' }); }
};
