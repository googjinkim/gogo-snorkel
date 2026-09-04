// TODO(2단계): collect-openmeteo.js / collect-khoa.js가 저장한 raw 데이터를 읽어
// lib/points.js의 점수 계산 로직을 적용한 뒤 /data/scored.json을 생성하는 로직을
// 구현할 예정. scored.json 스키마는 README.md 참고.
// 이번 단계(1/4: 스캐폴딩)에서는 함수 시그니처만 정의하고 실제 구현은 하지 않는다.

/**
 * raw 데이터를 읽어 점수/등급/추천 여부를 계산하고 /data/scored.json으로 저장한다.
 * @returns {Promise<void>}
 */
async function buildScore() {
  // TODO(2단계): raw 데이터 로드 -> lib/points.js 스코어링 적용 -> scored.json 저장
}

if (require.main === module) {
  buildScore();
}

module.exports = { buildScore };
