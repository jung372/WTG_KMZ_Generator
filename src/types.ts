import type { TurbineSpec } from './domain';
import type { TurbineMesh } from './geometry';
export interface Generated { ok: true; spec: TurbineSpec; revision: number; mesh: TurbineMesh; bytes: Uint8Array; hash: string; geometryMs: number; totalMs: number }
export interface SaveRequest { requestId: string; revision: number; suggestedName: string; bytes: Uint8Array }
export type SaveResult = { status: 'saved'; filePath: string } | { status: 'cancelled' } | { status: 'failed'; code: string; message: string };
declare global { interface Window { desktop?: { saveKmz(request: SaveRequest): Promise<SaveResult>; getAppVersion(): Promise<string> } } }
