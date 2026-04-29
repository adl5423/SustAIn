import { describe, it, expect } from "vitest";
import { calculateWater, calculateBaseline, calculateSavings, computeWaterMetrics } from "../src/core/calculator.js";

describe("calculateWater", () => {
  it("multiplies kwh by regionFactor", () => {
    expect(calculateWater(0.001, 2000)).toBeCloseTo(2.0, 5);
    expect(calculateWater(0.005, 1800)).toBeCloseTo(9.0, 5);
  });

  it("returns 0 for zero kwh", () => {
    expect(calculateWater(0, 2000)).toBe(0);
  });
});

describe("calculateBaseline", () => {
  it("uses baselineFactor", () => {
    expect(calculateBaseline(0.001, 4500)).toBeCloseTo(4.5, 5);
  });
});

describe("calculateSavings", () => {
  it("calculates correct percentage savings", () => {
    expect(calculateSavings(9, 18)).toBeCloseTo(50.0, 2);
    expect(calculateSavings(4.5, 9)).toBeCloseTo(50.0, 2);
  });

  it("returns 0 when baseline is 0", () => {
    expect(calculateSavings(5, 0)).toBe(0);
  });

  it("returns 0 (not negative) when actual > baseline", () => {
    expect(calculateSavings(10, 5)).toBe(0);
  });

  it("returns 100 when actual is 0", () => {
    expect(calculateSavings(0, 10)).toBeCloseTo(100, 2);
  });
});

describe("computeWaterMetrics", () => {
  it("returns consistent metrics", () => {
    const result = computeWaterMetrics(0.001, 2000, 4500);
    expect(result.water_ml).toBeCloseTo(2.0, 5);
    expect(result.baseline_water_ml).toBeCloseTo(4.5, 5);
    expect(result.water_saved_percent).toBeCloseTo(55.55, 1);
  });
});
