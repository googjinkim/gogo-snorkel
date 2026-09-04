// TODO(2단계): 지점 목록(id/name/area/hasKhoaMapping 등)과 파고/스웰/수온 기반
// 점수-등급-추천 계산 로직을 구현할 예정.
// 이번 단계(1/4: 스캐폴딩)에서는 함수 시그니처만 정의하고 실제 구현은 하지 않는다.

/**
 * 스노클링 지점 목록(정적 메타데이터)을 반환한다.
 * @returns {Array<{id: string, name: string, area: string, hasKhoaMapping: boolean}>}
 */
function getPoints() {
  // TODO(2단계): 지점 메타데이터 정의
  return [];
}

/**
 * 시간별 원시 관측/예보 값으로부터 점수/등급/추천 문구를 계산한다.
 * @param {object} hourlyRaw
 * @returns {{score: number, grade: string, recommendation: string, reason: string}}
 */
function calculateScore(hourlyRaw) {
  // TODO(2단계): 점수 계산 로직 구현
  return null;
}

module.exports = { getPoints, calculateScore };
