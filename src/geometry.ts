import { BoxGeometry, BufferGeometry, CylinderGeometry, Matrix4, SphereGeometry, TorusGeometry, Vector3, Float32BufferAttribute } from 'three';
import type { TurbineSpec } from './domain';
export interface MeshPart { id: string; material: string; positions: number[]; normals: number[] }
export interface TurbineMesh { parts: MeshPart[]; triangleCount: number; hub: [number, number, number]; rotorRadius: number; bounds: { min: number[]; max: number[] }; staticTop: number }
export const MATERIALS: Record<string, { color: [number, number, number]; label: string }> = {
  shell: { color: [0.88, 0.90, 0.90], label: 'Light grey shell' },
  blade: { color: [0.95, 0.96, 0.94], label: 'White blades' },
  trim: { color: [0.55, 0.61, 0.62], label: 'Panel seams' },
  dark: { color: [0.18, 0.23, 0.24], label: 'Ventilation' },
  base: { color: [0.56, 0.66, 0.58], label: 'Tower base' },
};
// Concept dimensions in metres: all non-input dimensions are estimated; see docs/PRESET.md.
export const PRESET = { towerBottomRadius: 4.1, towerTopRadius: 2.3, housingRadius: 5.1, housingDepth: 2.4, housingY: 1.25, nacelleLength: 13.5, rotorY: 4.5 };
export function buildTurbineMesh(spec: TurbineSpec): TurbineMesh {
  const parts: MeshPart[] = [];
  const H = spec.hubHeightM, R = spec.rotorDiameterM / 2, rotorY = PRESET.rotorY;
  const add = (id: string, material: string, source: BufferGeometry, matrix: Matrix4) => {
    source.applyMatrix4(matrix);
    const g = source.index ? source.toNonIndexed() : source;
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    parts.push({ id, material, positions: Array.from(p.array), normals: Array.from(n.array) });
    if (g !== source) g.dispose(); source.dispose();
  };
  const at = (x: number, y: number, z: number) => new Matrix4().makeTranslation(x, y, z);
  const box = (id: string, material: string, w: number, d: number, h: number, x: number, y: number, z: number) => add(id, material, new BoxGeometry(w, d, h), at(x, y, z));
  const towerLength = H - 3.5;
  add('tower', 'shell', new CylinderGeometry(PRESET.towerTopRadius, PRESET.towerBottomRadius, towerLength, 48, 1), at(0, 0, towerLength / 2).multiply(new Matrix4().makeRotationX(Math.PI / 2)));
  add('tower-base', 'base', new CylinderGeometry(4.12, 4.12, Math.min(3, towerLength / 2), 48), at(0, 0, Math.min(3, towerLength / 2) / 2).multiply(new Matrix4().makeRotationX(Math.PI / 2)));
  box('yaw-connection', 'shell', 4.6, 5.2, 3.5, 0, -0.6, H - 3.2);
  add('generator-housing', 'shell', new CylinderGeometry(5.1, 5.1, 2.4, 64), at(0, 1.25, H));
  for (const y of [0.07, 2.43]) add(`housing-ring-${y}`, 'trim', new TorusGeometry(4.96, 0.065, 6, 64), at(0, y, H).multiply(new Matrix4().makeRotationX(Math.PI / 2)));
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    const m = at(Math.sin(a) * 4.52, 2.467, H + Math.cos(a) * 4.52).multiply(new Matrix4().makeRotationY(a));
    add(`housing-panel-${i}`, 'trim', new BoxGeometry(0.028, 0.025, 0.74), m);
  }
  box('rear-nacelle', 'shell', 4.8, 13.5, 4.3, 0, -7.45, H - 0.15);
  box('nacelle-underbody', 'trim', 3.6, 10.8, 0.36, 0, -7.3, H - 2.48);
  box('rear-vent', 'dark', 3.5, 0.09, 2.5, 0, -14.24, H);
  for (let i = 0; i < 8; i++) box(`vent-louver-${i}`, 'trim', 3.55, 0.11, 0.07, 0, -14.30, H - 1.1 + i * 0.31);
  for (let i = 0; i < 6; i++) for (const x of [-2.405, 2.405]) box(`nacelle-panel-${i}-${x}`, 'trim', 0.035, 0.04, 3.9, x, -1.2 - i * 2.5, H - 0.15);
  const hubRadius = Math.min(3.4, R * 0.24);
  add('hub', 'blade', new SphereGeometry(1, 32, 20), at(0, rotorY - 0.35, H).multiply(new Matrix4().makeScale(hubRadius, Math.min(2.1, R * 0.13), hubRadius)));
  for (let blade = 0; blade < 3; blade++) {
    const angle = -(spec.rotorAzimuthDeg + blade * 120) * Math.PI / 180;
    const assembly = at(0, rotorY, H).multiply(new Matrix4().makeRotationY(angle));
    const root = hubRadius * 0.82;
    add(`blade-root-${blade}`, 'shell', new CylinderGeometry(hubRadius * 0.32, hubRadius * 0.32, hubRadius * 0.8, 16), assembly.clone().multiply(at(0, 0, hubRadius)).multiply(new Matrix4().makeRotationX(Math.PI / 2)));
    add(`blade-${blade}`, 'blade', makeBlade(root, R), assembly);
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let triangleCount = 0;
  for (const part of parts) {
    triangleCount += part.positions.length / 9;
    for (let i = 0; i < part.positions.length; i++) { const k = i % 3; min[k] = Math.min(min[k], part.positions[i]); max[k] = Math.max(max[k], part.positions[i]); }
  }
  const mesh: TurbineMesh = { parts, triangleCount, hub: [0, rotorY, H], rotorRadius: R, bounds: { min, max }, staticTop: max[2] };
  validateMesh(mesh);
  return mesh;
}
function makeBlade(root: number, radius: number) {
  const ringCount = 22, sides = 10;
  const points: Vector3[][] = [];
  for (let i = 0; i < ringCount; i++) {
    const t = i / ringCount;
    const z = root + (radius - root) * t;
    const chord = Math.min(6, radius * 0.075) * (0.30 + 0.80 * Math.sin(Math.PI * Math.pow(t, 0.7))) * (1 - 0.76 * t);
    const thickness = chord * (0.30 - 0.20 * t);
    const twist = (20 * (1 - t)) * Math.PI / 180;
    const ring: Vector3[] = [];
    for (let j = 0; j < sides; j++) {
      const a = j * 2 * Math.PI / sides;
      const x = Math.cos(a) * chord / 2, y = Math.sin(a) * thickness / 2;
      ring.push(new Vector3(x * Math.cos(twist) - y * Math.sin(twist), x * Math.sin(twist) + y * Math.cos(twist), z));
    }
    points.push(ring);
  }
  const positions: number[] = [];
  const tri = (a: Vector3, b: Vector3, c: Vector3) => positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  for (let i = 0; i < ringCount - 1; i++) for (let j = 0; j < sides; j++) {
    const k = (j + 1) % sides;
    tri(points[i][j], points[i][k], points[i + 1][j]); tri(points[i][k], points[i + 1][k], points[i + 1][j]);
  }
  const tip = new Vector3(0, 0, radius), center = new Vector3(0, 0, root);
  for (let j = 0; j < sides; j++) {
    const k = (j + 1) % sides;
    tri(points[ringCount - 1][j], points[ringCount - 1][k], tip);
    tri(center, points[0][k], points[0][j]);
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(positions, 3)); g.computeVertexNormals(); return g;
}
export function validateMesh(mesh: TurbineMesh) {
  if (mesh.triangleCount > 15000) throw new Error('모델 삼각형 수가 15,000개를 초과했습니다.');
  for (const part of mesh.parts) {
    if (!MATERIALS[part.material] || part.positions.length % 9 || part.positions.length !== part.normals.length) throw new Error('모델 데이터 구조 오류');
    if (![...part.positions, ...part.normals].every(Number.isFinite)) throw new Error('모델에 유효하지 않은 좌표가 있습니다.');
    const a = new Vector3(), b = new Vector3(), c = new Vector3();
    for (let i = 0; i < part.positions.length; i += 9) {
      a.fromArray(part.positions, i); b.fromArray(part.positions, i + 3); c.fromArray(part.positions, i + 6);
      if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-15) throw new Error(`퇴화 삼각형: ${part.id}`);
    }
  }
}
