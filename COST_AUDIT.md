# QUAD//LAB v0.2 무료 사용 감사 / 2026-10-27

## 소스에서 확인한 사항

| 점검 항목 | 결과 |
|---|---|
| GitHub Pages 파일 | 정적 HTML, CSS, JS, JSON, Arduino 샘플 |
| 서버 측 실행 코드 | 없음 |
| GitHub Actions workflow | 없음 |
| 결제 모듈 / 카드 SDK | 없음 |
| 인증 키 / 유료 API 호출 | 없음 |
| 외부 JS 모듈 | Three.js 0.180.0 + 공식 addons, jsDelivr CDN |
| 데이터 파일 업로드 | STL / JSON 파일을 브라우저 내부에서 읽음. 외부 업로드 기능 없음 |
| 저장 | 로컬 JSON 다운로드, Arduino 코드 다운로드 / 복사 |

## 외부 네트워크와 비용

`index.html`의 import map 두 줄만 외부 실행 종속 항목입니다:

- `https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js`
- `https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/`

위 CDN 주소는 구독이나 신용카드 없이 사용 가능한 공개 오픈소스 모듈입니다. 사용자 소스는 제3자 플랫폼에 과금 API 요청을 보내지 않습니다. Three.js: MIT License.

GitHub Pages 공식 문서: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
GitHub Actions 공식 문서: https://docs.github.com/en/billing/concepts/product-billing/github-actions
Three.js 라이선스: https://github.com/mrdoob/three.js/blob/master/LICENSE

## 권장 배포 설정

1. GitHub Free 개인 계정 + **공개(public)** 저장소.
2. Settings > Pages > Deploy from a branch > main / root.
3. 유료 플랜으로 변경하거나 유료 부가서비스 활성화하지 않기.
4. GitHub Actions 대형 유료 러너 / 유료 API / 유료 도메인 사용하지 않기.
5. 필요하면 GitHub Billing에서 관련 유료 서비스 예산을 0으로 설정하고 차단 옵션을 확인하기.

**주의:** 현재 GitHub 계정의 과금 설정은 이 소스 감사만으로 확인할 수 없습니다. 본 ZIP에 결제를 트리거하는 코드는 없으나, GitHub 계정에서 사용자가 별도로 활성화한 서비스의 청구 여부까지 보증하지 않습니다.

## 기능 한계

동역학 물리 엔진 및 SPICE 회로 해석은 현 버전에서 구현하지 않았습니다. 출력 값은 가정 기반 근사치로 실측 안전 판정에 쓰면 안 됩니다. 실제 Arduino 보드에 명령을 보내지 않습니다.
