// TODO(2단계): KHOA(국립해양조사원) API로부터 관측 파고(observedWave) /
// 최대관측파고(maxObservedWave) 등을 수집하여 /data 아래 원본(raw) JSON으로
// 저장하는 로직을 구현할 예정.
// 이번 단계(1/4: 스캐폴딩)에서는 함수 시그니처만 정의하고 실제 구현은 하지 않는다.
//
// 주의: KHOA_SERVICE_KEY는 코드에 절대 하드코딩하지 않는다.
// GitHub Actions workflow(.github/workflows/ocean-collect.yml)에서
// secrets.KHOA_SERVICE_KEY를 환경변수로 주입받아, 아래처럼
// process.env.KHOA_SERVICE_KEY로만 참조한다.
// const serviceKey = process.env.KHOA_SERVICE_KEY;

/**
 * KHOA API를 호출하여 매핑된 지점의 관측 데이터를 수집한다.
 * @returns {Promise<void>}
 */
async function collectKhoa() {
  // TODO(2단계): process.env.KHOA_SERVICE_KEY 사용
  // TODO(2단계): 지점-관측소 매핑 로드 -> KHOA API 호출 -> raw 데이터 저장
}

if (require.main === module) {
  collectKhoa();
}

module.exports = { collectKhoa };
