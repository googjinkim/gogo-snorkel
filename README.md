# Ocean Insight (gogo-snorkel)

동해안 스노클링 지점의 파고/스웰/수온 예보(Open-Meteo)와 KHOA 실측 파랑 데이터를
결합해, 지점별·시간대별 스노클링 적합도 점수/등급/추천 문구를 계산하고 정적
웹페이지로 보여주는 프로젝트입니다. 각 지점에서 가장 가까운 공중화장실 정보도
함께 제공합니다.

**GitHub Actions(데이터 수집·스코어링) + GitHub Pages(정적 대시보드)** 조합으로만
동작하며, 별도 서버나 데이터베이스가 없습니다.

> 이 저장소는 원래 Google Apps Script + Google Sheets로 운영되던 프로젝트를
> GitHub 기반으로 완전히 이전한 버전입니다. Apps Script 버전(텔레그램 봇 포함)은
> 별도 저장소에 예비용으로 남아 있으며, 이 저장소와는 코드/데이터를 공유하지
> 않는 완전히 독립된 프로젝트입니다.
> Apps Script 저장소: https://github.com/googjinkim/OceanInsight-V2

배포 URL: https://googjinkim.github.io/gogo-snorkel/

## 1. 아키텍처

```
lib/points.js (정본 20개 포인트: id/좌표/지역/KHOA 관측소 매핑)
        │
        ▼
scripts/collect-openmeteo.js ──▶ data/openmeteo-raw.json   (20개 포인트, 8일치 예보)
scripts/collect-khoa.js      ──▶ data/khoa-raw.json        (KHOA 매핑된 16개 포인트만)
        │
        ▼
scripts/build-score.js (lib/scoring.js로 점수 계산, lib/restrooms.js 화장실 정보 병합)
        │
        ▼
data/scored.json  ← 최종 산출물, 프런트엔드가 fetch하는 유일한 데이터 파일
        │
        ▼
index.html + app.js (정적 프런트엔드, 서버 계산 없이 scored.json만 읽어서 렌더링)
```

GitHub Actions(`.github/workflows/ocean-collect.yml`)가 **4시간마다(cron)** 위
파이프라인 전체를 실행하고, 변경된 `data/scored.json`을 자동으로 커밋합니다.
GitHub Pages는 `main` 브랜치를 그대로 정적 호스팅합니다.

## 2. 폴더 구조

| 경로 | 역할 |
| --- | --- |
| `lib/points.js` | 정본 20개 스노클링 포인트 목록(좌표, 지역, KHOA 관측소 매핑) |
| `lib/scoring.js` | 스노클링 적합도 점수 계산 순수 함수 (`calculateScore`) |
| `lib/restrooms.js` | 포인트별 최인접 화장실 후보 목록(이름/주소/거리/좌표), 포인트당 최대 2건 배열로 정적 저장 |
| `scripts/collect-openmeteo.js` | Open-Meteo Marine/Weather API 수집 (20개 포인트 전체) |
| `scripts/collect-khoa.js` | KHOA 실측 파랑 API 수집 (KHOA 매핑된 16개 포인트만) |
| `scripts/build-score.js` | raw 데이터 join + 점수 계산 + 화장실 정보 병합 → `data/scored.json` 생성 |
| `scripts/find-restrooms.js` | (1회성 조사 도구) 공중화장실 API + 카카오 지오코딩으로 포인트별 후보 탐색, `lib/restrooms.js` 생성 |
| `scripts/audit-restrooms.js` | (1회성 진단 도구) 화장실 API 응답 구조/필드명 확인용 |
| `data/scored.json` | 최종 산출물. **git 추적 대상**, Actions가 자동 커밋 |
| `data/openmeteo-raw.json`, `data/khoa-raw.json` | 중간 산출물. `.gitignore` 대상 |
| `index.html`, `app.js` | 정적 프런트엔드 (검색, 지역별 목록, 상세보기, 화장실 카드+지도, sticky 헤더 등) |
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
      "restrooms": [
        {
          "name": "string",
          "roadAddr": "string",
          "lotAddr": "string",
          "distanceKm": 0,
          "lat": 0,
          "lon": 0,
          "openHours": "string",
          "hasEmergencyBell": true
        }
      ],
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

`restrooms`는 배열입니다. 가장 가까운 후보가 항상 0번째 항목이고, 그 거리 +
0.5km 이내에 다른 후보가 있으면 1번째 항목으로 함께 포함됩니다(없으면 배열
길이 1). 화장실 후보가 아예 없는 포인트는 빈 배열 `[]`입니다.

## 4. KHOA 관측소 매핑 현황

20개 포인트 중 **16개는 KHOA 실측 파랑 관측소에 매핑**되어 있고, 나머지
**4개(`jangho`, `yonghwa`, `nagok_beach`, `bongpyeong_beach`)는 예보(Open-Meteo)만
사용하는 "예보-only" 포인트**입니다. 인근 한수원 연계 관측소(HB_0007/8/9)도
검토했으나, KHOA `noonWave` API가 HB_ 코드 체계 자체를 지원하지 않아
(`INVALID_REQUEST_PARAMETER_ERROR`) 매핑하지 않았습니다.

## 5. 화장실 정보

- 데이터 출처: 행정안전부 공중화장실정보 조회서비스
  (`https://apis.data.go.kr/1741000/public_restroom_info_v2/info_v2`)
- 이 API는 **위도/경도를 제공하지 않습니다** (2025년 2월 정책 변경으로 좌표 항목
  제공 중단). 이를 보완하기 위해 화장실 주소를 **카카오 주소 검색 API**로
  지오코딩하여 좌표를 얻고, `lib/points.js`의 포인트 좌표와 Haversine 공식으로
  실제 거리를 계산해 포인트별 후보를 확정했습니다.
- 포인트별로 **가장 가까운 후보 1건 + (그 거리 500m 이내에 다른 후보가 있으면)
  2번째 후보까지 최대 2건**을 저장합니다. 원본 데이터셋에 동일 화장실이
  이름/주소까지 완전히 중복 등록된 경우가 있어, 저장 전에 이름+주소 기준으로
  중복을 제거합니다.
- 핵심어가 지역명과 동일해 변별력이 없던 2개 포인트(`sokcho_beach`,
  `samcheok_beach`)는 행정구역명 필터를 통과한 후보 전체를 지오코딩해서
  거리순으로 재선정했습니다(임의로 앞 몇 건만 뽑지 않음).
- 이 조사는 `scripts/find-restrooms.js`로 1회성 수행되었으며, 결과는
  `lib/restrooms.js`에 정적으로 저장되어 있습니다(화장실 위치는 자주 바뀌지
  않으므로 자동화하지 않음). `build-score.js`가 이 값을 `scored.json`에
  `restrooms` 배열 필드로 포함시킵니다.
- 프런트엔드에서는 홈 화면 상단에 "화장실 정보는 각 포인트의 자세히 보기에서
  확인 가능" 안내 문구를 표시하고, "자세히 보기" 화면 상단에 포인트당 최대
  2개의 화장실 카드를 표시합니다. 카드별 "지도 보기" 버튼은 서로 독립적으로
  동작하며, 클릭 시 카카오맵 JavaScript SDK를 지연 로드해 카드 안에 지도를
  임베드합니다(SDK는 최초 1회만 로드 후 재사용).

## 6. 카카오 API 사용

| 키 | 용도 | 사용 위치 | 보안 |
| --- | --- | --- | --- |
| REST API 키 | 주소 → 좌표 지오코딩 (`scripts/find-restrooms.js`) | 로컬/CLI 실행 환경 | `KAKAO_REST_API_KEY` 환경변수로만 참조, 코드에 하드코딩 금지 |
| JavaScript 키 | 지도 임베드 SDK (`app.js`) | 브라우저(클라이언트) | 코드에 그대로 노출되는 것이 정상. 카카오 개발자센터에 등록된 도메인(`https://googjinkim.github.io`)만 허용되는 것이 유일한 보안장치 |

## 7. 로컬 개발

```bash
npm install

npm run collect:openmeteo
# macOS/Linux: KHOA_SERVICE_KEY=발급받은키 npm run collect:khoa
# Windows PowerShell: $env:KHOA_SERVICE_KEY="발급받은키"; npm run collect:khoa
npm run build:score

# 화장실 후보 재조사가 필요할 때만 (평소엔 실행 불필요)
# PUBLIC_DATA_SERVICE_KEY=키 KAKAO_REST_API_KEY=키 npm run find:restrooms
```

로컬 실행으로 생긴 `data/*.json`은 커밋 대상이 아닙니다(운영 데이터는 Actions가
관리). 커밋 전 `git checkout -- data/scored.json`으로 원복하세요.

## 8. GitHub Actions

- **자동 실행**: 4시간마다(cron, UTC `0 */4 * * *` → KST 01/05/09/13/17/21시)
- **수동 실행**: `gh workflow run ocean-collect.yml` 또는 저장소 Actions 탭에서 실행
- `actions/checkout@v7`, `actions/setup-node@v7`, Node.js 24 기준으로 구성되어
  있습니다(GitHub의 Node 20 러너 지원 종료(2026-09-16)에 대응해 갱신됨).
- 커밋은 `github-actions[bot]` 명의, 변경 없으면 스킵, `[skip ci]`로 재귀 실행 방지.

## 9. GitHub Pages 배포

`main` 브랜치 루트를 그대로 배포합니다(Settings → Pages → Deploy from a branch →
`main` / `(root)`). 새 커밋이 생기면 자동 재배포됩니다.

## 10. 보안

- `KHOA_SERVICE_KEY`, `PUBLIC_DATA_SERVICE_KEY`(data.go.kr 계정 공용 키),
  `KAKAO_REST_API_KEY`는 전부 GitHub Secrets로만 관리
- 저장소 Settings → Code security의 **Secret scanning**, **Push protection**,
  **Dependabot alerts** 전부 활성화되어 있습니다 (확인 완료).
- 로그인/서버 사이드 로직/DB가 없는 정적 페이지라 별도 WAF·로드밸런서 불필요

## 11. 브랜치 전략

- `main`: 실서비스(액티브)
- `dev`: 실험/백업용 (필요 시 별도 GitHub Pages 배포 경로로 스테이징 검증 도입 검토)

## 12. 다음에 고려할 것

- KHOA API 응답 지연(최대 ~3분) 최적화
- 텔레그램 봇 재도입 여부 (현재 완전 배제)
- `dev` 브랜치 실제 스테이징 배포 파이프라인 구축
