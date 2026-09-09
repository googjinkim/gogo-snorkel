# Ocean Insight (gogo-snorkel)

동해안 스노클링 지점의 파고/스웰/수온 예보(Open-Meteo)와 KHOA 실측 파랑 데이터를
결합해, 지점별·시간대별 스노클링 적합도 점수/등급/추천 문구를 계산하고 정적
웹페이지로 보여주는 프로젝트입니다.

**GitHub Actions(데이터 수집·스코어링) + GitHub Pages(정적 대시보드)** 조합으로만
동작하며, 별도 서버나 데이터베이스가 없습니다.

> 이 저장소는 원래 Google Apps Script + Google Sheets로 운영되던 프로젝트를
> GitHub 기반으로 완전히 이전한 버전입니다. Apps Script 버전(텔레그램 봇 포함)은
> 별도 저장소에 예비용으로 남아 있으며, 이 저장소와는 코드/데이터를 공유하지
> 않는 완전히 독립된 프로젝트입니다.
> Apps Script 저장소: https://github.com/googjinkim/OceanInsight-V2

## 1. 아키텍처

```
lib/points.js (정본 20개 포인트: id/좌표/지역/KHOA 관측소 매핑)
        │
        ▼
scripts/collect-openmeteo.js ──▶ data/openmeteo-raw.json   (20개 포인트, 8일치 예보)
scripts/collect-khoa.js      ──▶ data/khoa-raw.json        (KHOA 매핑된 16개 포인트만)
        │
        ▼
scripts/build-score.js (lib/scoring.js로 점수 계산, 두 raw 데이터 join)
        │
        ▼
data/scored.json  ← 최종 산출물, 프런트엔드가 fetch하는 유일한 데이터 파일
        │
        ▼
index.html + app.js (정적 프런트엔드, 서버 계산 없이 scored.json만 읽어서 렌더링)
```

GitHub Actions(`.github/workflows/ocean-collect.yml`)가 **4시간마다(cron)** 위
파이프라인 전체를 실행하고, 변경된 `data/scored.json`을 자동으로 커밋합니다.
GitHub Pages는 `main` 브랜치 루트를 그대로 정적 호스팅합니다 — 방문자가 페이지를
열 때마다 서버가 계산하지 않고, 이미 계산되어 커밋된 JSON 파일을 CDN에서
그대로 내려받기만 하므로 응답이 빠릅니다.

## 2. 폴더 구조

| 경로 | 역할 |
| --- | --- |
| `lib/points.js` | 정본 20개 스노클링 포인트 목록(좌표, 지역, KHOA 관측소 매핑) |
| `lib/scoring.js` | 스노클링 적합도 점수 계산 순수 함수 (`calculateScore`) |
| `scripts/collect-openmeteo.js` | Open-Meteo Marine/Weather API 수집 (20개 포인트 전체) |
| `scripts/collect-khoa.js` | KHOA 실측 파랑 API 수집 (KHOA 매핑된 16개 포인트만) |
| `scripts/build-score.js` | raw 데이터 join + 점수 계산 → `data/scored.json` 생성 |
| `data/scored.json` | 최종 산출물. **git 추적 대상**, Actions가 자동 커밋 |
| `data/openmeteo-raw.json`, `data/khoa-raw.json` | 중간 산출물. `.gitignore` 대상 |
| `index.html` | 정적 프런트엔드 마크업/스타일 (검색, 지역별 목록, 상세보기, sticky 헤더 등) |
| `app.js` | 프런트엔드 렌더링 로직 (데이터 fetch, 화면별 렌더 함수, 이벤트 바인딩) |
| `.github/workflows/ocean-collect.yml` | 수집·스코어링·자동 커밋 파이프라인 (cron + 수동 실행) |

## 3. 데이터 스키마: `data/scored.json`

```json
{
  "generatedAt": "ISO8601",
  "points": [
    {
      "id": "string",
      "name": "string",
      "area": "string",
      "hasKhoaMapping": true,
      "hourly": [
        {
          "time": "yyyy-MM-dd HH:mm",
          "forecastWave": 0,
          "swellWave": 0,
          "waterTemp": 0,
          "observedWave": null,
          "maxObservedWave": null,
          "score": 0,
          "grade": "string",
          "recommendation": "string",
          "reason": "string",
          "weatherCode": 0
        }
      ]
    }
  ]
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `generatedAt` | string (ISO8601) | scored.json 생성 시각 |
| `points[].id` | string | 지점 고유 ID |
| `points[].name` | string | 지점명 |
| `points[].area` | string | 지역명 |
| `points[].hasKhoaMapping` | boolean | 매핑된 KHOA 관측소 유무 |
| `points[].hourly[].time` | string | 시간대 (`yyyy-MM-dd HH:mm`) |
| `points[].hourly[].forecastWave` | number \| null | 예보 파고 (Open-Meteo) |
| `points[].hourly[].swellWave` | number \| null | 예보 너울 파고 (Open-Meteo) |
| `points[].hourly[].waterTemp` | number \| null | 예보 수온 (Open-Meteo) |
| `points[].hourly[].observedWave` | number \| null | 실측 파고 (KHOA, 매핑 없거나 미래 시점이면 null) |
| `points[].hourly[].maxObservedWave` | number \| null | 실측 최대 파고 (KHOA) |
| `points[].hourly[].score` | number | 스노클링 적합도 점수 (0~100) |
| `points[].hourly[].grade` | string | 등급 (`★☆☆☆☆` ~ `★★★★★`, 50점 미만/80점/90점 등 5구간) |
| `points[].hourly[].recommendation` | string | 추천 문구 (`비추천` ~ `강력추천`) |
| `points[].hourly[].reason` | string | 점수 산정 사유 (최대 5개, `", "`로 join) |
| `points[].hourly[].weatherCode` | number | 날씨 코드 (Open-Meteo) |

> `forecast_days`는 **8일**로 설정되어 있습니다. Open-Meteo Marine API의 실제
> 파고 예보 신뢰 구간이 ~9.4일 정도라, 이보다 늘리면 `forecastWave` 등 파고
> 관련 필드가 null로 채워지는 시간대가 생겨(수온/날씨코드는 더 오래 유지됨)
> 8일로 유지하고 있습니다 (`scripts/collect-openmeteo.js` 주석 참고).

## 4. KHOA 관측소 매핑 현황

20개 포인트 중 **16개는 KHOA 실측 파랑 관측소에 매핑**되어 있고, 나머지
**4개(`jangho`, `yonghwa`, `nagok_beach`, `bongpyeong_beach`)는 예보(Open-Meteo)만
사용하는 "예보-only" 포인트**입니다 (`lib/points.js`에서 `khoaObsCode: ""`로
표시). 이 4곳은 두 가지 다른 사정으로 매핑이 안 되어 있습니다:

- `jangho`(장호)·`yonghwa`(용화): 인근에 이 프로젝트가 쓰는 KHOA 관측소
  후보 자체가 없어 애초에 매핑 대상이 아니었습니다.
- `nagok_beach`(나곡)·`bongpyeong_beach`(봉평): 지리적으로 가까운 한수원 연계
  관측소(`HB_0008`, `HB_0009`)가 후보로 존재해 Apps Script 버전의 관측소 감사
  스크립트에서 테스트된 적은 있지만, 최종적으로 이 프로젝트가 쓰는 `noonWave`
  API 경로로는 채택되지 않아 예보 전용으로 남아 있습니다.

매핑 정보(좌표, 관측소 코드)는 전부 `lib/points.js`에 정적으로 하드코딩되어
있으며, 거리 계산으로 최적 관측소를 찾는 로직은 Apps Script 버전에서 이미
검증이 끝난 결과를 그대로 이식한 것이라 이 저장소에는 포함되어 있지 않습니다.

## 5. 로컬 개발

```bash
npm install

# Open-Meteo 수집 (API 키 불필요)
npm run collect:openmeteo

# KHOA 수집 (서비스 키 필요, 하드코딩 금지 — 매번 환경변수로 주입)
# macOS/Linux
KHOA_SERVICE_KEY=발급받은키 npm run collect:khoa
# Windows PowerShell
$env:KHOA_SERVICE_KEY="발급받은키"; npm run collect:khoa

# 위 두 raw 데이터를 join해서 scored.json 생성
npm run build:score
```

`data/openmeteo-raw.json`, `data/khoa-raw.json`, `data/scored.json`은 로컬
테스트로 새로 만들어져도 **커밋 대상이 아닙니다** (raw 2개는 `.gitignore`,
`scored.json`은 실제 운영 데이터를 Actions가 관리하므로 로컬 산출물은
`git checkout -- data/scored.json`으로 되돌리고 코드만 커밋하는 것을 권장합니다).

## 6. GitHub Actions

- **자동 실행**: 4시간마다(cron, UTC 기준 `0 */4 * * *` → KST로는 01/05/09/13/17/21시)
  전체 파이프라인(수집 → 점수 계산 → `scored.json` 커밋)을 자동 실행합니다.
- **수동 실행**: 저장소 Actions 탭 → `Ocean Data Collect & Score` → `Run workflow`
- 커밋은 `github-actions[bot]` 명의로 이루어지며, 변경사항이 없으면 커밋을
  건너뜁니다. 커밋 메시지에는 `[skip ci]`가 포함되어 재귀적으로 워크플로가
  다시 실행되지 않습니다.
- 필요 권한: workflow에 `permissions: contents: write`가 설정되어 있어야
  `scored.json` 자동 커밋/푸시가 가능합니다.

## 7. GitHub Pages 배포

`main` 브랜치 루트를 그대로 배포합니다 (Settings → Pages → Source: Deploy from
a branch → `main` / `(root)`). 별도 빌드 단계가 없으므로 `main`에 새 커밋이
생기면(코드 변경이든 Actions의 자동 데이터 갱신이든) GitHub Pages가 자동으로
재배포합니다.

## 8. 프런트엔드 (`index.html` + `app.js`)

프레임워크·빌드 단계 없는 순수 HTML/CSS/JS이며, `data/scored.json` 하나만
fetch해서 아래 화면을 전부 클라이언트에서 계산·렌더링합니다. 마크업/스타일은
`index.html`에, 렌더링 로직은 `app.js`에 있습니다(CSP `script-src 'self'`가
인라인 스크립트 없이도 동작하도록 분리, 9장 참고).

- 메인 홈: 오늘 20개 포인트, 4시간 단위 요약
- 검색 / 지역별 목록: 이번 주 데이터, 4시간 단위, 날짜별 그룹
- 상세보기: 이번주/다음주 탭, 1시간 단위, 날짜별 베스트 시간 배지(1위 왕관 표시)
- 데스크톱: 좌측 사이드바 + 상단 정보 영역 + 상세보기 헤더가 스크롤 시 고정(sticky)
- 모바일: 코멘트 컬럼 생략(가독성), 검색창 축약 placeholder 등 반응형 별도 처리

## 9. 보안

- `KHOA_SERVICE_KEY`는 코드에 하드코딩하지 않고 GitHub 저장소 **Secrets**로만
  관리하며, workflow가 환경변수로 주입합니다.
- 저장소 Settings → Code security의 **Secret scanning**, **Push protection**,
  **Dependabot alerts** 전부 활성화되어 있습니다 (확인 완료).
- 사용자 입력(검색어)과 외부 데이터(scored.json의 문자열 필드)를 화면에 표시할
  때는 전부 `esc()`로 이스케이프 처리합니다 — 현재 데이터 소스는 우리가 직접
  만들지만, 나중에 오염되더라도 화면에서 그대로 실행되지 않도록 방어적으로
  전수 적용했습니다.
- `index.html`에 `Content-Security-Policy` 메타 태그를 적용해, 스크립트가
  주입되더라도 브라우저가 실행 자체를 차단하도록 했습니다(`script-src 'self'`,
  인라인 스크립트 불허 — 그래서 렌더링 로직이 `app.js`로 분리되어 있습니다).
- CDN에서 불러오는 정적 리소스(Tabler Icons)에는 SRI(`integrity`/`crossorigin`)를
  적용했습니다. Google Fonts는 응답이 UA별로 달라져 SRI를 공식 지원하지 않아
  예외입니다.
- 이 사이트는 로그인/서버 사이드 로직/DB가 없는 순수 정적 페이지이므로, 별도의
  WAF나 로드밸런서 없이 GitHub의 CDN 인프라만으로 충분합니다.

## 10. 다음에 고려할 것

- `dev` 브랜치 기반 스테이징 배포 (실 서비스에 영향 없이 UI 변경 미리 검증)
- KHOA API 응답 지연 체감 사례가 있어, 재시도/타임아웃 처리 여지가 있는지 검토
  (현재 코드에 별도 타임아웃 로직은 없음 — 확인 필요)
- 텔레그램 봇 재도입 여부 (현재는 완전히 배제, 필요 시 별도 서버리스로 검토)
