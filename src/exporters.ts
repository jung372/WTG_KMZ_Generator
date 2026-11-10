import { strToU8, unzipSync, zipSync } from 'fflate';
import { ACCURACY, APP_VERSION, heights, type TurbineSpec } from './domain';
import { MATERIALS, type TurbineMesh } from './geometry';
export function xml(value: unknown) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
const num = (n: number) => { if (!Number.isFinite(n)) throw new Error('유효하지 않은 출력 숫자'); return Number(n.toFixed(6)).toString(); };
export async function inputHash(spec: TurbineSpec) {
  const bytes = new TextEncoder().encode(JSON.stringify({ spec, generatorVersion: APP_VERSION }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export function writeDae(mesh: TurbineMesh) {
  const effects = Object.entries(MATERIALS).map(([id, m]) => `<effect id="${id}-fx"><profile_COMMON><technique sid="common"><phong><ambient><color>0.25 0.25 0.25 1</color></ambient><diffuse><color>${m.color.join(' ')} 1</color></diffuse><specular><color>0.08 0.08 0.08 1</color></specular><shininess><float>12</float></shininess></phong></technique></profile_COMMON></effect>`).join('');
  const materials = Object.keys(MATERIALS).map(id => `<material id="${id}" name="${id}"><instance_effect url="#${id}-fx"/></material>`).join('');
  const geometries = mesh.parts.map((p, i) => {
    const id = `g${i}`, count = p.positions.length / 3;
    const source = (suffix: string, array: number[]) => `<source id="${id}-${suffix}"><float_array id="${id}-${suffix}-array" count="${array.length}">${array.map(num).join(' ')}</float_array><technique_common><accessor source="#${id}-${suffix}-array" count="${count}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>`;
    return `<geometry id="${id}" name="${p.id}"><mesh>${source('pos', p.positions)}${source('norm', p.normals)}<vertices id="${id}-vertices"><input semantic="POSITION" source="#${id}-pos"/></vertices><triangles count="${count / 3}" material="${p.material}"><input semantic="VERTEX" source="#${id}-vertices" offset="0"/><input semantic="NORMAL" source="#${id}-norm" offset="1"/><p>${Array.from({ length: count }, (_, v) => `${v} ${v}`).join(' ')}</p></triangles></mesh></geometry>`;
  }).join('');
  const nodes = mesh.parts.map((p, i) => `<node id="part${i}" name="${p.id}" type="NODE"><instance_geometry url="#g${i}"><bind_material><technique_common><instance_material symbol="${p.material}" target="#${p.material}"/></technique_common></bind_material></instance_geometry></node>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1"><asset><contributor><authoring_tool>WTG KMZ Generator ${APP_VERSION}</authoring_tool></contributor><created>2026-11-02T00:00:00Z</created><modified>2026-11-02T00:00:00Z</modified><unit name="meter" meter="1"/><up_axis>Z_UP</up_axis></asset><library_effects>${effects}</library_effects><library_materials>${materials}</library_materials><library_geometries>${geometries}</library_geometries><library_visual_scenes><visual_scene id="Scene" name="Scene">${nodes}</visual_scene></library_visual_scenes><scene><instance_visual_scene url="#Scene"/></scene></COLLADA>`;
}
export function writeKml(spec: TurbineSpec, revision: number, hash: string) {
  const values = { ...spec, generatorVersion: APP_VERSION, revision, inputHash: hash, accuracy: ACCURACY, customRotor: spec.rotorDiameterM !== 175 };
  const data = Object.entries(values).map(([k, v]) => `<Data name="${k}"><value>${xml(v)}</value></Data>`).join('');
  const description = `${spec.name}\n허브 높이 ${spec.hubHeightM}m / 로터 직경 ${spec.rotorDiameterM}m / 풍향 ${spec.windFromDeg}°\n${ACCURACY}\n입력 식별값: ${hash}`;
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(spec.name)}</name><Placemark><name>${xml(spec.name)}</name><description>${xml(description)}</description><ExtendedData>${data}</ExtendedData><Model><altitudeMode>${spec.altitudeMode}</altitudeMode><Location><longitude>${num(spec.longitude)}</longitude><latitude>${num(spec.latitude)}</latitude><altitude>${num(heights(spec).base)}</altitude></Location><Orientation><heading>${num(spec.windFromDeg)}</heading><tilt>0</tilt><roll>0</roll></Orientation><Scale><x>1</x><y>1</y><z>1</z></Scale><Link><href>models/turbine.dae</href></Link></Model></Placemark></Document></kml>`;
}
export function packageKmz(kml: string, dae: string): Uint8Array {
  const fixedDate = new Date(2026, 0, 1);
  const bytes = zipSync({ 'doc.kml': [strToU8(kml), { mtime: fixedDate }], 'models/turbine.dae': [strToU8(dae), { mtime: fixedDate }] }, { level: 6 });
  if (bytes.length > 5 * 1024 * 1024) throw new Error('KMZ가 5MB 제한을 초과했습니다.');
  const files = unzipSync(bytes);
  if (Object.keys(files).length !== 2 || !files['doc.kml']?.length || !files['models/turbine.dae']?.length) throw new Error('KMZ 내부 파일 검사 실패');
  return bytes;
}
