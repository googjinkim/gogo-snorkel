// 스노클 적합도 점수 계산 (순수 함수, 파일 I/O 없음).
// 원본 Apps Script calculateSnorkelScoreV21과 1:1 대응하는 로직.

function isPresent(value) {
  return typeof value === "number" && !Number.isNaN(value);
}

function scoreForecastWave(forecastWave) {
  if (!isPresent(forecastWave)) return { delta: -10, reason: "예보파고 정보 없음" };
  if (forecastWave <= 0.2) return { delta: 5, reason: "예보파고 매우 잔잔" };
  if (forecastWave <= 0.4) return { delta: 0, reason: "예보파고 양호" };
  if (forecastWave <= 0.6) return { delta: -15, reason: "예보파고 다소 높음" };
  if (forecastWave <= 1.0) return { delta: -35, reason: "예보파고 높음" };
  return { delta: -60, reason: "예보파고 매우 높음" };
}

function scoreSwellWave(swellWave) {
  if (swellWave <= 0.2) return { delta: 5, reason: "너울 매우 양호" };
  if (swellWave <= 0.4) return { delta: 0, reason: "너울 양호" };
  if (swellWave <= 0.7) return { delta: -15, reason: "너울 다소 높음" };
  return { delta: -35, reason: "너울 높음" };
}

function scoreObservedWave(observedWave) {
  if (observedWave <= 0.2) return { delta: 5, reason: "실측파고 매우 낮음" };
  if (observedWave <= 0.4) return { delta: 0, reason: "실측파고 양호" };
  if (observedWave <= 0.6) return { delta: -10, reason: "실측파고 다소 높음" };
  if (observedWave <= 1.0) return { delta: -30, reason: "실측파고 높음" };
  return { delta: -55, reason: "실측파고 매우 높음" };
}

function scoreMaxObservedWave(maxObservedWave) {
  if (maxObservedWave <= 0.5) return { delta: 0, reason: "최대파고 안정" };
  if (maxObservedWave <= 0.8) return { delta: -10, reason: "최대파고 다소 높음" };
  return { delta: -30, reason: "최대파고 높음" };
}

function scoreWaterTemp(waterTemp) {
  if (waterTemp < 18) return { delta: -20, reason: "수온 낮음" };
  if (waterTemp < 20) return { delta: -8, reason: "수온 다소 낮음" };
  if (waterTemp <= 24) return { delta: 5, reason: "수온 적정" };
  if (waterTemp <= 27) return { delta: 0, reason: "수온 양호" };
  return { delta: -5, reason: "수온 높음" };
}

function scoreDiff(diff) {
  const abs = Math.abs(diff);
  if (abs <= 0.1) return { delta: 3, reason: "예보/실측 거의 일치" };
  if (abs <= 0.3) return { delta: 0, reason: "예보/실측 유사" };
  return { delta: -10, reason: "예보/실측 차이 큼" };
}

function gradeFor(score) {
  if (score >= 90) return { grade: "★★★★★", recommendation: "강력추천" };
  if (score >= 80) return { grade: "★★★★☆", recommendation: "추천" };
  if (score >= 65) return { grade: "★★★☆☆", recommendation: "보통" };
  if (score >= 50) return { grade: "★★☆☆☆", recommendation: "주의" };
  return { grade: "★☆☆☆☆", recommendation: "비추천" };
}

/**
 * 예보/실측 파고, 수온으로부터 스노클 적합도 점수/등급/추천/사유를 계산한다.
 * @param {{forecastWave?: number|null, swellWave?: number|null, waterTemp?: number|null,
 *          observedWave?: number|null, maxObservedWave?: number|null}} input
 * @returns {{score: number, grade: string, recommendation: string, reason: string}}
 */
function calculateScore(input) {
  const { forecastWave, swellWave, waterTemp, observedWave, maxObservedWave } = input;

  let total = 100;
  const reasons = [];

  const forecastResult = scoreForecastWave(forecastWave);
  total += forecastResult.delta;
  reasons.push(forecastResult.reason);

  if (isPresent(swellWave)) {
    const r = scoreSwellWave(swellWave);
    total += r.delta;
    reasons.push(r.reason);
  }

  if (isPresent(observedWave)) {
    const r = scoreObservedWave(observedWave);
    total += r.delta;
    reasons.push(r.reason);
  }

  if (isPresent(maxObservedWave)) {
    const r = scoreMaxObservedWave(maxObservedWave);
    total += r.delta;
    reasons.push(r.reason);
  }

  if (isPresent(waterTemp)) {
    const r = scoreWaterTemp(waterTemp);
    total += r.delta;
    reasons.push(r.reason);
  }

  if (isPresent(observedWave) && isPresent(forecastWave)) {
    const diff = observedWave - forecastWave;
    const r = scoreDiff(diff);
    total += r.delta;
    reasons.push(r.reason);
  }

  const score = Math.round(Math.min(100, Math.max(0, total)));
  const { grade, recommendation } = gradeFor(score);
  const reason = reasons.slice(0, 5).join(", ");

  return { score, grade, recommendation, reason };
}

module.exports = { calculateScore };
