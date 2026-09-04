// KHOA(국립해양조사원) noonWave API로부터 관측 파고(observedWave) /
// 최대관측파고(maxObservedWave) 등을 수집하여 /data/khoa-raw.json에 저장한다.
// TODO(3단계): 이 raw 데이터와 openmeteo-raw.json을 병합해 점수를 계산하는 로직은
// scripts/build-score.js에서 구현 예정.
//
// 주의: KHOA_SERVICE_KEY는 코드에 절대 하드코딩하지 않는다.
// GitHub Actions workflow(.github/workflows/ocean-collect.yml)에서
// secrets.KHOA_SERVICE_KEY를 환경변수로 주입받아, process.env.KHOA_SERVICE_KEY로만
// 참조한다. 로컬 테스트 시에는 `KHOA_SERVICE_KEY=xxx npm run collect:khoa`처럼
// 환경변수로 직접 실행한다.

const fs = require("fs");
const path = require("path");
const { getAllPoints } = require("../lib/points");

const OUTPUT_PATH = path.join(__dirname, "..", "data", "khoa-raw.json");

/** 오늘 날짜를 KST(Asia/Seoul) 기준 "yyyyMMdd" 문자열로 반환한다. */
function getKstDateString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}${map.month}${map.day}`;
}

function noonWaveUrl(obsCode, reqDate) {
  const serviceKey = process.env.KHOA_SERVICE_KEY;
  return `https://apis.data.go.kr/1192136/noonWave/GetNoonWaveApiService?serviceKey=${serviceKey}&type=json&pageNo=1&numOfRows=300&obsCode=${obsCode}&reqDate=${reqDate}&min=60`;
}

/**
 * response.response.body.items.item(정상 응답) 또는 response.body.items.item(폴백)
 * 형태의 응답을 배열로 정규화한다. item은 배열 또는 단일 객체로 올 수 있다.
 */
function normalizeItems(json) {
  const item = json?.response?.body?.items?.item ?? json?.body?.items?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

/**
 * KHOA API 관측 항목 하나를 khoa-raw.json 스키마 형태로 매핑한다.
 * 필드명은 KHOA noonWave API 실제 응답 기준.
 * 참고: 좌표 필드는 KHOA API가 `lot`(경도)으로 내려주나, 이 스크립트는 좌표를
 * 저장하지 않으므로 사용하지 않는다.
 */
function mapItem(point, item) {
  return {
    pointId: point.id,
    obsCode: point.khoaObsCode,
    observedAt: item.obsrvnDt ?? null,
    observedWave: item.wvhgt ?? null,
    wavePeriod: item.wvpd ?? null,
    waveDirection: item.wvdrct ?? null,
    maxObservedWave: item.maxWvhgt ?? null,
    maxWavePeriod: item.maxWvpd ?? null,
  };
}

/**
 * KHOA API를 호출하여 매핑된 지점의 관측 데이터를 수집한다.
 * @returns {Promise<void>}
 */
async function collectKhoa() {
  const serviceKey = process.env.KHOA_SERVICE_KEY;
  if (!serviceKey) {
    console.error("[collect-khoa] KHOA_SERVICE_KEY 환경변수가 설정되지 않았습니다.");
  }

  const reqDate = getKstDateString();
  const points = getAllPoints();
  const result = [];

  for (const point of points) {
    if (!point.hasKhoaMapping) {
      console.log(`[collect-khoa] ${point.id}: KHOA 매핑 없음, skip`);
      continue;
    }

    try {
      const res = await fetch(noonWaveUrl(point.khoaObsCode, reqDate));
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const json = await res.json();
      const items = normalizeItems(json);
      const mapped = items.map((item) => mapItem(point, item));
      result.push(...mapped);
      console.log(`[collect-khoa] ${point.id} (${point.khoaObsCode}): ${mapped.length}건 수집`);
    } catch (err) {
      console.error(`[collect-khoa] ${point.id} 수집 실패:`, err.message);
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(`[collect-khoa] 총 ${result.length}건을 ${OUTPUT_PATH}에 저장`);
}

if (require.main === module) {
  collectKhoa();
}

module.exports = { collectKhoa };
