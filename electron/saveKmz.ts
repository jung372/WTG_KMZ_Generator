import { randomUUID } from 'node:crypto';
import { open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import type { SaveRequest } from '../src/types';
export function validateSaveRequest(value: unknown): SaveRequest {
  if (!value || typeof value !== 'object') throw new Error('저장 요청 형식 오류');
  const v = value as SaveRequest;
  if (typeof v.requestId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(v.requestId) || !Number.isSafeInteger(v.revision) || v.revision < 0) throw new Error('저장 요청 식별값 오류');
  if (typeof v.suggestedName !== 'string' || v.suggestedName.length > 180 || !v.suggestedName.endsWith('.kmz') || /[<>:"/\\|?*\x00-\x1f]/.test(v.suggestedName) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(v.suggestedName)) throw new Error('안전하지 않은 파일명');
  if (!(v.bytes instanceof Uint8Array) || v.bytes.length < 20 || v.bytes.length > 5 * 1024 * 1024) throw new Error('KMZ 크기 또는 데이터 형식 오류');
  let total = 0;
  const files = unzipSync(v.bytes, { filter: entry => {
    total += entry.originalSize;
    if (!['doc.kml', 'models/turbine.dae'].includes(entry.name) || total > 16 * 1024 * 1024) throw new Error('허용되지 않은 KMZ 구성');
    return true;
  } });
  if (Object.keys(files).length !== 2 || !files['doc.kml'] || !files['models/turbine.dae'] || !strFromU8(files['doc.kml']).includes('<kml ') || !strFromU8(files['models/turbine.dae']).includes('<COLLADA ')) throw new Error('KMZ 필수 파일 누락');
  return v;
}
// Write to a same-directory temporary file. Never unlink an existing destination on failure.
export async function writeKmzFile(filePath: string, bytes: Uint8Array) {
  if (path.extname(filePath).toLowerCase() !== '.kmz') throw new Error('KMZ 확장자로 저장하세요.');
  const temporary = path.join(path.dirname(filePath), `.wtg-${randomUUID()}.tmp`);
  try {
    const handle = await open(temporary, 'wx');
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    await rename(temporary, filePath);
  } finally { await unlink(temporary).catch(() => {}); }
}
