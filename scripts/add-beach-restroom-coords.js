// 1회성 보강 스크립트: lib/beachRestrooms.js(73개 해변, 98건)에는 처음부터
// "지도 없음" 화면으로 설계돼서 위도/경도가 저장돼 있지 않다. 이후 이 카드에
// 지도 보기 버튼을 추가하기로 하면서, 이미 확정된 name/roadAddr/lotAddr를
// 그대로 두고 카카오 주소 검색 API로 좌표만 보강한다(공공데이터 API 재호출
// 불필요 — scripts/find-all-beach-restrooms.js와 달리 PUBLIC_DATA_SERVICE_KEY
// 없이 KAKAO_REST_API_KEY만 있으면 된다).
//
// 지오코딩 우선순위/축약 폴백은 find-all-beach-restrooms.js와 동일한 방식
// (도로명 → 지번 → 각각 읍/면/리 단위 축약) 재사용. 축약까지 실패하면
// (예: 양양 북분리) lat/lon을 null로 남겨 지도 버튼 자체가 안 뜨게 한다.
//
// 이 스크립트는 GitHub Actions 워크플로에 포함하지 않는다 (1회성 보강 도구).
// 로컬 실행: `KAKAO_REST_API_KEY=xxx node scripts/add-beach-restroom-coords.js`

const fs = require("fs");
const path = require("path");
const { BEACH_RESTROOMS } = require("../lib/beachRestrooms");

const KAKAO_GEOCODE_URL = "https://dapi.kakao.com/v2/local/search/address.json";
const OUTPUT_PATH = path.join(__dirname, "..", "lib", "beachRestrooms.js");
const AREA_ORDER = ["고성", "속초", "양양", "강릉", "동해", "삼척", "울진"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function truncateToDongRi(address) {
  const tokens = address.trim().split(/\s+/);
  while (tokens.length > 1 && !/(리|동|읍|면|가)$/.test(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

/** roadAddr → lotAddr 순으로 정확한 주소 그대로 시도하고, 둘 다 실패하면
 * 각각을 읍/면/리 단위로 축약해서 한 번 더 시도한다. 그래도 실패하면
 * { lat: null, lon: null }을 반환한다(좌표를 억지로 만들지 않는다). */
async function geocodeRestroom(kakaoKey, restroom) {
  const attempts = [];
  if (restroom.roadAddr) attempts.push(restroom.roadAddr);
  if (restroom.lotAddr) attempts.push(restroom.lotAddr);

  for (const addr of attempts) {
    try {
      const result = await kakaoGeocode(kakaoKey, addr);
      if (result) return result;
    } catch (err) {
      console.log(`      (지오코딩 실패 "${addr}": ${err.message})`);
    }
    await sleep(150);
  }

  const truncatedAttempts = [];
  for (const addr of attempts) {
    const truncated = truncateToDongRi(addr);
    if (truncated !== addr && !truncatedAttempts.includes(truncated)) {
      truncatedAttempts.push(truncated);
    }
  }
  for (const addr of truncatedAttempts) {
    try {
      const result = await kakaoGeocode(kakaoKey, addr);
      if (result) {
        console.log(`      (축약 주소 "${addr}"로 근사 성공)`);
        return result;
      }
    } catch (err) {
      console.log(`      (축약 주소 "${addr}" 지오코딩도 실패: ${err.message})`);
    }
    await sleep(150);
  }

  return { lat: null, lon: null };
}

function writeBeachRestroomsFile(byArea) {
  const lines = [];
  lines.push("// TODO: 자동 조사 결과 (사람 검토/확정 전).");
  lines.push("// scripts/find-all-beach-restrooms.js가 행정안전부 공중화장실정보 API에서");
  lines.push("// 동해안 7개 시군 내 이름/주소에 \"해수욕장\" 또는 \"해변\"이 포함된 화장실을");
  lines.push("// 전부 찾아 지명 기준으로 그룹핑하고, 카카오 주소 검색으로 지오코딩해서");
  lines.push("// 그룹별 화장실 후보(최대 2건)를 채운 결과다. 그룹핑이 애매했던 항목은");
  lines.push("// 이 파일에 포함되지 않고 스크립트 실행 시 콘솔에 \"미분류\"로만 출력된다.");
  lines.push("// 실제로 쓰기 전에 콘솔 출력(지역별 요약, 미분류 목록)을 사람이 검토해야 한다.");
  lines.push("//");
  lines.push("// lat/lon은 scripts/add-beach-restroom-coords.js가 카카오 주소 검색으로");
  lines.push("// 나중에 보강했다(지도 보기 버튼용). 축약 주소로도 지오코딩이 끝내 실패한");
  lines.push("// 항목(예: 양양 북분리)은 lat/lon이 null이고, 프런트엔드는 이 경우 지도");
  lines.push("// 버튼 자체를 표시하지 않는다.");
  lines.push("");
  lines.push("const BEACH_RESTROOMS = {");
  AREA_ORDER.forEach((area) => {
    const beaches = byArea[area] || [];
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
        lines.push(`          lat: ${JSON.stringify(r.lat)},`);
        lines.push(`          lon: ${JSON.stringify(r.lon)},`);
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
  console.log(`\n[add-beach-restroom-coords] 결과를 ${OUTPUT_PATH}에 저장했습니다.`);
}

async function addBeachRestroomCoords() {
  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (!kakaoKey) {
    throw new Error("KAKAO_REST_API_KEY 환경변수가 필요합니다.");
  }

  let total = 0;
  let success = 0;
  let approximateOrFailedNames = [];

  for (const area of AREA_ORDER) {
    const beaches = BEACH_RESTROOMS[area] || [];
    console.log(`\n▶ ${area} — 해변 ${beaches.length}곳`);
    for (const beach of beaches) {
      for (const restroom of beach.restrooms) {
        total += 1;
        const geocode = await geocodeRestroom(kakaoKey, restroom);
        restroom.lat = geocode.lat;
        restroom.lon = geocode.lon;
        if (geocode.lat !== null) {
          success += 1;
          console.log(`    ✓ ${beach.beachName} / ${restroom.name}: ${geocode.lat},${geocode.lon}`);
        } else {
          approximateOrFailedNames.push(`${area} / ${beach.beachName} / ${restroom.name}`);
          console.log(`    ✗ ${beach.beachName} / ${restroom.name}: 좌표 확보 실패 (지도 버튼 없이 표시됨)`);
        }
        await sleep(150);
      }
    }
  }

  console.log("\n========================================");
  console.log(`전체 ${total}건 중 좌표 확보 ${success}건, 실패 ${total - success}건`);
  if (approximateOrFailedNames.length) {
    console.log("좌표 확보 실패 목록:");
    approximateOrFailedNames.forEach((name) => console.log(`  - ${name}`));
  }
  console.log("========================================");

  writeBeachRestroomsFile(BEACH_RESTROOMS);
}

if (require.main === module) {
  addBeachRestroomCoords().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { addBeachRestroomCoords };
