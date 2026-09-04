# Ocean Insight

바다 스노클링 지점의 파고/스웰/수온 예보와 KHOA 관측 데이터를 결합해
지점별 시간대별 점수/등급/추천 정보를 계산하는 데이터 수집·스코어링 파이프라인입니다.

이 저장소는 웹서버(대시보드) 전용 저장소이며, GitHub Actions 기반으로
데이터 수집(Open-Meteo, KHOA)과 점수 계산(build-score)을 수행합니다.
기존 Google Apps Script 코드는 별도 저장소에 예비용으로 남아 있으며,
이 저장소에서는 Apps Script 관련 파일(.gs, appsscript.json, .clasp.json)을
다루지 않습니다.

## 현재 단계 (1/4: 저장소 스캐폴딩)

이번 단계에서는 저장소 구조와 데이터 스키마만 정의합니다.
실제 API 수집 로직과 점수 계산 로직은 **다음 단계에서 구현 예정**입니다.

- `scripts/collect-openmeteo.js` — TODO: Open-Meteo API 수집 로직 (2단계)
- `scripts/collect-khoa.js` — TODO: KHOA API 수집 로직 (2단계)
- `scripts/build-score.js` — TODO: 수집 데이터를 합쳐 `data/scored.json` 생성 (2단계)
- `lib/points.js` — TODO: 지점 목록 및 점수 계산 로직 (2단계)
- `.github/workflows/ocean-collect.yml` — 현재는 `workflow_dispatch`(수동 실행)만
  지원. cron 스케줄 및 결과 커밋 스텝은 다음 단계에서 추가 예정.

## 데이터 스키마: `data/scored.json`

`scripts/build-score.js`가 최종적으로 생성할 산출물의 스키마입니다.

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

### 필드 설명

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `generatedAt` | string (ISO8601) | scored.json 생성 시각 |
| `points[].id` | string | 지점 고유 ID |
| `points[].name` | string | 지점명 |
| `points[].area` | string | 지역명 |
| `points[].hasKhoaMapping` | boolean | 해당 지점에 매핑된 KHOA 관측소가 있는지 여부 |
| `points[].hourly[].time` | string | 시간대 (`yyyy-MM-dd HH:mm`) |
| `points[].hourly[].forecastWave` | number | 예보 파고 (Open-Meteo) |
| `points[].hourly[].swellWave` | number | 스웰 파고 (Open-Meteo) |
| `points[].hourly[].waterTemp` | number | 수온 (Open-Meteo) |
| `points[].hourly[].observedWave` | number \| null | 실측 파고 (KHOA, 매핑 없으면 null) |
| `points[].hourly[].maxObservedWave` | number \| null | 최대 실측 파고 (KHOA, 매핑 없으면 null) |
| `points[].hourly[].score` | number | 계산된 스노클링 적합도 점수 |
| `points[].hourly[].grade` | string | 점수에 따른 등급 |
| `points[].hourly[].recommendation` | string | 추천 문구 |
| `points[].hourly[].reason` | string | 점수/등급 산정 이유 |
| `points[].hourly[].weatherCode` | number | 날씨 코드 (Open-Meteo) |

## 비밀값 관리

- `KHOA_SERVICE_KEY`는 코드에 절대 하드코딩하지 않습니다.
- GitHub 저장소 Secrets에 `KHOA_SERVICE_KEY`를 등록하면, workflow(`.github/workflows/ocean-collect.yml`)가
  `secrets.KHOA_SERVICE_KEY`를 환경변수로 주입하고, `scripts/collect-khoa.js`는
  `process.env.KHOA_SERVICE_KEY`로만 이를 참조합니다.

## 로컬 실행

```bash
npm install
npm run collect:openmeteo   # 현재는 빈 함수 (TODO)
npm run collect:khoa        # 현재는 빈 함수 (TODO)
npm run build:score         # 현재는 빈 함수 (TODO)
```

## GitHub Actions 수동 실행

1. GitHub 저장소의 **Actions** 탭으로 이동
2. **Ocean Data Collect & Score** workflow 선택
3. **Run workflow** 버튼 클릭 (수동 실행, `workflow_dispatch`)

현재 단계에서는 각 스크립트가 빈 함수이므로 실제 데이터는 생성되지 않으며,
workflow는 실패 없이 완료되는 것을 확인하는 용도입니다.

## 다음 단계 (2/4 예정)

- `lib/points.js`에 지점 목록 및 점수 계산 로직 구현
- `scripts/collect-openmeteo.js`, `scripts/collect-khoa.js`에 실제 API 호출 구현
- `scripts/build-score.js`에서 두 데이터 소스를 병합해 `data/scored.json` 생성
- `.github/workflows/ocean-collect.yml`에 cron 스케줄 및 결과 커밋 스텝 추가
