import type { WaterAccountingConfig } from "../types.js";

export const DEFAULT_WATER_ACCOUNTING: WaterAccountingConfig = {
  pue: 1.4,
  siteWueLitersPerKwhIt: 0.36,
  electricityWaterLitersPerKwh: 4.52,
  scope: "direct+electricity",
};

export interface WaterResult {
  water_ml: number;
  direct_water_ml: number;
  electricity_water_ml: number;
  baseline_water_ml: number;
  water_saved_percent: number;
}

export interface OperationalWaterResult {
  water_ml: number;
  direct_water_ml: number;
  electricity_water_ml: number;
}

export function resolveWaterAccounting(
  config: Partial<WaterAccountingConfig> = {},
): WaterAccountingConfig {
  const resolved = { ...DEFAULT_WATER_ACCOUNTING, ...config };
  assertPositiveFinite(resolved.pue, "waterAccounting.pue");
  assertNonNegativeFinite(
    resolved.siteWueLitersPerKwhIt,
    "waterAccounting.siteWueLitersPerKwhIt",
  );
  assertNonNegativeFinite(
    resolved.electricityWaterLitersPerKwh,
    "waterAccounting.electricityWaterLitersPerKwh",
  );
  return resolved;
}

/** Legacy ml/kWh helper retained for API compatibility. */
export function calculateWater(kwh: number, regionFactor: number): number {
  assertNonNegativeFinite(kwh, "kwh");
  assertNonNegativeFinite(regionFactor, "regionFactor");
  return kwh * regionFactor;
}

/** Legacy ml/kWh helper retained for API compatibility. */
export function calculateBaseline(kwh: number, baselineFactor: number): number {
  assertNonNegativeFinite(kwh, "kwh");
  assertNonNegativeFinite(baselineFactor, "baselineFactor");
  return kwh * baselineFactor;
}

/** Avoided percentage, clamped at zero for backward compatibility. */
export function calculateSavings(actual: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return Math.max(0, ((baseline - actual) / baseline) * 100);
}

/** Signed change: positive means savings; negative means increased use. */
export function calculateDeltaPercent(
  actual: number,
  baseline: number,
): number {
  if (baseline <= 0) return 0;
  return ((baseline - actual) / baseline) * 100;
}

export function computeOperationalWater(
  facilityEnergyKwh: number,
  config: Partial<WaterAccountingConfig> = {},
): OperationalWaterResult {
  assertNonNegativeFinite(facilityEnergyKwh, "facilityEnergyKwh");
  const resolved = resolveWaterAccounting(config);
  const itEnergyKwh = facilityEnergyKwh / resolved.pue;
  const directWaterMl = itEnergyKwh * resolved.siteWueLitersPerKwhIt * 1000;
  const electricityWaterMl =
    facilityEnergyKwh * resolved.electricityWaterLitersPerKwh * 1000;
  const waterMl =
    resolved.scope === "direct"
      ? directWaterMl
      : directWaterMl + electricityWaterMl;

  return {
    water_ml: waterMl,
    direct_water_ml: directWaterMl,
    electricity_water_ml: electricityWaterMl,
  };
}

/**
 * Legacy three-argument form. The input factors cannot support separate water
 * scopes, so this function reports the legacy aggregate.
 */
export function computeWaterMetrics(
  kwh: number,
  regionFactor: number,
  baselineFactor: number,
): WaterResult {
  const waterMl = calculateWater(kwh, regionFactor);
  const baselineWaterMl = calculateBaseline(kwh, baselineFactor);
  return {
    water_ml: waterMl,
    direct_water_ml: waterMl,
    electricity_water_ml: 0,
    baseline_water_ml: baselineWaterMl,
    water_saved_percent: calculateSavings(waterMl, baselineWaterMl),
  };
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a finite number greater than zero.`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a finite, non-negative number.`);
  }
}
