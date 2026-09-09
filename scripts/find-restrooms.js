// 1회성 조사 스크립트: 행정안전부 공중화장실정보 API(1741000/public_restroom_info_v2)에서
// 20개 스노클링 포인트 각각에 매칭되는 화장실 후보를 찾고, 카카오 주소 검색
// API로 지오코딩해서 포인트와의 실제 거리(km)까지 계산해 콘솔에 출력한다.
// lib/restrooms.js에는 거리 기준 1순위 후보를 "임시(TODO)" 상태로 채운다.
//
// 이 스크립트는 GitHub Actions 워크플로에 포함하지 않는다 (화장실 위치는
// 자주 바뀌지 않으므로 자동화 불필요, scripts/audit-restrooms.js와 마찬가지로
// 1회성 조사 도구).
//
// 주의: PUBLIC_DATA_SERVICE_KEY / KAKAO_REST_API_KEY는 코드에 절대
// 하드코딩하지 않는다.
// 로컬 실행: `PUBLIC_DATA_SERVICE_KEY=xxx KAKAO_REST_API_KEY=yyy node scripts/find-restrooms.js`
//
// 결과는 자동 매칭 + 지오코딩 거리 기준 정렬일 뿐이므로, lib/restrooms.js를
// 실제로 사용하기 전에 사람이 콘솔 출력(포인트별 후보 목록과 거리)을 보고
// 최종 확정해야 한다.

const fs = require("fs");
const path = require("path");
const { getAllPoints } = require("../lib/points");

const API_BASE = "https://apis.data.go.kr/1741000/public_restroom_info_v2/info_v2";
const KAKAO_GEOCODE_URL = "https://dapi.kakao.com/v2/local/search/address.json";
const OUTPUT_PATH = path.join(__dirname, "..", "lib", "restrooms.js");

// API 스펙에서 확정된 주소 필드. 순서: [지번주소, 도로명주소].
const ADDR_FIELDS = ["LCTN_LOTNO_ADDR", "LCTN_ROAD_NM_ADDR"];

// area(짧은 지역명) → 실제 행정구역명. 화장실 주소에 이 전체 명칭이 포함된
// 항목만 후보로 남긴다 — "속초"만으로 필터링하면 홍천군 "속초리" 같은
// 무관한 지역이 오탐되는 문제(2단계 이전 버전에서 실제로 발생)를 막기 위함.
const AREA_ADMIN_NAMES = {
  고성: "고성군",
  속초: "속초시",
  양양: "양양군",
  강릉: "강릉시",
  동해: "동해시",
  삼척: "삼척시",
  울진: "울진군",
};

const MAX_CANDIDATES_PER_POINT = 3;
// 가장 가까운 후보의 거리 + 이 값(km) 이내에 다른 후보가 있으면 2번째 후보로도 채택한다.
const NEARBY_THRESHOLD_KM = 0.5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(serviceKey, pageNo, numOfRows, extraParams) {
  const params = new URLSearchParams({
    serviceKey,
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    returnType: "json",
    ...(extraParams || {}),
  });
  return `${API_BASE}?${params.toString()}`;
}

function locateItems(json) {
  const item = json?.response?.body?.items?.item ?? json?.body?.items?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

function locateTotalCount(json) {
  const value = json?.response?.body?.totalCount ?? json?.body?.totalCount;
  if (value === undefined || value === null) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

async function fetchPage(serviceKey, pageNo, numOfRows, extraParams) {
  const url = buildUrl(serviceKey, pageNo, numOfRows, extraParams);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`JSON 파싱 실패: ${err.message} / 본문: ${text.slice(0, 300)}`);
  }
  return { items: locateItems(json), totalCount: locateTotalCount(json) };
}

/** 주소 필드 중 하나라도 keyword를 포함하면 true. */
function addrMatches(item, keyword) {
  return ADDR_FIELDS.some((field) => {
    const value = item[field];
    return typeof value === "string" && value.includes(keyword);
  });
}

/**
 * 지역 필터 쿼리 파라미터가 실제로 존재하는지 후보 이름들을 하나씩 테스트한다.
 * totalCount가 기준값(전체 건수)보다 뚜렷하게 줄어들면 그 파라미터가 동작하는
 * 것으로 판단한다. 동작하는 파라미터가 없으면 null을 반환한다.
 */
async function detectRegionParam(serviceKey, baselineTotal) {
  const candidates = [
    "signguNm",
    "sigunguNm",
    "ctprvnNm",
    "sidoNm",
    "addr",
    "keyword",
    "searchWrd",
    "searchKeyword",
  ];
  const testValue = AREA_ADMIN_NAMES["강릉"];
  console.log(`\n[find-restrooms] 지역 필터 파라미터 재확인 시도 (기준 totalCount=${baselineTotal})`);
  for (const paramName of candidates) {
    try {
      const { totalCount } = await fetchPage(serviceKey, 1, 1, { [paramName]: testValue });
      const worked = typeof totalCount === "number" && totalCount > 0 && totalCount < baselineTotal;
      console.log(
        `  - ${paramName}=${testValue} → totalCount=${totalCount} ${worked ? "✅ 필터 동작 추정" : "(변화 없음/무시됨)"}`
      );
      if (worked) return paramName;
    } catch (err) {
      console.log(`  - ${paramName}=${testValue} → 요청 실패: ${err.message}`);
    }
    await sleep(200);
  }
  console.log(
    "[find-restrooms] 동작하는 지역 필터 파라미터를 찾지 못함 → 전체 페이지네이션 + 클라이언트 필터로 전환"
  );
  return null;
}

async function collectByRegionParam(serviceKey, paramName, areaNames) {
  const byArea = new Map();
  for (const area of areaNames) {
    const adminName = AREA_ADMIN_NAMES[area] || area;
    try {
      const { items } = await fetchPage(serviceKey, 1, 100, { [paramName]: adminName });
      byArea.set(area, items);
      console.log(`[find-restrooms] ${area}: ${paramName}=${adminName} → ${items.length}건`);
    } catch (err) {
      console.error(`[find-restrooms] ${area} 조회 실패:`, err.message);
      byArea.set(area, []);
    }
    await sleep(200);
  }
  return byArea;
}

/**
 * 전체 페이지네이션 + 클라이언트 필터. 반드시 area의 "행정구역 전체 명칭"
 * (예: 속초시)이 주소에 포함된 항목만 후보로 남긴다 — 짧은 지역명("속초")만
 * 보면 무관한 동명 지역(홍천군 속초리 등)이 섞여 들어가기 때문이다.
 */
async function collectByFullScan(serviceKey, areaNames, totalCount) {
  const byArea = new Map(areaNames.map((area) => [area, []]));
  const numOfRows = 1000;
  const totalPages = Math.ceil(totalCount / numOfRows);
  console.log(`\n[find-restrooms] 전체 페이지네이션 시작 (numOfRows=${numOfRows}, 예상 ${totalPages}페이지)`);
  console.log(
    `[find-restrooms] 행정구역명 필터: ${areaNames.map((a) => `${a}→${AREA_ADMIN_NAMES[a] || a}`).join(", ")}`
  );

  for (let pageNo = 1; pageNo <= totalPages; pageNo += 1) {
    const { items } = await fetchPage(serviceKey, pageNo, numOfRows);
    for (const item of items) {
      for (const area of areaNames) {
        const adminName = AREA_ADMIN_NAMES[area] || area;
        if (addrMatches(item, adminName)) {
          byArea.get(area).push(item);
        }
      }
    }
    if (pageNo % 5 === 0 || pageNo === totalPages) {
      const matched = areaNames.reduce((sum, a) => sum + byArea.get(a).length, 0);
      console.log(`[find-restrooms] 진행 ${pageNo}/${totalPages}페이지, 누적 매칭 ${matched}건`);
    }
    await sleep(150);
  }
  return byArea;
}

/** 포인트 이름에서 지역명 접두어와 흔한 접미어(해수욕장/해변)를 제거해 핵심 키워드를 얻는다. */
function coreKeyword(point) {
  const withoutArea = point.name.replace(new RegExp("^" + point.area + "\\s*"), "").trim();
  const withoutSuffix = withoutArea.replace(/(해수욕장|해변)$/, "").trim();
  return withoutSuffix || point.area;
}

/**
 * 포인트별 지오코딩 대상 후보를 고른다.
 * - 핵심어가 변별력 있고(지역명과 다름) 매칭이 1건 이상이면: 그 매칭 결과 중
 *   최대 MAX_CANDIDATES_PER_POINT건만 지오코딩한다 (mode: "keyword" — 기존
 *   방식 그대로, 이미 정상 동작하는 포인트의 결과에 영향 없음).
 * - 핵심어가 지역명과 동일해 변별력이 없거나 매칭이 0건이면: "앞에서부터
 *   몇 건"을 임의로 뽑지 않고, 행정구역 필터를 통과한 후보 전체를 그대로
 *   돌려준다 (mode: "full") — 호출부에서 전체를 지오코딩하고 거리순 정렬
 *   후 상위 몇 건을 고른다.
 */
function pickCandidatesForPoint(point, areaCandidates) {
  const keyword = coreKeyword(point);
  const isDegenerateKeyword = keyword === point.area; // 핵심어가 지역명 자체와 같으면 변별력 없음
  const keywordMatches = isDegenerateKeyword
    ? []
    : areaCandidates.filter((item) =>
        Object.values(item).some((v) => typeof v === "string" && v.includes(keyword))
      );
  if (keywordMatches.length > 0) {
    return {
      mode: "keyword",
      candidates: keywordMatches.slice(0, MAX_CANDIDATES_PER_POINT),
      matchedBy: `핵심어 "${keyword}" (지역 내 ${keywordMatches.length}건 중 최대 ${MAX_CANDIDATES_PER_POINT}건)`,
    };
  }
  const reason = isDegenerateKeyword
    ? `핵심어 "${keyword}"가 지역명과 동일해 변별력 없음`
    : `핵심어 "${keyword}" 매칭 0건`;
  return {
    mode: "full",
    candidates: areaCandidates,
    matchedBy: `${reason} → ${AREA_ADMIN_NAMES[point.area] || point.area} 전체 후보 ${areaCandidates.length}건 전부 지오코딩 후 거리순 상위 ${MAX_CANDIDATES_PER_POINT}건 선택`,
  };
}

/** candidateKeys 중 item에 실제로 존재하는(빈 문자열이 아닌) 첫 번째 값을 반환한다. */
function guessField(item, candidateKeys) {
  for (const key of candidateKeys) {
    const value = item[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

/** Haversine 공식으로 두 좌표 간 거리(km)를 계산한다. Ocean_insightV3의
 * calculateStationDistanceV2와 동일한 공식(지구 반지름 6371km). */
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function kakaoGeocode(kakaoKey, address) {
  if (!address) return null;
  const url = `${KAKAO_GEOCODE_URL}?query=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${kakaoKey}` } });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`JSON 파싱 실패: ${err.message}`);
  }
  const doc = json?.documents?.[0];
  if (!doc) return null;
  const lat = Number(doc.y);
  const lon = Number(doc.x);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon };
}

/** 도로명주소로 먼저 시도하고, 없거나 실패하면 지번주소로 재시도한다. */
async function geocodeCandidateAddress(kakaoKey, item) {
  const lotAddr = item[ADDR_FIELDS[0]];
  const roadAddr = item[ADDR_FIELDS[1]];

  if (roadAddr) {
    try {
      const result = await kakaoGeocode(kakaoKey, roadAddr);
      if (result) return { ...result, usedAddr: roadAddr, usedField: "roadAddr" };
    } catch (err) {
      console.log(`        (도로명주소 지오코딩 실패: ${err.message})`);
    }
  }
  if (lotAddr) {
    try {
      const result = await kakaoGeocode(kakaoKey, lotAddr);
      if (result) return { ...result, usedAddr: lotAddr, usedField: "lotAddr" };
    } catch (err) {
      console.log(`        (지번주소 지오코딩 실패: ${err.message})`);
    }
  }
  return null;
}

/** 후보들을 지오코딩해서 point와의 거리를 계산하고, 가까운 순으로 정렬한다
 * (지오코딩 실패로 거리를 못 구한 항목은 뒤로 보낸다). candidates가 많을 때만
 * (핵심어 변별력이 없어 지역 전체를 지오코딩하는 경우) 진행 상황을 주기적으로
 * 로그로 남긴다 — 기존처럼 소수(핵심어 매칭 최대 3건)만 지오코딩하는 경우엔
 * 로그가 늘어나지 않아 기존 18개 포인트의 출력이 그대로 유지된다. */
async function enrichCandidatesWithDistance(kakaoKey, point, candidates) {
  const total = candidates.length;
  const logProgress = total > 10;
  const enriched = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const item = candidates[i];
    const geocode = await geocodeCandidateAddress(kakaoKey, item);
    const distanceKm = geocode ? haversineKm(point.lat, point.lon, geocode.lat, geocode.lon) : null;
    enriched.push({ item, geocode, distanceKm });
    if (logProgress && ((i + 1) % 25 === 0 || i + 1 === total)) {
      console.log(`      지오코딩 진행 ${i + 1}/${total}`);
    }
    await sleep(150);
  }
  enriched.sort((a, b) => {
    if (a.distanceKm === null && b.distanceKm === null) return 0;
    if (a.distanceKm === null) return 1;
    if (b.distanceKm === null) return -1;
    return a.distanceKm - b.distanceKm;
  });
  return enriched;
}

function printEnrichedCandidate(entry, idx) {
  const name = guessField(entry.item, ["RSTRM_NM"]) || "(이름 없음)";
  const addr = entry.geocode
    ? entry.geocode.usedAddr
    : entry.item[ADDR_FIELDS[1]] || entry.item[ADDR_FIELDS[0]] || "(주소 없음)";
  const distText = entry.distanceKm === null ? "거리 확인 불가 (지오코딩 실패)" : `${entry.distanceKm.toFixed(2)}km`;
  console.log(`    [${idx + 1}] ${name} / ${addr} / ${distText}`);
}

/**
 * 화장실 항목 하나를 lib/restrooms.js 엔트리 형태로 매핑한다.
 * 필드명은 실제 API 응답으로 확인된 값이다: RSTRM_NM(화장실명),
 * OPN_HR/OPN_HR_DTL(개방시간, "상시" 또는 "정시"+세부시간),
 * EMRGNCBLL_INSTL_YN(비상벨 설치 여부, Y/N).
 * API 자체는 좌표를 제공하지 않지만, 지오코딩 단계(카카오 주소 검색)에서 이미
 * 얻은 좌표(geocode.lat/lon)를 프런트엔드 지도 표시용으로 함께 저장한다.
 */
function mapToRestroomEntry(item, distanceKm, geocode) {
  const name = guessField(item, ["RSTRM_NM"]);
  const openHourType = item.OPN_HR ?? null;
  const openHourDetail = item.OPN_HR_DTL ?? "";
  const openHours = openHourType ? (openHourDetail ? `${openHourType} (${openHourDetail})` : openHourType) : null;
  const emergencyBellRaw = item.EMRGNCBLL_INSTL_YN ?? null;
  return {
    name,
    roadAddr: item[ADDR_FIELDS[1]] ?? null,
    lotAddr: item[ADDR_FIELDS[0]] ?? null,
    openHours,
    hasEmergencyBell: emergencyBellRaw === null ? null : /^y/i.test(String(emergencyBellRaw)),
    distanceKm: distanceKm === null || distanceKm === undefined ? null : Number(distanceKm.toFixed(2)),
    lat: geocode ? geocode.lat : null,
    lon: geocode ? geocode.lon : null,
  };
}

/**
 * 이름+주소가 완전히 같은 중복 레코드를 제거한다(행정안전부 원본 데이터셋에
 * 동일 화장실이 중복 등록된 경우가 실제로 있다 — 예: 속초해변(남문)). 거리순
 * 정렬은 이미 끝난 뒤이므로 먼저 나온(더 가까운) 항목을 남긴다.
 */
function dedupeEnriched(enriched) {
  const seen = new Set();
  const result = [];
  for (const entry of enriched) {
    const name = guessField(entry.item, ["RSTRM_NM"]) || "";
    const addr = entry.item[ADDR_FIELDS[1]] || entry.item[ADDR_FIELDS[0]] || "";
    const key = `${name}|${addr}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

/**
 * 거리순으로 정렬된 enriched 후보 목록에서 최종 저장할 항목(최대 2건)을 고른다.
 * 1순위는 항상 가장 가까운 후보. 2순위는 1순위 거리 + NEARBY_THRESHOLD_KM 이내에
 * 있는 다음으로 가까운 후보가 있을 때만 포함한다(없으면 1건짜리 배열).
 */
function pickFinalEntries(enriched) {
  if (!enriched.length) return [];
  const nearest = enriched[0];
  const result = [nearest];
  if (nearest.distanceKm !== null && enriched.length > 1) {
    const second = enriched[1];
    if (second.distanceKm !== null && second.distanceKm - nearest.distanceKm <= NEARBY_THRESHOLD_KM) {
      result.push(second);
    }
  }
  return result;
}

function writeRestroomsFile(pointEntries) {
  const lines = [];
  lines.push("// TODO: 자동 매칭 결과 (사람 검토/확정 전).");
  lines.push("// scripts/find-restrooms.js가 행정안전부 공중화장실정보 API 응답을 행정구역명+");
  lines.push("// 이름 키워드로 1차 필터링한 뒤, 카카오 주소 검색 API로 지오코딩해서 포인트와의");
  lines.push("// 실제 거리(distanceKm) 기준으로 가장 가까운 후보를 배열 1번째로 채운 임시 결과다.");
  lines.push("// 가장 가까운 후보의 거리 + " + NEARBY_THRESHOLD_KM + "km 이내에 다른 후보가 있으면");
  lines.push("// 배열 2번째로 함께 채워진다(없으면 배열 길이 1). 각 포인트마다 콘솔에 출력된");
  lines.push("// 후보(최대 3건, 거리 포함)를 사람이 직접 검토해서 최종 화장실을 확정한 뒤");
  lines.push("// 이 파일을 다시 채워야 한다.");
  lines.push("// API 자체는 좌표를 제공하지 않지만, 지오코딩(카카오 주소 검색) 단계에서 얻은");
  lines.push("// 좌표(lat/lon)를 프런트엔드 지도 표시용으로 함께 저장했다.");
  lines.push("");
  lines.push("const RESTROOMS = {");
  Object.entries(pointEntries).forEach(([pointId, entries]) => {
    if (!entries || !entries.length) {
      lines.push(`  ${pointId}: [],`);
      return;
    }
    lines.push(`  ${pointId}: [`);
    entries.forEach((entry) => {
      lines.push("    {");
      lines.push(`      name: ${JSON.stringify(entry.name)},`);
      lines.push(`      roadAddr: ${JSON.stringify(entry.roadAddr)},`);
      lines.push(`      lotAddr: ${JSON.stringify(entry.lotAddr)},`);
      lines.push(`      openHours: ${JSON.stringify(entry.openHours)},`);
      lines.push(`      hasEmergencyBell: ${JSON.stringify(entry.hasEmergencyBell)},`);
      lines.push(`      distanceKm: ${JSON.stringify(entry.distanceKm)},`);
      lines.push(`      lat: ${JSON.stringify(entry.lat)},`);
      lines.push(`      lon: ${JSON.stringify(entry.lon)},`);
      lines.push("    },");
    });
    lines.push("  ],");
  });
  lines.push("};");
  lines.push("");
  lines.push("module.exports = { RESTROOMS };");
  lines.push("");

  fs.writeFileSync(OUTPUT_PATH, lines.join("\n"));
  console.log(`\n[find-restrooms] 임시 결과를 ${OUTPUT_PATH}에 저장했습니다 (사람 확인 필요).`);
}

async function findRestrooms() {
  const serviceKey = process.env.PUBLIC_DATA_SERVICE_KEY;
  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (!serviceKey) {
    console.error("[find-restrooms] PUBLIC_DATA_SERVICE_KEY 환경변수가 설정되지 않았습니다.");
    process.exitCode = 1;
    return;
  }
  if (!kakaoKey) {
    console.error("[find-restrooms] KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.");
    process.exitCode = 1;
    return;
  }

  const points = getAllPoints();
  const areaNames = [...new Set(points.map((p) => p.area))];

  let baseline;
  try {
    baseline = await fetchPage(serviceKey, 1, 1);
  } catch (err) {
    console.error("[find-restrooms] 기준 요청 실패:", err.message);
    process.exitCode = 1;
    return;
  }
  if (!baseline.totalCount) {
    console.error("[find-restrooms] totalCount를 확인하지 못했습니다. 원본 응답 구조를 확인하세요.");
    process.exitCode = 1;
    return;
  }
  console.log(`[find-restrooms] 전체 totalCount=${baseline.totalCount}`);

  const regionParam = await detectRegionParam(serviceKey, baseline.totalCount);

  const byArea = regionParam
    ? await collectByRegionParam(serviceKey, regionParam, areaNames)
    : await collectByFullScan(serviceKey, areaNames, baseline.totalCount);

  console.log("\n========================================");
  console.log("포인트별 화장실 후보 (거리순, 사람 검토 필요)");
  console.log("========================================");

  const pointEntries = {};

  for (const point of points) {
    const areaCandidates = byArea.get(point.area) || [];
    console.log(`\n▶ ${point.id} (${point.name})`);
    if (areaCandidates.length === 0) {
      console.log(`    후보 없음 (${AREA_ADMIN_NAMES[point.area] || point.area} 화장실 데이터 없음)`);
      pointEntries[point.id] = [];
      continue;
    }

    const { mode, candidates, matchedBy } = pickCandidatesForPoint(point, areaCandidates);
    if (candidates.length === 0) {
      console.log("    후보 없음");
      pointEntries[point.id] = [];
      continue;
    }
    console.log(`    매칭 방식: ${matchedBy}`);

    // mode "full": 핵심어로 좁히지 못해 지역 전체 후보를 전부 지오코딩한 뒤
    // 거리순 정렬해서 상위 몇 건만 남긴다 (임의로 앞 몇 건만 뽑지 않는다).
    const enrichedAll = await enrichCandidatesWithDistance(kakaoKey, point, candidates);
    const enrichedSliced = mode === "full" ? enrichedAll.slice(0, MAX_CANDIDATES_PER_POINT) : enrichedAll;
    const enriched = dedupeEnriched(enrichedSliced);
    enriched.forEach(printEnrichedCandidate);

    const finalPicks = pickFinalEntries(enriched);
    if (finalPicks.length > 1) {
      console.log(
        `    → 2순위 후보도 1순위 거리 + ${NEARBY_THRESHOLD_KM}km 이내라 함께 채택 (배열 2건)`
      );
    }
    pointEntries[point.id] = finalPicks.map((entry) =>
      mapToRestroomEntry(entry.item, entry.distanceKm, entry.geocode)
    );
  }

  writeRestroomsFile(pointEntries);
}

if (require.main === module) {
  findRestrooms();
}

module.exports = { findRestrooms };
