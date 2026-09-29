# Ocean Insight (gogo-snorkel)

동해안 스노클링 지점의 파고/스웰/수온/기온 예보(Open-Meteo)와 KHOA 실측 파랑
데이터를 결합해, 지점별·시간대별 스노클링 적합도 점수/등급/추천 문구를
계산하고 정적 웹페이지로 보여주는 프로젝트입니다. 각 지점 및 동해안 전체
해변의 화장실 위치 정보도 함께 제공합니다.

**GitHub Actions(데이터 수집·스코어링) + GitHub Pages(정적 대시보드)** 조합으로만
동작하며, 별도 서버나 데이터베이스가 없습니다.

> 이 저장소는 원래 Google Apps Script + Google Sheets로 운영되던 프로젝트를
> GitHub 기반으로 완전히 이전한 버전입니다. Apps Script 버전(텔레그램 봇 포함)은
> 별도 저장소에 예비용으로 남아 있으며, 이 저장소와는 코드/데이터를 공유하지
> 않는 완전히 독립된 프로젝트입니다.
> Apps Script 저장소: `TODO: 저장소 URL 기입`

배포 URL: https://googjinkim.github.io/gogo-snorkel/

## 1. 아키텍처

```
lib/points.js (정본 37개 포인트: id/좌표/지역/KHOA 관측소 매핑)
        │
        ▼
scripts/collect-openmeteo.js ──▶ data/openmeteo-raw.json (파고/스웰/수온/기온, 8일치)
scripts/collect-khoa.js      ──▶ data/khoa-raw.json      (KHOA 매핑된 포인트만)
        │
        ▼
scripts/build-score.js (lib/scoring.js 점수 계산, lib/restrooms.js·
                         lib/beachRestrooms.js 화장실 정보 병합)
        │
        ▼
data/scored.json  ← 최종 산출물, 프런트엔드가 fetch하는 유일한 데이터 파일
        │
        ▼
index.html + app.js (정적 프런트엔드, 서버 계산 없이 scored.json만 읽어서 렌더링)
```

GitHub Actions(`.github/workflows/ocean-collect.yml`)가 **4시간마다(cron)** 위
파이프라인 전체를 실행하고, 변경된 `data/scored.json`을 자동으로 커밋합니다.

## 2. 지역 구성 (9개 지역, 37개 포인트)

| 지역 | 포인트 수 | 비고 |
|---|---|---|
| 고성 | 2 | |
| 속초 | 2 | |
| 양양 | 2 | |
| 강릉 | 4 | |
| 동해 | 3 | |
| 삼척 | 3 | |
| 울진 | 7 | 기존 4곳 + 비공식 스노클 포인트 3곳(갈남항/하트해변/진복리) |
| 영덕 | 6 | 고래불/대진/장사(공식 해변) + 축산항/대부방파제/석동방파제(비공식) |
| 포항 | 8 | 전부 공식 해수욕장(영일대/칠포/월포/화진/구룡포/도구/송도/신창) |

**비공식 스노클 포인트(해수욕장 아님)**: 항구·방파제·기암 등 실제 스노클링
커뮤니티(블로그/유튜브)에서 소개되는 숨은 명소들로, 정식 해수욕장 목록에는
없지만 좌표는 카카오 장소검색으로 확보하고 KHOA 매핑은 동일한 절차(거리
계산 + 실제 API 호출 검증)로 확인했습니다.

## 3. 폴더 구조

| 경로 | 역할 |
| --- | --- |
| `lib/points.js` | 정본 37개 스노클링 포인트 목록(좌표, 지역, KHOA 관측소 매핑) |
| `lib/scoring.js` | 스노클링 적합도 점수 계산 순수 함수 (`calculateScore`) |
| `lib/restrooms.js` | 포인트별 최인접 화장실 정보(이름/주소/거리/좌표), 최대 2건 |
| `lib/beachRestrooms.js` | 동해안 전체 해변(이름에 "해수욕장"/"해변" 포함) 화장실 목록 |
| `scripts/collect-openmeteo.js` | Open-Meteo Marine/Weather API 수집 (파고/스웰/수온/기온) |
| `scripts/collect-khoa.js` | KHOA 실측 파랑 API 수집 (KHOA 매핑된 포인트만) |
| `scripts/build-score.js` | raw 데이터 join + 점수 계산 + 화장실 정보 병합 |
| `scripts/find-restrooms.js` | (1회성 조사) 포인트별 화장실 후보 탐색, 이미 있는 포인트는 자동 스킵 |
| `scripts/find-all-beach-restrooms.js` | (1회성 조사) 전체 해변 화장실 목록 조사 |
| `scripts/audit-*.js` | (1회성 조사) 신규 포인트 좌표/KHOA 매핑 검증용 스크립트들 |
| `data/scored.json` | 최종 산출물. **git 추적 대상**, Actions가 자동 커밋 |
| `data/openmeteo-raw.json`, `data/khoa-raw.json` | 중간 산출물. `.gitignore` 대상 |
| `index.html`, `app.js` | 정적 프런트엔드 |
| `.github/workflows/ocean-collect.yml` | 수집·스코어링·자동 커밋 파이프라인 (cron + 수동 실행) |

## 4. 데이터 스키마: `data/scored.json`

```json
{
  "generatedAt": "ISO8601",
  "points": [
    {
      "id": "string", "name": "string", "area": "string",
      "hasKhoaMapping": true,
      "restrooms": [ { "name": "string", "roadAddr": "string", "lotAddr": "string",
                        "distanceKm": 0, "lat": 0, "lon": 0, "openHours": "string" } ],
      "hourly": [
        {
          "time": "yyyy-MM-dd HH:mm",
          "forecastWave": 0, "swellWave": 0, "waterTemp": 0, "airTemp": 0,
          "observedWave": null, "maxObservedWave": null,
          "score": 0, "grade": "string", "recommendation": "string",
          "reason": "string", "weatherCode": 0
        }
      ]
    }
  ]
}
```

`restrooms`는 후보가 없으면 빈 배열(`[]`). `airTemp`는 Open-Meteo Weather
API의 `temperature_2m`(지상 2m 기온)을 그대로 사용하며, 점수 계산에는
영향을 주지 않는 표시 전용 필드입니다.

## 5. KHOA 관측소 매핑 현황

| 관측소 코드 | 관측소명 | 매핑된 포인트 |
|---|---|---|
| TW_0089 | 경포대해수욕장 | 강릉 일부, 양양 남애3리 |
| TW_0091 | 낙산해수욕장 | 양양 하조대 |
| TW_0092 | 임랑해수욕장 | (검증 시 후보로만 확인, 미채택) |
| TW_0093 | 속초해수욕장 | 고성·속초 전체 |
| TW_0094 | 망상해수욕장 | 동해 일부, 울진 갈남항 |
| TW_0095 | 고래불해수욕장(영덕) | 삼척 일부, 울진 대부분, 영덕 전체, 포항 일부(주의 등급) |

매핑 없는 포인트(예보-only): 삼척 장호·용화, 울진 나곡·봉평·진복리, 영덕
축산항, 포항 구룡포·도구·송도·신창 등 — 관측소가 없거나(거리 60km 초과),
지리적으로 가까운 한수원(HB_) 부이는 KHOA `noonWave` API가 코드 체계 자체를
지원하지 않아(`INVALID_REQUEST_PARAMETER_ERROR`, 실제 호출로 확인됨) 매핑
불가로 처리했습니다.

## 6. 화장실 정보

- 데이터 출처: 행정안전부 공중화장실정보 조회서비스
  (`https://apis.data.go.kr/1741000/public_restroom_info_v2/info_v2`,
  `returnType=json` 파라미터 필수)
- 좌표(위도/경도) 미제공(2025년 2월 정책 변경) → 카카오 주소 검색/키워드
  검색 API로 지오코딩 + Haversine 거리 계산으로 보완
- **포인트별 화장실**(`lib/restrooms.js`): 37개 포인트 중 화장실 후보가 있는
  곳은 "자세히 보기" 화면에 카드(최대 2건, 500m 이내)로 표시. 갈남항은
  3km 이내 합리적인 후보가 없어 "후보 없음"으로 의도적으로 비워둠
- **전체 해변 목록**(`lib/beachRestrooms.js`, "동해바다 화장실 정보" 메뉴,
  총 103개 해변): 화장실 시설명에 "해수욕장"/"해변"이 포함된 것만 자동
  스캔하여 그룹핑하므로, 항구·방파제 이름의 비공식 포인트 6곳(갈남항·
  하트해변·진복리·축산항·대부방파제·석동방파제)은 이 목록에 포함되지
  않음(의도된 설계). "하트해변"도 이름에 "해변"이 들어가지만 실제 화장실
  시설명(드라마세트장, 죽변등대공원)에는 "해변"이 없어 자동 스캔에서
  잡히지 않으며, 아직 수동으로도 추가하지 않은 상태 — 이 6곳은 각 포인트의
  "자세히 보기" 카드(`lib/restrooms.js`)로만 접근 가능
- 두 화면 모두 "지도 보기" 클릭 시에만 카카오맵 SDK를 지연 로드(카드별 독립
  토글, 페이지 진입 시 지도 요청 0건)

## 7. 카카오 API 사용

| 키 | 용도 | 사용 위치 | 보안 |
| --- | --- | --- | --- |
| REST API 키 | 주소 → 좌표 지오코딩 | 로컬/CLI 조사 스크립트 | `KAKAO_REST_API_KEY` 환경변수로만 참조 |
| JavaScript 키 | 지도 임베드 SDK | 브라우저(app.js) | 코드에 노출 정상. 카카오 개발자센터에 등록된 도메인(`https://googjinkim.github.io`)만 허용 |

카카오맵 무료 쿼터(지도 SDK 일 30만 건, 주소 검색 일 10만 건)는 개발자 계정
기준 "첫 번째로 활성화한 앱"에만 제공됨(2026-07-21 정책 변경) — 현재 앱이
해당되어 정상 사용 중.

## 8. 로컬 개발

```bash
npm install
npm run collect:openmeteo
# KHOA_SERVICE_KEY=키 npm run collect:khoa  (또는 PowerShell: $env:KHOA_SERVICE_KEY="키")
npm run build:score

# 신규 포인트/화장실 재조사가 필요할 때만 (기존 데이터는 자동 스킵됨)
# PUBLIC_DATA_SERVICE_KEY=키 KAKAO_REST_API_KEY=키 npm run find:restrooms
```

로컬 산출물(`data/*.json`)은 커밋 대상이 아닙니다. 커밋 전
`git checkout -- data/scored.json`으로 원복하세요.

## 9. GitHub Actions

- **자동 실행**: 4시간마다(cron, UTC `0 */4 * * *` → KST 01/05/09/13/17/21시)
- **수동 실행**: `gh workflow run ocean-collect.yml`
- `actions/checkout`, `actions/setup-node` v7, Node.js 24
- 참고: `ubuntu-latest` 러너가 2026-10-19부터 Ubuntu 26으로 전환 예정(GitHub
  공지) — 통상 자동 전환되며 별도 조치 불필요, 문제 발생 시 재확인

## 10. GitHub Pages 배포

`main` 브랜치 루트를 그대로 배포합니다. 응답에 CDN 캐시(10분)가 걸려 있어
배포 직후 일시적으로 이전 버전이 보일 수 있습니다(강력 새로고침/시크릿
모드로 확인).

## 11. 보안

- `KHOA_SERVICE_KEY`, `PUBLIC_DATA_SERVICE_KEY`(data.go.kr 계정 공용 키),
  `KAKAO_REST_API_KEY`는 전부 GitHub Secrets로만 관리
- 이 사이트는 로그인/서버 사이드 로직/DB가 없는 정적 페이지이므로 WAF나
  로드밸런서 불필요

## 12. 브랜치 전략

- `main`: 실서비스(액티브)
- `dev`: 실험/백업용 (스테이징 배포 파이프라인은 아직 미착수)

## 13. 작업 원칙 (참고)

- API 필드명/파라미터/관측소 코드는 절대 추측하지 않고 실제 호출/공식
  데이터셋으로 확인 후 반영
- 데이터 확장 시 재실행 전후 기존 값이 그대로인지 diff로 확인(round-trip
  테스트)하는 습관으로 여러 사고를 사전에 예방함
- 모바일/데스크톱이 별도 렌더링 함수를 쓰는 경우가 많아 한쪽만 수정하지
  않고 항상 양쪽 확인
- 스키마가 바뀌거나 배포 데이터 갱신이 필요한 변경은 push 후
  `gh workflow run ocean-collect.yml`까지 실행

## 14. 다음에 고려할 것

- KHOA API 응답 지연(최대 ~3분) 최적화
- dev 브랜치 기반 실제 스테이징 배포 파이프라인 구축
- 2026-10-19 Ubuntu 26 러너 전환 이후 워크플로 정상 동작 재확인