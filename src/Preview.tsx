import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Generated } from './types';
import { MATERIALS } from './geometry';
export function Preview({ result }: { result: Generated | null }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<(view: string) => void>(() => {});
  const [error, setError] = useState('');
  useEffect(() => {
    if (!host.current || !result) return;
    setError('');
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch { setError('3D를 시작하지 못했습니다. 그래픽 드라이버를 확인하세요. KMZ 생성·저장은 계속 사용할 수 있습니다.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setClearColor('#e9efeb'); renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement); renderer.domElement.setAttribute('aria-label', '풍력발전기 3D 미리보기');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 6000); camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.maxDistance = 2000; controls.minDistance = 8;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x879e8b, 2.3));
    const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(-130, 180, 280); scene.add(key);
    const fill = new THREE.DirectionalLight(0xe6efff, 1.2); fill.position.set(100, -80, 100); scene.add(fill);
    const turbine = new THREE.Group();
    for (const part of result.mesh.parts) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
      const color = new THREE.Color(...MATERIALS[part.material].color);
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.69, metalness: 0.08 });
      turbine.add(new THREE.Mesh(geometry, material));
    }
    turbine.rotation.z = -THREE.MathUtils.degToRad(result.spec.windFromDeg); scene.add(turbine);
    const size = Math.max(result.spec.rotorDiameterM, result.spec.hubHeightM + result.spec.rotorDiameterM / 2);
    const grid = new THREE.GridHelper(Math.ceil(size / 20) * 40, 20, 0xb8c8ba, 0xd1dcd3); grid.rotation.x = Math.PI / 2; grid.position.z = -0.03; scene.add(grid);
    const axisLength = Math.min(65, size * 0.3);
    scene.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-axisLength, -axisLength, 0.1), axisLength, 0x247a5a, 5, 2.5));
    scene.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-axisLength, -axisLength, 0.1), axisLength, 0xb7793e, 5, 2.5));
    const h = result.spec.hubHeightM, r = result.spec.rotorDiameterM / 2;
    const points = [new THREE.Vector3(-r - 8, 0, 0), new THREE.Vector3(-r - 8, 0, h), new THREE.Vector3(-r - 11, 0, h), new THREE.Vector3(-r - 5, 0, h)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x468b76 })));
    const target = new THREE.Vector3(0, 0, Math.max(h * 0.72, size * 0.37));
    controls.target.copy(target);
    const setView = (name: string) => {
      const d = size * 1.8;
      const locations: Record<string, number[]> = { iso: [d * 0.76, d * 0.9, target.z + d * 0.40], front: [0, d * 1.25, target.z], side: [d * 1.25, 0, target.z] };
      const p = locations[name] || locations.iso;
      camera.position.set(p[0], p[1], p[2]); controls.target.copy(target); controls.update();
    };
    view.current = setView; setView('iso');
    const resize = () => { const w = container.clientWidth, height = container.clientHeight; renderer.setSize(w, height); camera.aspect = w / Math.max(height, 1); camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    let frame = 0;
    const draw = () => { frame = requestAnimationFrame(draw); controls.update(); renderer.render(scene, camera); }; draw();
    const lost = (event: Event) => { event.preventDefault(); setError('그래픽 장치 연결이 끊겼습니다. 미리보기를 다시 생성하세요. KMZ는 저장할 수 있습니다.'); };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      scene.traverse(object => { const o = object as THREE.Mesh; o.geometry?.dispose(); const materials = Array.isArray(o.material) ? o.material : [o.material]; materials.filter(Boolean).forEach(m => m.dispose()); });
      renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); view.current = () => {};
    };
  }, [result]);
  return <div className="preview-stage"><div className="canvas-host" ref={host}/>
    {!result && <div className="empty-preview">입력값을 확인하고 미리보기를 생성하세요.</div>}
    <div className="stage-label"><span className="live-dot"/> LOCAL 3D PREVIEW</div>
    <div className="view-buttons"><button onClick={() => view.current('front')}>북쪽에서</button><button onClick={() => view.current('side')}>동쪽에서</button><button onClick={() => view.current('iso')}>사선 / 초기화</button></div>
    <div className="stage-help">드래그 회전 · 휠 확대 · 우클릭 이동 <span>초록 +Y 북쪽 / 황토 +X 동쪽</span></div>
    {error && <div className="graphics-error" role="alert">{error}</div>}
  </div>;
}
