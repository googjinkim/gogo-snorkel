// 지역 순서/이름 상수. scored.json의 각 point.area 값과 정확히 일치한다.
// Node(require)와 브라우저(<script> 전역) 양쪽에서 재사용 가능한 형태로 작성.
//
// 주의: 이 파일은 현재 어디서도 require/로드되지 않는 미사용 상태다(2026-09
// 확인). 실제로 쓰이는 지역 상수는 app.js에 인라인으로 따로 정의된
// REGION_ORDER/REGION_NAMES이며, 영덕/포항 추가 등 지역 목록이 바뀔 때마다
// 그쪽만 갱신되고 이 파일은 갱신되지 않아 아래 목록은 오래된 7개 상태로
// 남아있다. 지역 상수가 필요하면 이 파일이 아니라 app.js의 정의를 참고할 것.

var REGION_ORDER = ["gosung", "sokcho", "yangyang", "gangneung", "donghae", "samcheok", "uljin"];

var REGION_NAMES = {
  gosung: "고성",
  sokcho: "속초",
  yangyang: "양양",
  gangneung: "강릉",
  donghae: "동해",
  samcheok: "삼척",
  uljin: "울진",
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { REGION_ORDER: REGION_ORDER, REGION_NAMES: REGION_NAMES };
}
