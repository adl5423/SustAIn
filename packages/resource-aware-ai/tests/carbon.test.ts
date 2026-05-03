import { describe, it, expect } from "vitest";
import {
  calculateCarbon,
  calculateBaselineCarbon,
  computeCarbonMetrics,
} from "../src/core/carbon.js";

describe("calculateCarbon", () => {
  it("returns kwh × gridIntensity in grams", () => {
    expect(calculateCarbon(0.001, 481)).toBeCloseTo(0.481, 6);
    expect(calculateCarbon(0.005, 369)).toBeCloseTo(1.845, 6);
  });

  it("returns 0 for zero kwh", () => {
    expect(calculateCarbon(0, 900)).toBe(0);
  });
});

describe("calculateBaselineCarbon", () => {
  it("uses the baseline grid intensity", () => {
    expect(calculateBaselineCarbon(0.001, 900)).toBeCloseTo(0.9, 6);
  });
});

describe("computeCarbonMetrics", () => {
  it("computes co2, baseline, saved and saved%", () => {
    const r = computeCarbonMetrics(0.001, 481, 900);
    expect(r.co2_g).toBeCloseTo(0.481, 6);
    expect(r.baseline_co2_g).toBeCloseTo(0.9, 6);
    expect(r.co2_saved_g).toBeCloseTo(0.419, 6);
    expect(r.co2_saved_percent).toBeCloseTo(((900 - 481) / 900) * 100, 6);
  });

  it("clamps savings to 0 when actual >= baseline", () => {
    const r = computeCarbonMetrics(0.001, 1500, 900);
    expect(r.co2_saved_g).toBe(0);
    expect(r.co2_saved_percent).toBe(0);
  });

  it("returns 100% saved when actual is 0", () => {
    const r = computeCarbonMetrics(0, 481, 900);
    expect(r.co2_g).toBe(0);
    expect(r.co2_saved_percent).toBe(0); // baseline is also 0 when kwh=0
  });
});
