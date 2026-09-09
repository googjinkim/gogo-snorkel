// 1회성 조사 스크립트: 동해안 7개 시군(고성/속초/양양/강릉/동해/삼척/울진) 내에서
// 이름 또는 주소에 "해수욕장"/"해변"이 포함된 모든 화장실을 찾아 해변 단위로
// 그룹핑하고, 그룹별 화장실 후보(최대 2건)를 lib/beachRestrooms.js에 저장한다.
//
// scripts/find-restrooms.js(기존 20개 스노클링 포인트 전용 조사 스크립트)와는
// 완전히 별개의 파일이다 — find-restrooms.js/lib/restrooms.js는 이 스크립트가
// 건드리지 않는다. 페이지네이션/행정구역 필터/지오코딩 로직은 그 스크립트와
// 같은 방식을 재사용하되, 이 파일 안에 독립적으로 구현했다.
//
// 이 스크립트는 GitHub Actions 워크플로에 포함하지 않는다 (1회성 조사 도구).
//
// 주의: PUBLIC_DATA_SERVICE_KEY / KAKAO_REST_API_KEY는 코드에 절대
// 하드코딩하지 않는다.
// 로컬 실행: `PUBLIC_DATA_SERVICE_KEY=xxx KAKAO_REST_API_KEY=yyy node scripts/find-all-beach-restrooms.js`
//
// 결과는 자동 그룹핑 + 지오코딩 거리 기준일 뿐이므로, lib/beachRestrooms.js를
// 실제로 쓰기 전에 사람이 콘솔 출력(지역별 요약, 미분류 목록)을 보고 검토해야 한다.

const fs = require("fs");
const path = require("path");

const API_BASE = "https://apis.data.go.kr/1741000/public_restroom_info_v2/info_v2";
const KAKAO_GEOCODE_URL = "https://dapi.kakao.com/v2/local/search/address.json";
const OUTPUT_PATH = path.join(__dirname, "..", "lib", "beachRestrooms.js");

// API 스펙에서 확정된 주소 필드. 순서: [지번주소, 도로명주소].
const ADDR_FIELDS = ["LCTN_LOTNO_ADDR", "LCTN_ROAD_NM_ADDR"];

// area(짧은 지역명) → 실제 행정구역명. 화장실 주소에 이 전체 명칭이 포함된
// 항목만 후보로 남긴다 — 짧은 지역명만 보면 무관한 동명 지역이 섞여 들어간다
// (find-restrooms.js에서 실제로 겪은 문제와 동일한 이유).
const AREA_ADMIN_NAMES = {
  고성: "고성군",
  속초: "속초시",
  양양: "양양군",
  강릉: "강릉시",
  동해: "동해시",
  삼척: "삼척시",
  울진: "울진군",
};
const AREA_ORDER = ["고성", "속초", "양양", "강릉", "동해", "삼척", "울진"];

const BEACH_KEYWORDS = ["해수욕장", "해변"];
// 그룹 내 1순위 후보의 거리 + 이 값(km) 이내에 다른 후보가 있으면 2번째 후보로도 채택한다.
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

async function fetchPage(serviceKey, pageNo, numOfRows) {
  const url = buildUrl(serviceKey, pageNo, numOfRows);
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
 * 전체 페이지네이션 + 클라이언트 필터로 7개 행정구역별 전체 화장실 목록을 모은다.
 * (find-restrooms.js의 collectByFullScan과 동일한 방식.)
 */
async function collectAllByArea(serviceKey, totalCount) {
  const byArea = new Map(AREA_ORDER.map((area) => [area, []]));
  const numOfRows = 1000;
  const totalPages = Math.ceil(totalCount / numOfRows);
  console.log(`\n[find-all-beach-restrooms] 전체 페이지네이션 시작 (numOfRows=${numOfRows}, 예상 ${totalPages}페이지)`);
  console.log(
    `[find-all-beach-restrooms] 행정구역명 필터: ${AREA_ORDER.map((a) => `${a}→${AREA_ADMIN_NAMES[a]}`).join(", ")}`
  );

  for (let pageNo = 1; pageNo <= totalPages; pageNo += 1) {
    const { items } = await fetchPage(serviceKey, pageNo, numOfRows);
    for (const item of items) {
      for (const area of AREA_ORDER) {
        if (addrMatches(item, AREA_ADMIN_NAMES[area])) {
          byArea.get(area).push(item);
        }
      }
    }
    if (pageNo % 5 === 0 || pageNo === totalPages) {
      const matched = AREA_ORDER.reduce((sum, a) => sum + byArea.get(a).length, 0);
      console.log(`[find-all-beach-restrooms] 진행 ${pageNo}/${totalPages}페이지, 누적 매칭 ${matched}건`);
    }
    await sleep(150);
  }
  return byArea;
}

function containsBeachKeyword(value) {
  return typeof value === "string" && BEACH_KEYWORDS.some((k) => value.includes(k));
}

/** 이름 또는 도로명/지번 주소 중 하나라도 "해수욕장"/"해변"을 포함하면 true. */
function isBeachItem(item) {
  const name = item.RSTRM_NM || "";
  return containsBeachKeyword(name) || ADDR_FIELDS.some((f) => containsBeachKeyword(item[f] || ""));
}

/** 그룹핑 키로 쓰기 위해, 지명 뒤에 붙은 괄호 주석(예: "(신)", "(남문)")만 제거한다.
 * 숫자가 포함된 리(남애3리 등)는 서로 다른 실제 장소이므로 그대로 둔다. */
function normalizeRoot(raw) {
  return raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/**
 * 화장실명 또는 주소에서 "OO해수욕장"/"OO해변" 패턴의 지명(root)과 실제 표기
 * (suffix: "해수욕장" 또는 "해변")를 추출한다. 이름에서 먼저 시도하고, 이름에
 * 없으면(주소로만 필터를 통과한 경우) 주소의 마지막 어절을 지명으로 본다.
 * 추출 실패(패턴 자체가 없음)면 null.
 *
 * 주소 기반 추출(예: "가진해변길 121-19" → "가진")은 "OO해변로/길"처럼 도로명
 * 표기에서 온 경우가 많아 신뢰도가 낮다 — 실제로 같은 도로 위에 있지만 전혀
 * 다른 지역 시설(예: "공현진(다목적광장)")이 "가진" 그룹에 잘못 섞여 들어간
 * 사례를 확인했다. 이 문제는 그룹핑 단계에서 미리 걸러내는 대신, 그룹 확정
 * 단계(pickFinalForGroup)에서 좌표 기준으로 실제로 가까운 후보만 선택하는
 * 방식으로 처리한다 — 이름이 비슷해도 좌표가 멀면 자동으로 제외되고, 그
 * 사실이 콘솔에 감사(audit) 로그로 남는다(옥계/삼척/속초에서 이미 확인됨).
 */
function extractBeachRoot(item) {
  const name = item.RSTRM_NM || "";
  let m = name.match(/(.+?)(해수욕장|해변)/);
  if (m) {
    const root = normalizeRoot(m[1]);
    if (root) return { root, suffix: m[2], source: "name" };
  }
  for (const field of ADDR_FIELDS) {
    const addr = item[field] || "";
    m = addr.match(/(.+?)(해수욕장|해변)/);
    if (m) {
      const tail = m[1].trim().split(/\s+/).pop() || m[1].trim();
      const root = normalizeRoot(tail);
      if (root) return { root, suffix: m[2], source: "addr" };
    }
  }
  return null;
}

/** 이름+주소가 완전히 같은 중복 레코드를 제거한다(원본 데이터셋에 동일 화장실이
 * 중복 등록된 경우가 실제로 있다 — find-restrooms.js에서도 확인된 문제). */
function dedupeItems(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const name = item.RSTRM_NM || "";
    const addr = item[ADDR_FIELDS[1]] || item[ADDR_FIELDS[0]] || "";
    const key = `${name}|${addr}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

/** Haversine 공식으로 두 좌표 간 거리(km)를 계산한다 (find-restrooms.js와 동일 공식). */
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

/** "강원특별자치도 양양군 현북면 북분리 2-5" → "강원특별자치도 양양군 현북면 북분리"처럼
 * 마지막 상세 번지 토큰을 떼어내고 읍/면/리/동/가 단위까지만 남긴다. 이미 그
 * 단위인 경우(더 뗄 게 없으면) 원본과 동일한 문자열을 반환한다. */
function truncateToDongRi(address) {
  const tokens = address.trim().split(/\s+/);
  while (tokens.length > 1 && !/(리|동|읍|면|가)$/.test(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

/**
 * 도로명주소 → 지번주소 순으로 정확한 주소 그대로 지오코딩을 시도하고, 둘 다
 * 실패하면 각 주소를 읍/면/리 단위까지 축약해서 한 번 더 시도한다(그래도
 * 실패하면 null — 좌표를 억지로 만들지 않는다). 어떤 주소 문자열로 성공했는지,
 * 축약(근사치) 결과인지를 함께 반환해서 나중에 사람이 검토할 수 있게 한다.
 */
async function geocodeItem(kakaoKey, item) {
  const lotAddr = item[ADDR_FIELDS[0]];
  const roadAddr = item[ADDR_FIELDS[1]];
  const attempts = [];
  if (roadAddr) attempts.push({ addr: roadAddr, field: "roadAddr", approximate: false });
  if (lotAddr) attempts.push({ addr: lotAddr, field: "lotAddr", approximate: false });

  for (const attempt of attempts) {
    try {
      const result = await kakaoGeocode(kakaoKey, attempt.addr);
      if (result) return { ...result, usedAddr: attempt.addr, usedField: attempt.field, approximate: false };
    } catch (err) {
      console.log(`        (${attempt.field} 지오코딩 실패: ${err.message})`);
    }
    await sleep(150);
  }

  // 정확한 주소로 둘 다 실패하면, 읍/면/리 단위까지 축약해서 한 번 더 시도한다.
  const truncatedAttempts = [];
  for (const attempt of attempts) {
    const truncated = truncateToDongRi(attempt.addr);
    if (truncated !== attempt.addr && !truncatedAttempts.some((a) => a.addr === truncated)) {
      truncatedAttempts.push({ addr: truncated, field: attempt.field, approximate: true });
    }
  }
  for (const attempt of truncatedAttempts) {
    try {
      const result = await kakaoGeocode(kakaoKey, attempt.addr);
      if (result) {
        console.log(`        (정확한 주소 지오코딩 실패 → 축약 주소 "${attempt.addr}"로 근사 성공)`);
        return { ...result, usedAddr: attempt.addr, usedField: attempt.field, approximate: true };
      }
    } catch (err) {
      console.log(`        (축약 주소 "${attempt.addr}" 지오코딩도 실패: ${err.message})`);
    }
    await sleep(150);
  }
  return null;
}

/** 그룹 내 후보 전체를 지오코딩한다. { item, suffix, source, geocode } 배열을 반환. */
async function geocodeGroup(kakaoKey, groupEntries) {
  const results = [];
  for (const entry of groupEntries) {
    const geocode = await geocodeItem(kakaoKey, entry.item);
    results.push({ ...entry, geocode });
    await sleep(150);
  }
  return results;
}

/** 지오코딩된 후보들 중 가장 먼 두 점 사이의 거리(km). 좌표 없는 항목은 무시. */
function maxPairwiseDistanceKm(geocoded) {
  let max = 0;
  for (let i = 0; i < geocoded.length; i += 1) {
    for (let j = i + 1; j < geocoded.length; j += 1) {
      const a = geocoded[i].geocode;
      const b = geocoded[j].geocode;
      if (!a || !b) continue;
      const d = haversineKm(a.lat, a.lon, b.lat, b.lon);
      if (d > max) max = d;
    }
  }
  return max;
}

/**
 * 원본 API 필드(OPN_HR/OPN_HR_DTL)를 표시용 문자열로 가공한다. build-score.js의
 * formatOpenHours와 동일한 규칙: 상시→"24시간 운영", 정시+세부시간 있음→
 * 세부시간 그대로, 그 외(정시인데 세부시간 없음, 그 밖의 값 등)→null.
 */
function formatOpenHours(item) {
  const type = item.OPN_HR ?? null;
  const detail = item.OPN_HR_DTL ?? null;
  if (type === "상시") return "24시간 운영";
  if (type === "정시" && detail && String(detail).trim()) return detail;
  return null;
}

function avg(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function toRestroomEntry(entry, distanceKm) {
  const item = entry.item;
  return {
    name: item.RSTRM_NM || null,
    roadAddr: item[ADDR_FIELDS[1]] || null,
    lotAddr: item[ADDR_FIELDS[0]] || null,
    openHours: formatOpenHours(item),
    distanceKm: distanceKm === null || distanceKm === undefined ? null : Number(distanceKm.toFixed(2)),
  };
}

/**
 * 그룹 내 후보 중 최종 후보(최대 2건)를 고른다. 이 스크립트는 특정 스노클링
 * 포인트 좌표 같은 외부 기준점이 없으므로, 그룹 중심(centroid)에 가장 가까운
 * 후보를 1순위로 삼고, 1순위로부터 0.5km 이내에 있는 후보가 있으면 2순위로
 * 추가한다. 1순위는 비교 기준점 자체라 distanceKm이 null이고, 2순위의
 * distanceKm은 1순위로부터의 거리다. 같은 지명으로 묶였지만 실제로는 0.5km
 * 밖에 있어 선택되지 않은 나머지 후보는 excluded로 함께 반환한다(예: "옥계"
 * 그룹에서 지명은 같지만 실제로는 다른 위치인 항목이 자동으로 제외된다) —
 * 호출부에서 참고용으로 로그만 남기고, 그룹 자체를 무효화하지는 않는다.
 */
function pickFinalForGroup(geocodedEntries) {
  const centroidLat = avg(geocodedEntries.map((g) => g.geocode.lat));
  const centroidLon = avg(geocodedEntries.map((g) => g.geocode.lon));

  const byCentroidDist = geocodedEntries
    .map((g) => ({ ...g, centroidDist: haversineKm(centroidLat, centroidLon, g.geocode.lat, g.geocode.lon) }))
    .sort((a, b) => a.centroidDist - b.centroidDist);

  const first = byCentroidDist[0];
  const rest = byCentroidDist.slice(1);

  let second = null;
  let excluded = rest;
  if (rest.length) {
    const byDistToFirst = rest
      .map((g) => ({ ...g, distToFirst: haversineKm(first.geocode.lat, first.geocode.lon, g.geocode.lat, g.geocode.lon) }))
      .sort((a, b) => a.distToFirst - b.distToFirst);
    if (byDistToFirst[0].distToFirst <= NEARBY_THRESHOLD_KM) {
      second = byDistToFirst[0];
      excluded = byDistToFirst.slice(1);
    } else {
      excluded = byDistToFirst;
    }
  }

  const restrooms = [toRestroomEntry(first, null)];
  if (second) restrooms.push(toRestroomEntry(second, second.distToFirst));
  return { restrooms, excluded };
}

function pickBeachName(root, groupEntries) {
  const hasWaterPark = groupEntries.some((g) => g.suffix === "해수욕장");
  return root + (hasWaterPark ? "해수욕장" : "해변");
}

function writeBeachRestroomsFile(byAreaResult) {
  const lines = [];
  lines.push("// TODO: 자동 조사 결과 (사람 검토/확정 전).");
  lines.push("// scripts/find-all-beach-restrooms.js가 행정안전부 공중화장실정보 API에서");
  lines.push("// 동해안 7개 시군 내 이름/주소에 \"해수욕장\" 또는 \"해변\"이 포함된 화장실을");
  lines.push("// 전부 찾아 지명 기준으로 그룹핑하고, 카카오 주소 검색으로 지오코딩해서");
  lines.push("// 그룹별 화장실 후보(최대 2건)를 채운 결과다. 그룹핑이 애매했던 항목은");
  lines.push("// 이 파일에 포함되지 않고 스크립트 실행 시 콘솔에 \"미분류\"로만 출력된다.");
  lines.push("// 실제로 쓰기 전에 콘솔 출력(지역별 요약, 미분류 목록)을 사람이 검토해야 한다.");
  lines.push("");
  lines.push("const BEACH_RESTROOMS = {");
  AREA_ORDER.forEach((area) => {
    const beaches = byAreaResult.get(area) || [];
    lines.push(`  ${area}: [`);
    beaches.forEach((beach) => {
      lines.push("    {");
      lines.push(`      beachName: ${JSON.stringify(beach.beachName)},`);
      lines.push(`      area: ${JSON.stringify(beach.area)},`);
      lines.push("      restrooms: [");
      beach.restrooms.forEach((r) => {
        lines.push("        {");
        lines.push(`          name: ${JSON.stringify(r.name)},`);
        lines.push(`          roadAddr: ${JSON.stringify(r.roadAddr)},`);
        lines.push(`          lotAddr: ${JSON.stringify(r.lotAddr)},`);
        lines.push(`          openHours: ${JSON.stringify(r.openHours)},`);
        lines.push(`          distanceKm: ${JSON.stringify(r.distanceKm)},`);
        lines.push("        },");
      });
      lines.push("      ],");
      lines.push("    },");
    });
    lines.push("  ],");
  });
  lines.push("};");
  lines.push("");
  lines.push("module.exports = { BEACH_RESTROOMS };");
  lines.push("");

  fs.writeFileSync(OUTPUT_PATH, lines.join("\n"));
  console.log(`\n[find-all-beach-restrooms] 결과를 ${OUTPUT_PATH}에 저장했습니다 (사람 확인 필요).`);
}

async function findAllBeachRestrooms() {
  const serviceKey = process.env.PUBLIC_DATA_SERVICE_KEY;
  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (!serviceKey) {
    console.error("[find-all-beach-restrooms] PUBLIC_DATA_SERVICE_KEY 환경변수가 설정되지 않았습니다.");
    process.exitCode = 1;
    return;
  }
  if (!kakaoKey) {
    console.error("[find-all-beach-restrooms] KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.");
    process.exitCode = 1;
    return;
  }

  let baseline;
  try {
    baseline = await fetchPage(serviceKey, 1, 1);
  } catch (err) {
    console.error("[find-all-beach-restrooms] 기준 요청 실패:", err.message);
    process.exitCode = 1;
    return;
  }
  if (!baseline.totalCount) {
    console.error("[find-all-beach-restrooms] totalCount를 확인하지 못했습니다.");
    process.exitCode = 1;
    return;
  }
  console.log(`[find-all-beach-restrooms] 전체 totalCount=${baseline.totalCount}`);

  const byArea = await collectAllByArea(serviceKey, baseline.totalCount);

  console.log("\n========================================");
  console.log("지역별 해변 화장실 그룹핑 결과");
  console.log("========================================");

  const byAreaResult = new Map(AREA_ORDER.map((area) => [area, []]));
  const unclassified = [];
  let totalBeaches = 0;
  let totalRestrooms = 0;

  for (const area of AREA_ORDER) {
    const areaItems = byArea.get(area) || [];
    const beachItems = areaItems.filter(isBeachItem);
    console.log(`\n▶ ${area} (${AREA_ADMIN_NAMES[area]}) — 전체 ${areaItems.length}건 중 해변 관련 ${beachItems.length}건`);

    const groups = new Map(); // root -> [{item, suffix, source}]
    let extractFailCount = 0;
    for (const item of beachItems) {
      const extracted = extractBeachRoot(item);
      if (!extracted) {
        extractFailCount += 1;
        continue;
      }
      if (!groups.has(extracted.root)) groups.set(extracted.root, []);
      groups.get(extracted.root).push({ item, suffix: extracted.suffix, source: extracted.source });
    }
    if (extractFailCount > 0) {
      console.log(`    (지명 추출 실패로 제외된 항목 ${extractFailCount}건)`);
    }

    for (const [root, groupEntries] of groups.entries()) {
      const dedupedItems = dedupeItems(groupEntries.map((g) => g.item));
      const dedupedEntries = dedupedItems.map((item) => groupEntries.find((g) => g.item === item));

      const geocoded = await geocodeGroup(kakaoKey, dedupedEntries);
      const successful = geocoded.filter((g) => g.geocode);

      if (successful.length === 0) {
        // 정확한 주소 + 읍/면/리 축약 주소까지 전부 실패한 경우. 좌표를 억지로
        // 만들지 않고, 거리 검증 없이 원래 순서 그대로(최대 2건) 포함시킨다 —
        // 카드에는 이름/주소만 표시되고 지도는 없는 상태로 남는다.
        const kept = dedupedEntries.slice(0, 2);
        byAreaResult.get(area).push({
          beachName: pickBeachName(root, groupEntries),
          area,
          restrooms: kept.map((e) => toRestroomEntry(e, null)),
        });
        totalBeaches += 1;
        totalRestrooms += kept.length;
        console.log(
          `    △ ${pickBeachName(root, groupEntries)}: 좌표 확보 불가(정확한 주소·축약 주소 모두 지오코딩 실패) — 거리 검증 없이 ${kept.length}건 그대로 포함`
        );
        dedupedEntries.forEach((e) =>
          console.log(`        - ${e.item.RSTRM_NM} / 도로명:${e.item[ADDR_FIELDS[1]] || "(없음)"} / 지번:${e.item[ADDR_FIELDS[0]] || "(없음)"}`)
        );
        continue;
      }

      const span = maxPairwiseDistanceKm(successful);
      const { restrooms, excluded } = pickFinalForGroup(successful);
      const beachName = pickBeachName(root, groupEntries);
      byAreaResult.get(area).push({ beachName, area, restrooms });
      totalBeaches += 1;
      totalRestrooms += restrooms.length;
      console.log(
        `    ✓ ${beachName}: ${restrooms.length}건 (${restrooms.map((r) => r.name).join(", ")})`
      );
      // 그룹 전체의 좌표 분산이 컸다면(같은 지명으로 묶였지만 실제로는 멀리
      // 떨어진 후보가 섞여 있었다면), 어떤 후보가 최종 선택에서 자동으로
      // 제외됐는지 감사(audit) 목적으로만 남긴다 — 그룹 자체는 그대로 채택.
      if (span > NEARBY_THRESHOLD_KM && excluded.length) {
        console.log(
          `      (참고: 그룹 내 좌표 분산 ${span.toFixed(2)}km — 0.5km 밖이라 최종 선택에서 제외된 후보: ` +
            excluded.map((e) => `${e.item.RSTRM_NM}(${e.distToFirst !== undefined ? e.distToFirst.toFixed(2) + "km" : "?"})`).join(", ") +
            ")"
        );
      }
    }
  }

  console.log("\n========================================");
  console.log("전체 요약");
  console.log("========================================");
  AREA_ORDER.forEach((area) => {
    console.log(`  ${area}: 해변 ${byAreaResult.get(area).length}곳`);
  });
  console.log(`  총 해변 개수: ${totalBeaches}곳`);
  console.log(`  총 화장실 건수: ${totalRestrooms}건`);

  console.log(`\n미분류 항목: ${unclassified.length}건`);
  unclassified.forEach((u, i) => {
    console.log(`  [${i + 1}] ${u.area} / "${u.root}" — ${u.reason}`);
    u.candidates.forEach((c) => console.log(`        - ${c}`));
  });

  writeBeachRestroomsFile(byAreaResult);
}

if (require.main === module) {
  findAllBeachRestrooms();
}

module.exports = { findAllBeachRestrooms };
