// data/openmeteo-raw.json과 data/khoa-raw.json을 pointId + 시간(분 단위) 기준으로
// join하고, lib/scoring.js로 점수를 계산해 data/scored.json을 생성한다.
// scored.json 스키마는 README.md 참고.

const fs = require("fs");
const path = require("path");
const { getAllPoints } = require("../lib/points");
const { calculateScore } = require("../lib/scoring");

const OPENMETEO_RAW_PATH = path.join(__dirname, "..", "data", "openmeteo-raw.json");
const KHOA_RAW_PATH = path.join(__dirname, "..", "data", "khoa-raw.json");
const OUTPUT_PATH = path.join(__dirname, "..", "data", "scored.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/** "yyyy-MM-dd HH:mm(:ss)?" 형태의 문자열을 분 단위 "yyyy-MM-dd HH:mm"으로 절삭한다. */
function normalizeToMinute(dateTimeStr) {
  if (!dateTimeStr) return null;
  return String(dateTimeStr).replace("T", " ").slice(0, 16);
}

/** khoa-raw.json 배열을 `${pointId}__${yyyy-MM-dd HH:mm}` 키로 색인화한다. */
function indexKhoaByPointAndMinute(khoaRaw) {
  const map = new Map();
  for (const item of khoaRaw) {
    const minuteTime = normalizeToMinute(item.observedAt);
    if (!minuteTime) continue;
    map.set(`${item.pointId}__${minuteTime}`, item);
  }
  return map;
}

/**
 * raw 데이터를 읽어 점수/등급/추천 여부를 계산하고 /data/scored.json으로 저장한다.
 * @returns {Promise<void>}
 */
async function buildScore() {
  const openmeteoRaw = readJsonIfExists(OPENMETEO_RAW_PATH);
  const khoaRaw = readJsonIfExists(KHOA_RAW_PATH);
  const khoaIndex = indexKhoaByPointAndMinute(khoaRaw);

  const openmeteoByPoint = new Map();
  for (const item of openmeteoRaw) {
    if (!openmeteoByPoint.has(item.pointId)) {
      openmeteoByPoint.set(item.pointId, []);
    }
    openmeteoByPoint.get(item.pointId).push(item);
  }

  const points = getAllPoints().map((point) => {
    const hourlyRaw = openmeteoByPoint.get(point.id) || [];

    const hourly = hourlyRaw.map((raw) => {
      const khoaMatch = khoaIndex.get(`${point.id}__${raw.time}`);
      const observedWave = khoaMatch?.observedWave ?? null;
      const maxObservedWave = khoaMatch?.maxObservedWave ?? null;

      const { score, grade, recommendation, reason } = calculateScore({
        forecastWave: raw.forecastWave,
        swellWave: raw.swellWave,
        waterTemp: raw.waterTemp,
        observedWave,
        maxObservedWave,
      });

      return {
        time: raw.time,
        forecastWave: raw.forecastWave,
        swellWave: raw.swellWave,
        waterTemp: raw.waterTemp,
        observedWave,
        maxObservedWave,
        score,
        grade,
        recommendation,
        reason,
        weatherCode: raw.weatherCode,
      };
    });

    return {
      id: point.id,
      name: point.name,
      area: point.area,
      hasKhoaMapping: point.hasKhoaMapping,
      hourly,
    };
  });

  const scored = {
    generatedAt: new Date().toISOString(),
    points,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(scored, null, 2));
  console.log(`[build-score] ${points.length}개 포인트를 ${OUTPUT_PATH}에 저장`);
}

if (require.main === module) {
  buildScore();
}

module.exports = { buildScore };
