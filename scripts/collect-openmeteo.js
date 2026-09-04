// TODO(2단계): Open-Meteo API로부터 지점별 파고/스웰/수온/날씨코드 시계열을
// 수집하여 /data 아래 원본(raw) JSON으로 저장하는 로직을 구현할 예정.
// 이번 단계(1/4: 스캐폴딩)에서는 함수 시그니처만 정의하고 실제 구현은 하지 않는다.

/**
 * Open-Meteo Marine/Weather API를 호출하여 지점별 시간별 데이터를 수집한다.
 * @returns {Promise<void>}
 */
async function collectOpenMeteo() {
  // TODO(2단계): 지점 목록 로드 -> Open-Meteo API 호출 -> raw 데이터 저장
}

if (require.main === module) {
  collectOpenMeteo();
}

module.exports = { collectOpenMeteo };
