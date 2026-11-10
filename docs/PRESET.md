# 프리셋 근거와 형상 정확도

버전 `e175-concept-1`, 작성·조회일 2026-11-02. `ENERCON E-175 EP5 E2`는 잠정 참고 기종이며 원문의 `E175 EP2`와의 일치 여부는 미확정입니다.

| 파라미터 | 값 | 출처·확정 상태 |
|---|---|---|
| 기본 로터 직경 | 175m | ENERCON E-175 공식 제품 페이지, 공식 값 |
| 허브 높이 | 사용자 입력 | 입력값으로 최종 허브 중심 배치, 제조사 허용 조합 검증은 하지 않음 |
| 풍향·좌표·설치고·로터 자세 | 사용자 입력 | 사용자 지정 |
| 타워 하부·상부 반경 | 4.1m / 2.3m | 개략 외관용 추정 |
| 하우징 반경·두께 | 5.1m / 2.4m | 개략 외관용 추정 |
| 하우징 중심 Y | +1.25m | 로컬 원점에 대한 추정 배치 |
| 로터 중심 Y | +4.5m | 로컬 원점에 대한 추정 배치 |
| 후방 나셀 폭·길이·높이 | 4.8m / 13.5m / 4.3m | 개략 외관용 추정 |
| 허브·블레이드 단면·비틀림 | 코드 파라미터 | 사진 기반 개략 곡면, 공식 공력 단면 아님 |
| 축 경사·코닝 | 0° / 0° | 단순 모드 가정, 기종 실제 각도 아님 |

외관 근거는 원본 DOCX의 내장 이미지입니다. 사진 원근을 실제 치수로 환산하지 않았습니다. 이미지를 앱에 재배포하지 않으며 형상의 링·분할선·뒤쪽 사각 나셀·환기구 표현에 참고했습니다. 전체 모델은 5,384개 삼각형을 사용합니다.

입력 H와 D는 형상 수치로 검사하지만 추정 치수의 제조사 일치를 보증하지 않습니다. 출처가 확보되면 프리셋 버전을 올리고 치수·방위·파일·외관 회귀 시험을 수행해야 합니다.

- [ENERCON E-175 EP5 E1 / E2](https://www.enercon.de/en/turbines/e-175-ep5): 175m 직경과 제품명
- [Google KML Reference](https://developers.google.com/kml/documentation/kmlreference): 모델 방향·단위·삼각형 한도
- [Google Altitude Modes](https://developers.google.com/kml/documentation/altitudemode): 고도 해석
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security): main·renderer 격리와 IPC 제한

적용 의존성의 정확한 버전은 package-lock.json, 출력 속성의 generatorVersion·presetVersion은 KMZ의 ExtendedData로 추적합니다.
