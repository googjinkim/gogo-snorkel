// 스노클링 지점 정적 메타데이터.
// 점수 계산 로직은 lib/scoring.js 참고.

/**
 * @typedef {object} PointMeta
 * @property {string} id
 * @property {string} area
 * @property {string} name
 * @property {number} lat
 * @property {number} lon
 * @property {string} khoaObsCode KHOA 관측소 코드. 매핑 없으면 빈 문자열.
 * @property {string} khoaStationName KHOA 관측소명. 매핑 없으면 빈 문자열.
 */

/** @type {PointMeta[]} */
const POINTS = [
  { id: "bongpo", area: "고성", name: "고성 봉포", lat: 38.2547009, lon: 128.5628173, khoaObsCode: "TW_0093", khoaStationName: "속초해수욕장" },
  { id: "ayajin", area: "고성", name: "고성 아야진", lat: 38.2767975, lon: 128.5533138, khoaObsCode: "TW_0093", khoaStationName: "속초해수욕장" },
  { id: "sokcho_beach", area: "속초", name: "속초 속초해변", lat: 38.1881315, lon: 128.6056644, khoaObsCode: "TW_0093", khoaStationName: "속초해수욕장" },
  { id: "oeongchi", area: "속초", name: "속초 외옹치", lat: 38.1835380, lon: 128.6090689, khoaObsCode: "TW_0093", khoaStationName: "속초해수욕장" },
  { id: "hajodae", area: "양양", name: "양양 하조대", lat: 38.023, lon: 128.727, khoaObsCode: "TW_0091", khoaStationName: "낙산해수욕장" },
  { id: "namae3", area: "양양", name: "양양 남애3리", lat: 37.945, lon: 128.785, khoaObsCode: "TW_0089", khoaStationName: "경포대해수욕장" },
  { id: "gyeongpodae", area: "강릉", name: "경포대", lat: 37.8038483, lon: 128.9099120, khoaObsCode: "TW_0089", khoaStationName: "경포대해수욕장" },
  { id: "sacheon", area: "강릉", name: "사천", lat: 37.8288150, lon: 128.8783510, khoaObsCode: "TW_0089", khoaStationName: "경포대해수욕장" },
  { id: "anmok", area: "강릉", name: "안목", lat: 37.7735690, lon: 128.9453880, khoaObsCode: "TW_0089", khoaStationName: "경포대해수욕장" },
  { id: "jumunjin", area: "강릉", name: "주문진", lat: 37.8919185, lon: 128.8301458, khoaObsCode: "TW_0089", khoaStationName: "경포대해수욕장" },
  { id: "mangsang", area: "동해", name: "동해 망상", lat: 37.593666, lon: 129.090091, khoaObsCode: "TW_0094", khoaStationName: "망상해수욕장" },
  { id: "eodal", area: "동해", name: "동해 어달", lat: 37.566, lon: 129.118, khoaObsCode: "TW_0094", khoaStationName: "망상해수욕장" },
  { id: "chotdaebawi", area: "동해", name: "동해 추암", lat: 37.479, lon: 129.159, khoaObsCode: "TW_0094", khoaStationName: "망상해수욕장" },
  { id: "samcheok_beach", area: "삼척", name: "삼척 삼척해변", lat: 37.470, lon: 129.165, khoaObsCode: "TW_0094", khoaStationName: "망상해수욕장" },
  { id: "jangho", area: "삼척", name: "삼척 장호", lat: 37.289, lon: 129.316, khoaObsCode: "", khoaStationName: "" },
  { id: "yonghwa", area: "삼척", name: "삼척 용화", lat: 37.290, lon: 129.305, khoaObsCode: "", khoaStationName: "" },
  { id: "nagok_beach", area: "울진", name: "울진 나곡해수욕장", lat: 37.1257472378, lon: 129.3708990607, khoaObsCode: "", khoaStationName: "" },
  { id: "bongpyeong_beach", area: "울진", name: "울진 봉평해수욕장", lat: 37.0438232, lon: 129.4128910, khoaObsCode: "", khoaStationName: "" },
  { id: "gusan_beach", area: "울진", name: "울진 구산해수욕장", lat: 36.7532844, lon: 129.4672159, khoaObsCode: "TW_0095", khoaStationName: "고래불해수욕장" },
  { id: "hupo_beach", area: "울진", name: "울진 후포해수욕장", lat: 36.6750445745, lon: 129.4420091571, khoaObsCode: "TW_0095", khoaStationName: "고래불해수욕장" },
];

/**
 * 전체 지점 목록을 반환한다. 각 지점에는 hasKhoaMapping 플래그가 계산되어 포함된다.
 * @returns {Array<PointMeta & {hasKhoaMapping: boolean}>}
 */
function getAllPoints() {
  return POINTS.map((point) => ({
    ...point,
    hasKhoaMapping: Boolean(point.khoaObsCode),
  }));
}

/**
 * khoaObsCode가 있는(KHOA 관측소에 매핑된) 지점만 반환한다.
 * @returns {Array<PointMeta & {hasKhoaMapping: true}>}
 */
function getKhoaMappedPoints() {
  return getAllPoints().filter((point) => point.hasKhoaMapping);
}

module.exports = { getAllPoints, getKhoaMappedPoints };
