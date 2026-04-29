export interface WaterResult {
  water_ml: number;
  baseline_water_ml: number;
  water_saved_percent: number;
}

export function calculateWater(kwh: number, regionFactor: number): number {
  return kwh * regionFactor;
}

export function calculateBaseline(kwh: number, baselineFactor: number): number {
  return kwh * baselineFactor;
}

export function calculateSavings(actual: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return Math.max(0, ((baseline - actual) / baseline) * 100);
}

export function computeWaterMetrics(
  kwh: number,
  regionFactor: number,
  baselineFactor: number
): WaterResult {
  const water_ml = calculateWater(kwh, regionFactor);
  const baseline_water_ml = calculateBaseline(kwh, baselineFactor);
  const water_saved_percent = calculateSavings(water_ml, baseline_water_ml);

  return { water_ml, baseline_water_ml, water_saved_percent };
}
