// 1회성 진단 스크립트: 행정안전부_공중화장실정보 조회서비스(v2)의 실제 응답
// 구조(필드명/페이지네이션/지역 필터 파라미터 지원 여부)를 확인한다.
// "자세히 보기 화면 화장실 정보 표시" 기능 구현 전 사전 조사 단계이며,
// 실제 수집/매핑 로직은 이 스크립트에 포함하지 않는다.
//
// 주의: PUBLIC_DATA_SERVICE_KEY는 코드에 절대 하드코딩하지 않는다.
// 로컬 실행 시 `PUBLIC_DATA_SERVICE_KEY=xxx node scripts/audit-restrooms.js`처럼
// 환경변수로 직접 전달한다. 이 스크립트는 결과를 파일로 저장하지 않고
// console.log로만 출력한다.

const API_BASE = "https://apis.data.go.kr/1741000/public_restroom_info_v2";

function buildUrl(serviceKey) {
  const params = new URLSearchParams({
    serviceKey,
    type: "json",
    pageNo: "1",
    numOfRows: "5",
  });
  return `${API_BASE}?${params.toString()}`;
}

/** 문자열 값(직렬화된 JSON)에서 serviceKey 파라미터 값을 가려서 로그에 남지 않게 한다. */
function redactServiceKey(text, serviceKey) {
  return serviceKey ? text.split(serviceKey).join("[REDACTED]") : text;
}

/**
 * response.body.items.item / body.items.item 두 형태를 모두 시도해 어느 경로로
 * 정상 파싱됐는지와 함께 items 배열을 반환한다. 실제 응답 구조를 추측하지 않고
 * 그대로 보고하기 위해, 매칭된 경로 문자열도 함께 돌려준다.
 */
function locateItems(json) {
  const candidates = [
    ["response.body.items.item", json?.response?.body?.items?.item],
    ["body.items.item", json?.body?.items?.item],
  ];
  for (const [path, value] of candidates) {
    if (value !== undefined && value !== null) {
      const items = Array.isArray(value) ? value : [value];
      return { path, items };
    }
  }
  return { path: null, items: [] };
}

function locateTotalCount(json) {
  const candidates = [
    ["response.body.totalCount", json?.response?.body?.totalCount],
    ["body.totalCount", json?.body?.totalCount],
  ];
  for (const [path, value] of candidates) {
    if (value !== undefined && value !== null) return { path, value };
  }
  return { path: null, value: null };
}

async function auditRestrooms() {
  const serviceKey = process.env.PUBLIC_DATA_SERVICE_KEY;
  if (!serviceKey) {
    console.error("[audit-restrooms] PUBLIC_DATA_SERVICE_KEY 환경변수가 설정되지 않았습니다.");
    process.exitCode = 1;
    return;
  }

  const url = buildUrl(serviceKey);
  console.log("[audit-restrooms] 요청 URL:", redactServiceKey(url, serviceKey));

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.error("[audit-restrooms] 요청 실패:", err.message);
    process.exitCode = 1;
    return;
  }

  const rawText = await res.text();

  if (!res.ok) {
    console.error(`[audit-restrooms] HTTP ${res.status} ${res.statusText}`);
    console.error("[audit-restrooms] 원본 응답 본문:");
    console.error(redactServiceKey(rawText, serviceKey));
    process.exitCode = 1;
    return;
  }

  let json;
  try {
    json = JSON.parse(rawText);
  } catch (err) {
    console.error("[audit-restrooms] JSON 파싱 실패:", err.message);
    console.error("[audit-restrooms] 원본 응답 본문 (JSON이 아닐 수 있음):");
    console.error(redactServiceKey(rawText, serviceKey));
    process.exitCode = 1;
    return;
  }

  console.log("\n========== 1) 원본 JSON 전체 ==========");
  console.log(JSON.stringify(json, null, 2));

  console.log("\n========== 2) 최상위 응답 구조 경로 ==========");
  const { path: itemsPath, items } = locateItems(json);
  if (itemsPath) {
    console.log(`items 배열 위치: ${itemsPath}`);
  } else {
    console.log("items 배열을 response.body.items.item / body.items.item 어디에서도 찾지 못했습니다.");
    console.log("실제 응답의 최상위 키:", Object.keys(json));
  }

  console.log("\n========== 3) totalCount (전체 데이터 건수) ==========");
  const { path: totalPath, value: totalValue } = locateTotalCount(json);
  if (totalPath) {
    console.log(`${totalPath} = ${totalValue}`);
  } else {
    console.log("totalCount 필드를 response.body.totalCount / body.totalCount 어디에서도 찾지 못했습니다.");
  }

  console.log("\n========== 4) 화장실 1건의 전체 필드 목록과 값 ==========");
  if (items.length === 0) {
    console.log("반환된 item이 없어 필드를 확인할 수 없습니다.");
  } else {
    const first = items[0];
    console.log(`수신 건수: ${items.length}건. 첫 번째 항목의 필드:`);
    Object.keys(first).forEach((key) => {
      console.log(`  ${key}: ${JSON.stringify(first[key])}`);
    });

    console.log("\n  ↳ 명칭/주소/위도/경도로 추정되는 필드는 위 목록에서 사람이 직접 값을 보고");
    console.log("    확정할 것 (필드명을 코드에서 미리 가정하지 않음).");
  }

  console.log("\n========== 5) 지역 필터 파라미터 지원 여부 ==========");
  console.log("이번 요청에는 지역 필터 파라미터를 전달하지 않았다 (serviceKey/type/pageNo/numOfRows만 전달).");
  if (items.length > 0) {
    const first = items[0];
    const regionLikeKeys = Object.keys(first).filter((k) =>
      /ctprvn|sigungu|emdNm|zip|addr|sido|gugun/i.test(k)
    );
    if (regionLikeKeys.length > 0) {
      console.log("응답 항목에 지역 관련으로 보이는 필드가 존재한다 (필터 파라미터 존재를 보장하지 않음):");
      regionLikeKeys.forEach((k) => console.log(`  ${k}: ${JSON.stringify(first[k])}`));
    } else {
      console.log("응답 항목에서 지역 관련 필드를 자동으로 찾지 못했다.");
    }
  }
  console.log("실제 지역 필터 쿼리 파라미터(예: ctprvnCd 등)의 존재 여부는 이 단일 요청만으로");
  console.log("확정할 수 없으므로, 공공데이터포털 활용가이드 문서를 별도로 확인해야 한다.");
}

if (require.main === module) {
  auditRestrooms();
}

module.exports = { auditRestrooms };
