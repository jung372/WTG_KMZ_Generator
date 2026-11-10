import { describe, expect, test } from 'vitest';
import { DOMParser, type Document } from '@xmldom/xmldom';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { DEFAULT_FORM, frontVector, heights, kmzFilename, safeFilename, validateForm, type TurbineSpec } from '../src/domain';
import { buildTurbineMesh } from '../src/geometry';
import { inputHash, packageKmz, writeDae, writeKml } from '../src/exporters';
import { validateSaveRequest, writeKmzFile } from '../electron/saveKmz';
import { mkdtemp, readFile, readdir, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const spec = (changes: Partial<TurbineSpec> = {}) => ({ ...validateForm(DEFAULT_FORM).spec!, ...changes });
const parsed = (text: string) => new DOMParser({ onError: level => { if (level !== 'warning') throw new Error('Invalid XML'); } }).parseFromString(text, 'application/xml');
const textOf = (xml: Document, tag: string) => xml.getElementsByTagName(tag)[0].textContent;
describe('T01 T02 input validation', () => {
  test('blank does not become zero; NaN, Infinity and out-of-range values are rejected', () => {
    for (const latitude of ['', 'NaN', 'Infinity', '-90.01', '90.01']) expect(validateForm({ ...DEFAULT_FORM, latitude }).errors.latitude).toBeTruthy();
    for (const longitude of ['-180.1', '180.1']) expect(validateForm({ ...DEFAULT_FORM, longitude }).errors.longitude).toBeTruthy();
    for (const hubHeightM of ['0', '-1', 'Infinity', '501']) expect(validateForm({ ...DEFAULT_FORM, hubHeightM }).errors.hubHeightM).toBeTruthy();
  });
  test.each([[-90, -180], [90, 180], [0, 0]])('coordinate boundary %s/%s accepted', (lat, lon) => expect(validateForm({ ...DEFAULT_FORM, latitude: String(lat), longitude: String(lon) }).spec).toBeTruthy());
  test('angles normalize, names trim and altitude requires datum', () => {
    expect(validateForm({ ...DEFAULT_FORM, name: ' A ', windFromDeg: '360', rotorAzimuthDeg: '360' }).spec).toMatchObject({ name: 'A', windFromDeg: 0, rotorAzimuthDeg: 0 });
    expect(validateForm({ ...DEFAULT_FORM, altitudeMode: 'absolute' }).errors.verticalDatum).toBeTruthy();
    expect(validateForm({ ...DEFAULT_FORM, altitudeMode: 'absolute', verticalDatum: 'MSL', baseElevationM: '300' }).spec?.baseElevationM).toBe(300);
  });
});
describe('T03 T04 geometry', () => {
  test.each([120, 150, 500, 5])('hub height %sm and rotor radius are preserved', H => {
    const mesh = buildTurbineMesh(spec({ hubHeightM: H }));
    expect(mesh.hub[2]).toBe(H); expect(mesh.triangleCount).toBeLessThanOrEqual(15000);
    const tips: number[][] = [];
    for (let blade = 0; blade < 3; blade++) {
      const p = mesh.parts.find(part => part.id === `blade-${blade}`)!.positions;
      let max = 0, tip: number[] = [];
      for (let i = 0; i < p.length; i += 3) { const r = Math.hypot(p[i], p[i + 2] - H); if (r > max) { max = r; tip = [p[i], p[i + 2] - H]; } }
      expect(max * 2).toBeCloseTo(175, 3); tips.push(tip);
    }
    for (let i = 0; i < 3; i++) { const a = tips[i], b = tips[(i + 1) % 3]; expect((a[0] * b[0] + a[1] * b[1]) / (87.5 ** 2)).toBeCloseTo(-0.5, 5); }
  });
  test.each([10, 160, 350])('diameter %s changes blades without changing hub height', D => {
    const mesh = buildTurbineMesh(spec({ rotorDiameterM: D }));
    expect(mesh.hub[2]).toBe(120);
    const p = mesh.parts.find(part => part.id === 'blade-0')!.positions;
    let radius = 0;
    for (let i = 0; i < p.length; i += 3) radius = Math.max(radius, Math.hypot(p[i], p[i + 2] - 120));
    expect(radius * 2).toBeCloseTo(D, 3);
  });
  test('H adjustment does not rescale the upper assembly', () => {
    const a = buildTurbineMesh(spec()), b = buildTurbineMesh(spec({ hubHeightM: 150 }));
    for (const p of a.parts.filter(p => !['tower', 'tower-base', 'yaw-connection'].includes(p.id))) {
      const q = b.parts.find(q => q.id === p.id)!;
      for (let i = 0; i < p.positions.length; i++) expect(q.positions[i] - p.positions[i]).toBeCloseTo(i % 3 === 2 ? 30 : 0, 3);
    }
  });
  test('blade surfaces have outward winding', () => {
    const p = buildTurbineMesh(spec()).parts.find(p => p.id === 'blade-0')!;
    // First side triangle is on the +X half of the blade.
    expect(p.normals[0]).toBeGreaterThan(0);
  });
});
describe('T05 T07 orientation and altitude', () => {
  test.each([[0, 0, 1], [90, 1, 0], [180, 0, -1], [270, -1, 0]])('heading %s front vector', (deg, east, north) => {
    const [x, y] = frontVector(deg); expect(x).toBeCloseTo(east, 8); expect(y).toBeCloseTo(north, 8);
    const kml = parsed(writeKml(spec({ windFromDeg: deg }), 0, 'id'));
    expect(Number(textOf(kml, 'heading'))).toBe(deg);
  });
  test('H120 D175 height example, offset and absolute', () => {
    expect(heights(spec())).toEqual({ base: 0, hub: 120, max: 207.5, min: 32.5, clearance: 32.5 });
    expect(heights(spec({ baseOffsetM: 2 }))).toMatchObject({ base: 2, hub: 122, max: 209.5, min: 34.5 });
    expect(heights(spec({ altitudeMode: 'absolute', baseElevationM: 300, baseOffsetM: 2 }))).toMatchObject({ base: 302, hub: 422 });
  });
});
describe('T06 T08 T09 T15 file contract', () => {
  test('DAE reparse matches preview positions and validates references', () => {
    const mesh = buildTurbineMesh(spec()), doc = parsed(writeDae(mesh));
    expect(doc.documentElement!.getAttribute('version')).toBe('1.4.1'); expect(textOf(doc, 'up_axis')).toBe('Z_UP');
    expect(doc.getElementsByTagName('unit')[0].getAttribute('meter')).toBe('1');
    const ids = new Set(Array.from(doc.getElementsByTagName('*')).map(e => e.getAttribute('id')).filter(Boolean));
    for (const el of Array.from(doc.getElementsByTagName('*'))) for (const attr of ['source', 'url', 'target']) {
      const ref = el.getAttribute(attr); if (ref?.startsWith('#')) expect(ids.has(ref.slice(1))).toBe(true);
    }
    let count = 0;
    const geometries = Array.from(doc.getElementsByTagName('geometry'));
    geometries.forEach((g, i) => {
      const p = g.getElementsByTagName('float_array')[0].textContent!.trim().split(/\s+/).map(Number);
      expect(p.length).toBe(mesh.parts[i].positions.length);
      for (let j = 0; j < p.length; j++) expect(Math.abs(p[j] - mesh.parts[i].positions[j])).toBeLessThanOrEqual(0.000001);
      const tri = g.getElementsByTagName('triangles')[0]; count += Number(tri.getAttribute('count'));
      const indices = tri.getElementsByTagName('p')[0].textContent!.trim().split(/\s+/).map(Number);
      expect(indices.length).toBe(Number(tri.getAttribute('count')) * 6); expect(Math.max(...indices)).toBeLessThan(p.length / 3);
    });
    expect(count).toBe(mesh.triangleCount);
  });
  test('KML escapes user text, places ExtendedData at Placemark and retains coordinates', () => {
    const s = spec({ name: '<script>&" test', latitude: 36.123456, longitude: 129.654321 });
    const doc = parsed(writeKml(s, 7, 'test-id'));
    expect(textOf(doc, 'name')).toBe(s.name); expect(doc.getElementsByTagName('script').length).toBe(0);
    expect(doc.getElementsByTagName('ExtendedData')[0].parentNode!.nodeName).toBe('Placemark');
    expect(Number(textOf(doc, 'latitude'))).toBe(s.latitude); expect(Number(textOf(doc, 'longitude'))).toBe(s.longitude);
    expect(textOf(doc, 'href')).toBe('models/turbine.dae');
  });
  test('same snapshot creates identical semantic data and zip', async () => {
    const s = spec(), mesh = buildTurbineMesh(s), hash = await inputHash(s);
    const make = () => packageKmz(writeKml(s, 1, hash), writeDae(mesh));
    const a = make(), b = make(); expect(a).toEqual(b); expect(a.length).toBeLessThan(5 * 1024 * 1024);
    const files = unzipSync(a); expect(Object.keys(files)).toEqual(['doc.kml', 'models/turbine.dae']);
    expect(strFromU8(files['doc.kml'])).toContain(hash);
    expect(await inputHash(spec({ windFromDeg: 90 }))).not.toBe(hash);
  });
  test('filenames sanitize paths and Windows device names', () => {
    expect(safeFilename('a/b\\c:*?')).not.toMatch(/[/\\:*?]/); expect(safeFilename('CON')).toBe('WTG_CON');
    expect(kmzFilename(spec())).toBe('WTG-01_E175_D175_H120.kmz');
  });
});
describe('D03 D04 D05 local save boundary', () => {
  const request = () => ({ requestId: 'test-request', revision: 1, suggestedName: 'test.kmz', bytes: packageKmz(writeKml(spec(), 1, 'id'), writeDae(buildTurbineMesh(spec()))) });
  test('main validates payload and rejects paths, bad zip and unexpected entries', () => {
    expect(validateSaveRequest(request()).revision).toBe(1);
    for (const suggestedName of ['../test.kmz', 'CON.kmz', 'x.exe', 'a\\b.kmz']) expect(() => validateSaveRequest({ ...request(), suggestedName })).toThrow();
    expect(() => validateSaveRequest({ ...request(), bytes: new Uint8Array(30) })).toThrow();
    expect(() => validateSaveRequest({ ...request(), bytes: zipSync({ 'doc.kml': strToU8('<kml />'), 'models/turbine.dae': strToU8('<COLLADA />'), '../evil': new Uint8Array(1) }) })).toThrow();
  });
  test('saves and overwrites in Korean path, preserves existing destination on rename failure', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'wtg-save-'));
    try {
      const destination = path.join(root, '한글 공백.kmz');
      await writeKmzFile(destination, new Uint8Array([1, 2])); await writeKmzFile(destination, new Uint8Array([3, 4]));
      expect([...await readFile(destination)]).toEqual([3, 4]);
      const directory = path.join(root, 'blocked.kmz'); await mkdir(directory);
      await expect(writeKmzFile(directory, new Uint8Array([5]))).rejects.toThrow();
      expect([...await readFile(destination)]).toEqual([3, 4]);
      expect((await readdir(root)).filter(p => p.endsWith('.tmp'))).toHaveLength(0);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
