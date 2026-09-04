// Open-Meteo Marine/Weather API로부터 지점별 파고/스웰/수온/날씨코드 시계열을
// 수집하여 /data/openmeteo-raw.json에 저장한다.
// TODO(3단계): 이 raw 데이터와 khoa-raw.json을 병합해 점수를 계산하는 로직은
// scripts/build-score.js에서 구현 예정.

const fs = require("fs");
const path = require("path");
const { getAllPoints } = require("../lib/points");

const MARINE_HOURLY = [
  "wave_height",
  "wave_period",
  "wave_direction",
  "swell_wave_height",
  "swell_wave_period",
  "sea_level_height_msl",
  "sea_surface_temperature",
].join(",");

const OUTPUT_PATH = path.join(__dirname, "..", "data", "openmeteo-raw.json");

// 8일치: Open-Meteo Marine API의 실제 파고 예보 신뢰 구간(~9.4일)을 벗어나지
// 않는 선. 이보다 늘리면 forecastWave 등 파고 관련 필드가 null로 채워지는
// 시간대가 생긴다 (수온/날씨코드는 더 오래 유지되지만 파고가 핵심 지표).
const FORECAST_DAYS = 8;

function marineUrl(lat, lon) {
  return `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=${MARINE_HOURLY}&timezone=Asia%2FSeoul&forecast_days=${FORECAST_DAYS}`;
}

function weatherUrl(lat, lon) {
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=weather_code&timezone=Asia%2FSeoul&forecast_days=${FORECAST_DAYS}`;
}

/** Open-Meteo의 "yyyy-MM-ddTHH:mm" 형식을 "yyyy-MM-dd HH:mm"으로 정규화한다. */
function normalizeTime(isoLocalTime) {
  return isoLocalTime.replace("T", " ");
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

/**
 * 한 지점에 대해 Marine/Weather API를 호출하고 시간 기준으로 병합한 hourly 배열을 반환한다.
 * @param {{id: string, lat: number, lon: number}} point
 * @returns {Promise<Array<object>>}
 */
async function collectPoint(point) {
  const [marine, weather] = await Promise.all([
    fetchJson(marineUrl(point.lat, point.lon)),
    fetchJson(weatherUrl(point.lat, point.lon)),
  ]);

  const weatherCodeByTime = new Map();
  const weatherTimes = weather.hourly?.time || [];
  const weatherCodes = weather.hourly?.weather_code || [];
  weatherTimes.forEach((time, i) => {
    weatherCodeByTime.set(time, weatherCodes[i]);
  });

  const marineHourly = marine.hourly || {};
  const times = marineHourly.time || [];

  return times.map((time, i) => ({
    pointId: point.id,
    time: normalizeTime(time),
    forecastWave: marineHourly.wave_height?.[i] ?? null,
    wavePeriod: marineHourly.wave_period?.[i] ?? null,
    waveDirection: marineHourly.wave_direction?.[i] ?? null,
    swellWave: marineHourly.swell_wave_height?.[i] ?? null,
    swellPeriod: marineHourly.swell_wave_period?.[i] ?? null,
    seaLevel: marineHourly.sea_level_height_msl?.[i] ?? null,
    waterTemp: marineHourly.sea_surface_temperature?.[i] ?? null,
    weatherCode: weatherCodeByTime.has(time) ? weatherCodeByTime.get(time) : null,
  }));
}

/**
 * Open-Meteo Marine/Weather API를 호출하여 지점별 시간별 데이터를 수집한다.
 * @returns {Promise<void>}
 */
async function collectOpenMeteo() {
  const points = getAllPoints();
  const result = [];

  for (const point of points) {
    try {
      const hourly = await collectPoint(point);
      result.push(...hourly);
      console.log(`[collect-openmeteo] ${point.id}: ${hourly.length}건 수집`);
    } catch (err) {
      console.error(`[collect-openmeteo] ${point.id} 수집 실패:`, err.message);
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(`[collect-openmeteo] 총 ${result.length}건을 ${OUTPUT_PATH}에 저장`);
}

if (require.main === module) {
  collectOpenMeteo();
}

module.exports = { collectOpenMeteo };
