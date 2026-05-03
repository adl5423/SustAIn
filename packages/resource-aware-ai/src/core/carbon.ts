import { calculateSavings } from "./calculator.js";

export interface CarbonResult {
  co2_g: number;
  baseline_co2_g: number;
  co2_saved_g: number;
  co2_saved_percent: number;
}

export function calculateCarbon(kwh: number, gridGperKwh: number): number {
  return kwh * gridGperKwh;
}

export function calculateBaselineCarbon(kwh: number, baselineGridGperKwh: number): number {
  return kwh * baselineGridGperKwh;
}

export function computeCarbonMetrics(
  kwh: number,
  gridGperKwh: number,
  baselineGridGperKwh: number
): CarbonResult {
  const co2_g = calculateCarbon(kwh, gridGperKwh);
  const baseline_co2_g = calculateBaselineCarbon(kwh, baselineGridGperKwh);
  const co2_saved_g = Math.max(0, baseline_co2_g - co2_g);
  const co2_saved_percent = calculateSavings(co2_g, baseline_co2_g);
  return { co2_g, baseline_co2_g, co2_saved_g, co2_saved_percent };
}
