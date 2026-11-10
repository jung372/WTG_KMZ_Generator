export const APP_VERSION = '0.1.0';
export const PRESET_VERSION = 'e175-concept-1';
export const ACCURACY = '개략 외관 · 세부 치수 추정 · 축 경사/코닝 0°';
export interface TurbineSpec {
  schemaVersion: '1'; modelPresetId: 'enercon-e175-concept'; presetVersion: string;
  name: string; latitude: number; longitude: number; hubHeightM: number;
  rotorDiameterM: number; windFromDeg: number; baseOffsetM: number; rotorAzimuthDeg: number;
  altitudeMode: 'relativeToGround' | 'absolute'; baseElevationM: number; verticalDatum: string;
}
export type FormValues = Record<'name' | 'latitude' | 'longitude' | 'hubHeightM' | 'rotorDiameterM' | 'windFromDeg' | 'baseOffsetM' | 'rotorAzimuthDeg' | 'altitudeMode' | 'baseElevationM' | 'verticalDatum', string>;
export const DEFAULT_FORM: FormValues = {
  name: 'WTG-01', latitude: '36.000000', longitude: '129.000000', hubHeightM: '120',
  rotorDiameterM: '175', windFromDeg: '0', baseOffsetM: '0', rotorAzimuthDeg: '0',
  altitudeMode: 'relativeToGround', baseElevationM: '0', verticalDatum: '',
};
export const LIMITS = { hubHeightM: [5, 500], rotorDiameterM: [10, 350], baseOffsetM: [-1000, 10000], baseElevationM: [-1000, 10000] } as const;
export function validateForm(form: FormValues): { spec?: TurbineSpec; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const number = (key: keyof FormValues, low: number, high: number) => {
    const raw = form[key]?.trim() ?? '';
    const value = raw === '' ? NaN : Number(raw);
    if (!Number.isFinite(value) || value < low || value > high) errors[key] = `${low}~${high} 범위의 숫자를 입력하세요.`;
    return value;
  };
  const name = (form.name ?? '').trim();
  if ([...name].length < 1 || [...name].length > 80 || /[\x00-\x1f]/.test(name)) errors.name = '제어문자 없이 이름을 1~80자로 입력하세요.';
  const latitude = number('latitude', -90, 90), longitude = number('longitude', -180, 180);
  const hubHeightM = number('hubHeightM', ...LIMITS.hubHeightM), rotorDiameterM = number('rotorDiameterM', ...LIMITS.rotorDiameterM);
  const windFromDeg = number('windFromDeg', 0, 360) % 360;
  const rotorAzimuthDeg = number('rotorAzimuthDeg', 0, 360) % 360;
  const baseOffsetM = number('baseOffsetM', ...LIMITS.baseOffsetM);
  if (!['relativeToGround', 'absolute'].includes(form.altitudeMode)) errors.altitudeMode = '고도 모드를 선택하세요.';
  const absolute = form.altitudeMode === 'absolute';
  const baseElevationM = absolute ? number('baseElevationM', ...LIMITS.baseElevationM) : 0;
  const verticalDatum = absolute ? (form.verticalDatum ?? '').trim() : '';
  if (absolute && (verticalDatum.length < 1 || verticalDatum.length > 120 || /[\x00-\x1f]/.test(verticalDatum))) errors.verticalDatum = '수직 기준을 1~120자로 입력하세요.';
  if (Object.keys(errors).length) return { errors };
  return { errors, spec: { schemaVersion: '1', modelPresetId: 'enercon-e175-concept', presetVersion: PRESET_VERSION, name, latitude, longitude, hubHeightM, rotorDiameterM, windFromDeg, baseOffsetM, rotorAzimuthDeg, altitudeMode: absolute ? 'absolute' : 'relativeToGround', baseElevationM, verticalDatum } };
}
export function heights(s: TurbineSpec) {
  const base = s.baseOffsetM + (s.altitudeMode === 'absolute' ? s.baseElevationM : 0);
  return { base, hub: base + s.hubHeightM, max: base + s.hubHeightM + s.rotorDiameterM / 2, min: base + s.hubHeightM - s.rotorDiameterM / 2, clearance: s.hubHeightM - s.rotorDiameterM / 2 };
}
export function frontVector(deg: number): [number, number, number] { const a = deg * Math.PI / 180; return [Math.sin(a), Math.cos(a), 0]; }
export function safeFilename(name: string) {
  let safe = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 80);
  if (!safe || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(safe)) safe = `WTG_${safe || '01'}`;
  return safe;
}
export function kmzFilename(s: TurbineSpec) { return `${safeFilename(s.name)}_E175_D${s.rotorDiameterM}_H${s.hubHeightM}.kmz`; }
