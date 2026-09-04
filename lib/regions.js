// 지역 순서/이름 상수. scored.json의 각 point.area 값과 정확히 일치한다.
// Node(require)와 브라우저(<script> 전역) 양쪽에서 재사용 가능한 형태로 작성.

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
