import { useEffect, useRef, useState } from 'react';
import { ACCURACY, APP_VERSION, DEFAULT_FORM, heights, kmzFilename, validateForm, type FormValues } from './domain';
import type { Generated } from './types';
import { Preview } from './Preview';
type Phase = 'generating' | 'ready' | 'dirty' | 'invalid' | 'failed' | 'saving' | 'saved';
const phaseLabel: Record<Phase, string> = { generating: '모델 생성 중', ready: '저장 준비 완료', dirty: '입력 변경 · 다시 생성 필요', invalid: '입력값 확인 필요', failed: '다시 시도해 주세요', saving: '저장 중', saved: '저장 완료' };
export function App() {
  const [form, setForm] = useState<FormValues>({ ...DEFAULT_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Generated | null>(null);
  const [phase, setPhase] = useState<Phase>('generating');
  const [notice, setNotice] = useState('');
  const [savedPath, setSavedPath] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const revision = useRef(0), workerRef = useRef<Worker | null>(null);
  const [help, setHelp] = useState(false);
  const generate = (values: FormValues) => {
    const { spec, errors: validation } = validateForm(values);
    setErrors(validation); setNotice(''); setSavedPath(''); setAcknowledged(false);
    if (!spec) { setPhase('invalid'); return; }
    workerRef.current?.terminate();
    setPhase('generating');
    const currentRevision = revision.current;
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = event => {
      worker.terminate(); if (workerRef.current === worker) workerRef.current = null;
      if (currentRevision !== revision.current) { setPhase('dirty'); return; }
      if (event.data.ok) { setResult(event.data); setPhase('ready'); }
      else { setNotice(event.data.message); setPhase('failed'); }
    };
    worker.onerror = () => { worker.terminate(); workerRef.current = null; if (currentRevision === revision.current) { setNotice('모델을 생성하지 못했습니다. 입력을 유지한 상태로 다시 시도하세요.'); setPhase('failed'); } else setPhase('dirty'); };
    worker.postMessage({ spec, revision: currentRevision });
  };
  useEffect(() => { generate(DEFAULT_FORM); return () => workerRef.current?.terminate(); }, []);
  const change = (key: keyof FormValues, value: string) => {
    revision.current++; setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
    setSavedPath(''); setNotice(''); setAcknowledged(false);
    if (phase !== 'generating') setPhase('dirty');
  };
  const save = async () => {
    if (!result || result.revision !== revision.current || phase === 'saving' || (heights(result.spec).clearance < 0 && !acknowledged)) return;
    if (!window.desktop) { setNotice('파일 저장은 Windows EXE에서 사용할 수 있습니다.'); return; }
    setPhase('saving'); setNotice(''); setSavedPath('');
    try {
      const response = await window.desktop.saveKmz({ requestId: crypto.randomUUID(), revision: result.revision, suggestedName: kmzFilename(result.spec), bytes: result.bytes });
      if (response.status === 'saved') { setSavedPath(response.filePath); setPhase('saved'); }
      else if (response.status === 'cancelled') { setNotice('저장을 취소했습니다. 다시 저장할 수 있습니다.'); setPhase('ready'); }
      else { setNotice(`${response.message} (${response.code})`); setPhase('ready'); }
    } catch { setNotice('저장 기능에 연결하지 못했습니다. 다시 시도하세요.'); setPhase('ready'); }
  };
  const input = (key: keyof FormValues, title: string, unit: string, options: { step?: string; hint?: string; text?: boolean } = {}) => <label className={`field ${errors[key] ? 'has-error' : ''}`}>
    <span>{title}<small>{unit}</small></span><input aria-label={title} type={options.text ? 'text' : 'number'} step={options.step || 'any'} value={form[key]} onChange={event => change(key, event.target.value)} aria-invalid={!!errors[key]} maxLength={options.text ? 120 : undefined}/>
    {errors[key] ? <em role="alert">{errors[key]}</em> : options.hint && <small className="hint">{options.hint}</small>}
  </label>;
  const current = !!result && result.revision === revision.current;
  const metrics = result ? heights(result.spec) : null;
  const busy = phase === 'generating' || phase === 'saving';
  return <div className="app-shell">
    <header><div className="brand"><span className="brand-icon">✳</span><div><strong>WTG <span>KMZ Generator</span></strong><small>풍력발전기 배치 검토 도구</small></div></div><div className="header-tools"><span className="offline"><i/>오프라인 · 로컬 처리</span><button className="help-button" onClick={() => setHelp(!help)}>사용 안내</button><span className="version">v{APP_VERSION}</span></div></header>
    <main><aside className="input-panel"><div className="panel-title"><span className="eyebrow">01 / TURBINE SPECIFICATION</span><h1>발전기 제원 입력</h1><p>설치 위치와 제원을 설정하세요.</p></div>
      <form onSubmit={event => { event.preventDefault(); generate(form); }}><fieldset disabled={phase === 'saving'}>
        <div className="preset-card"><span>기준 프리셋</span><strong>ENERCON E-175 계열</strong><small>EP5 E2 잠정 기준 · 개략 외관</small></div>
        {input('name', '발전기 이름', '', { text: true })}
        <div className="field-grid">{input('latitude', '위도', '°', { hint: 'WGS84 · -90~90' })}{input('longitude', '경도', '°', { hint: 'WGS84 · -180~180' })}</div>
        <div className="field-grid">{input('hubHeightM', '허브 높이', 'm', { hint: '기준면 → 허브 중심 · 5~500' })}{input('rotorDiameterM', '로터 직경', 'm', { hint: '날개 끝 회전 직경 · 10~350' })}</div>
        {input('windFromDeg', '주풍향', '°', { hint: '바람이 불어오는 방향 · 북 0 / 동 90 / 남 180 / 서 270' })}
        <details className="advanced"><summary>고급 설정 <span>설치고 · 로터 자세 · 표고</span></summary><div className="advanced-body">
          {input('baseOffsetM', '설치고 보정', 'm', { hint: '양수는 위쪽 · -1,000~10,000' })}
          {input('rotorAzimuthDeg', '정지 로터 자세', '°', { hint: '정면 기준 시계방향 · 0~360' })}
          <label className="field"><span>고도 모드</span><select aria-label="고도 모드" value={form.altitudeMode} onChange={event => change('altitudeMode', event.target.value)}><option value="relativeToGround">지면 기준 (relativeToGround)</option><option value="absolute">해발 표고 기준 (absolute)</option></select></label>
          {form.altitudeMode === 'absolute' && <>{input('baseElevationM', '설치 기준면 표고', 'm')}{input('verticalDatum', '수직 기준', '', { text: true, hint: 'Google Earth 해수면 기준과의 차이를 검토하세요.' })}</>}
        </div></details>
      </fieldset><button className="generate-button" type="submit" disabled={busy}>{phase === 'generating' ? '모델과 KMZ 생성 중…' : '미리보기 생성 / 적용'}<span>↗</span></button></form>
      <p className="input-footnote">샘플 좌표가 입력되어 있습니다. 실제 설치 위치로 변경하세요. 생성 데이터는 외부로 전송하지 않습니다.</p>
    </aside><section className="workspace"><div className="workspace-title"><div><span className="eyebrow">02 / MODEL REVIEW</span><h2>3D 모델 확인</h2></div><span className={`status status-${phase}`} role="status">{phaseLabel[phase]}</span></div>
      <Preview result={result}/>
      {!current && result && <div className="stale-banner">현재 화면은 이전 입력의 모델입니다. ‘미리보기 생성 / 적용’을 누르면 최신 입력을 반영합니다.</div>}
      <div className="metrics"><div><span>허브 중심</span><strong>{result?.spec.hubHeightM ?? '—'}<small> m</small></strong></div><div><span>로터 직경</span><strong>{result?.spec.rotorDiameterM ?? '—'}<small> m</small></strong></div><div><span>회전 최고 도달</span><strong>{metrics ? (result!.spec.hubHeightM + result!.spec.rotorDiameterM / 2).toFixed(1) : '—'}<small> m</small></strong></div><div><span>기준면 대비 최저 여유</span><strong className={metrics && metrics.clearance < 0 ? 'negative' : ''}>{metrics?.clearance.toFixed(1) ?? '—'}<small> m</small></strong></div></div>
      <div className="model-note"><span>ⓘ</span><div><strong>{ACCURACY}</strong><p>높이는 설치 기준면 대비 값입니다. 회전 최고 도달과 정지 자세의 최상단은 다르며 주변 지형 충돌은 별도 확인이 필요합니다.{result && <> 정지 모델 최상단 {result.mesh.staticTop.toFixed(1)}m.</>}</p></div></div>
      {result?.spec.rotorDiameterM !== 175 && result && <div className="warning">로터 직경이 기준 175m와 다른 사용자 변형 모델입니다.</div>}
      {current && metrics && metrics.clearance < 0 && <label className="warning clearance"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}/>날개 회전 궤적이 설치 기준면 아래로 내려갑니다. 지상 여유를 검토했으며 이 제원으로 저장합니다.</label>}
      <div className="export-panel"><div><span className="eyebrow">03 / EXPORT</span><h3>Google Earth용 KMZ</h3><p>{result ? `${result.mesh.triangleCount.toLocaleString()} triangles · ${(result.bytes.length / 1024).toFixed(0)} KB · 생성 ${(result.totalMs / 1000).toFixed(2)}초` : 'KML + DAE를 한 파일로 저장합니다.'}</p></div><button className="save-button" onClick={save} disabled={!current || busy || phase === 'failed' || (!!metrics && metrics.clearance < 0 && !acknowledged)}>{phase === 'saving' ? '파일 저장 중…' : 'KMZ 파일 저장'}<span>↓</span></button></div>
      {notice && <div className="notice" role="alert">{notice}</div>}{savedPath && <div className="saved-path" role="status"><strong>저장했습니다.</strong> {savedPath}</div>}
      <footer>단일 발전기 · 정지 자세 · m 단위 <span>{result ? `입력 ID ${result.hash.slice(0, 12)} · revision ${result.revision}` : ''}</span></footer>
    </section></main>
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section className="help-modal" role="dialog" aria-modal="true" aria-label="사용 안내" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setHelp(false)}>닫기 ✕</button><span className="eyebrow">QUICK START</span><h2>EXE에서 KMZ까지</h2><ol><li>좌표와 허브 높이·주풍향·로터 직경을 입력합니다.</li><li>‘미리보기 생성 / 적용’을 눌러 형상과 방향을 확인합니다.</li><li>‘KMZ 파일 저장’에서 저장 위치를 선택합니다.</li><li>Google Earth Pro의 파일 → 열기로 KMZ를 엽니다.</li></ol><p>Google Earth에서는 지형을 켜고 고도 과장을 1배로 설정하세요. 지면 차이가 있으면 설치고를 보정합니다. absolute 표고는 수직 기준의 일치를 확인해야 합니다.</p><p>일부 치수는 사진 기반 추정입니다. 제조사 공식 설계·측량·충돌 검토를 대체하지 않습니다. 기준 외 로터 직경은 사용자 변형 모델입니다.</p><p>KMZ 생성에는 인터넷과 Google Earth 설치가 필요하지 않습니다. Google Earth Pro는 결과 확인용으로 별도 설치합니다.</p><p>이번 로컬 빌드는 미서명 시험판입니다. 다른 PC와 Google Earth의 최종 수용 검증은 별도로 필요합니다.</p></section></div>}
  </div>;
}
