# WTG KMZ Generator

Windows에서 풍력발전기 제원을 입력하고 3D 모델을 확인한 뒤 Google Earth용 KMZ를 저장하는 로컬 프로그램입니다. 현재 버전은 **0.1.0 로컬 시험판**입니다.

## 바로 실행

**현재 PC에서 실행 확인한 파일은 `program/win-unpacked/WTG KMZ Generator.exe`입니다.** 이 파일을 실행하세요.

다른 사람에게는 `program/WTG-KMZ-Generator-Folder-0.1.0-x64.zip`을 전달하고 전체 압축을 푼 뒤 폴더 안의 EXE를 실행하도록 안내하세요. EXE 본체만 떼어 전달하면 안 됩니다. 개발 도구나 별도 Node.js·Python 설치가 필요하지 않습니다. Windows x64용이며 최초 검증 대상은 Windows 11입니다.

단일 무설치 `program/WTG-KMZ-Generator-Portable-0.1.0-x64.exe`와 설치형 `program/WTG-KMZ-Generator-Setup-0.1.0-x64.exe`도 생성했습니다. 다만 이번 PC에서는 이 NSIS 포장 파일의 일반 실행이 Windows 접근 거부로 차단되어 사용 검증을 완료하지 못했습니다. 검증한 폴더형 EXE를 우선 사용하세요. 보안 설정을 변경하지 않았으며 차단의 구체적인 정책 원인은 확정하지 못했습니다.

1. 발전기 이름, 위도·경도, 허브 높이, 로터 직경, 주풍향을 입력합니다.
2. **미리보기 생성 / 적용**을 누릅니다.
3. 마우스 드래그로 회전하고 휠로 확대해 모델을 확인합니다.
4. **KMZ 파일 저장**을 눌러 위치를 선택합니다.
5. 결과 확인 시 별도로 설치한 Google Earth Pro에서 KMZ를 엽니다.

초기 좌표 36°N·129°E는 합성 시험용입니다. 실제 설치 위치로 변경하세요. 프로그램은 좌표·모델을 업로드하지 않으며 생성·저장은 오프라인으로 동작합니다.

## 구현 범위

- React·TypeScript 입력 화면과 Three.js 프리뷰
- Worker에서 타워·하우징·나셀·허브·3엽 로터 생성
- 같은 스냅샷으로 DAE 1.4.1·KML 2.2·KMZ 생성
- 풍향 heading 단일 적용, relativeToGround·absolute, 설치고 보정
- 저장 대화상자, 한글 경로, 취소·오류 복구, 임시 파일을 통한 기존 파일 보호
- Electron의 권한 분리, 제한 IPC, 외부 네트워크 요청 차단
- 설치형 NSIS와 무설치 portable 패키징

정확한 지원 한도, 추정 치수와 미검증 항목은 [사용 안내](docs/사용안내.md), [프리셋 근거](docs/PRESET.md), [검증 결과](docs/검증결과.md)를 확인하세요. 원본 개발계획서 전체의 정식 인수 완료를 의미하지 않습니다.

## 개발과 빌드

개발 PC에 Node.js 22.12 이상을 준비하고 다음 명령을 실행합니다. 실제 사용자는 이 절차가 필요 없습니다.

```powershell
npm ci
npm test
npm run build
npm run test:e2e
npm run dist:win
npm run verify:release
```

`npm run dev`는 현재 소스를 빌드해 Electron 창을 실행합니다. Windows 환경에서 패키징하세요. 최초 의존성·런타임·패키징 도구 다운로드에는 인터넷이 필요합니다. 의존성은 package-lock.json으로 고정했습니다.

코드 위치: `src/domain.ts` 입력·높이, `src/geometry.ts` 형상, `src/exporters.ts` 파일, `src/App.tsx` 화면·상태, `src/Preview.tsx` 3D 표시, `electron/` 권한·저장, `tests/` 수치·파일 시험입니다.

로컬 빌드는 원본 Electron EXE를 변경하지 않도록 ASAR와 실행 파일 리소스 편집을 사용하지 않습니다. 앱 소스는 `resources/app/`에 묶이며 앱 자체의 격리·CSP·IPC 검증은 동일합니다. Windows 파일 속성에는 기본 Electron 아이콘·제품명이 남을 수 있습니다. `scripts/build-windows.mjs`는 고정한 electron-builder의 내장 추출기를 사용해 빌드용 EXE를 실행하지 않고 NSIS 제거 프로그램을 만듭니다.

개발용 자동 UI 시험은 OS 저장 대화상자 응답만 대체합니다. 실제 IPC 검증과 디스크 쓰기를 수행하지만 사람이 네이티브 대화상자를 직접 조작한 시험과는 구분합니다. `node scripts/smoke.mjs "program/win-unpacked/WTG KMZ Generator.exe"`로 패키징된 본체도 검사할 수 있습니다.

## 배포 상태

로컬 빌드는 미서명 시험판입니다. 다른 PC의 실행 정책·Google Earth 외관·산지 배치와 코드 서명은 별도 수용 검증이 필요합니다. 공개 업로드나 외부 배포는 수행하지 않습니다. `.kmz` 파일은 프로그램 제거·교체 시 삭제하지 않습니다.

실행 의존성의 라이선스는 `docs/THIRD_PARTY_LICENSES.txt` 및 패키지의 Electron·Chromium 고지에 보관합니다. 프로젝트 자체 소스의 공개 라이선스는 아직 정하지 않았습니다.
