import { describe, it, expect } from "vitest";
import {
  computeEquivalents,
  G_CO2_PER_KM,
  WH_PER_GOOGLE_SEARCH,
  WH_PER_SMARTPHONE_CHARGE,
  W_LED_BULB,
  ML_PER_SHOWER_SECOND,
} from "../src/core/equivalents.js";

describe("computeEquivalents", () => {
  it("computes Google searches from Wh", () => {
    const r = computeEquivalents({ energy_wh: 3, water_ml: 0, co2_g: 0 });
    expect(r.google_searches).toBeCloseTo(3 / WH_PER_GOOGLE_SEARCH, 6);
  });

  it("computes phone charges from Wh", () => {
    const r = computeEquivalents({ energy_wh: 19, water_ml: 0, co2_g: 0 });
    expect(r.smartphone_charges).toBeCloseTo(19 / WH_PER_SMARTPHONE_CHARGE, 6);
    expect(r.smartphone_charges).toBeCloseTo(1, 6);
  });

  it("computes km driven from CO₂ grams", () => {
    const r = computeEquivalents({ energy_wh: 0, water_ml: 0, co2_g: 240 });
    expect(r.km_driven).toBeCloseTo(240 / G_CO2_PER_KM, 6);
    expect(r.km_driven).toBeCloseTo(2, 6);
  });

  it("computes LED bulb hours from Wh", () => {
    const r = computeEquivalents({ energy_wh: 18, water_ml: 0, co2_g: 0 });
    expect(r.led_bulb_hours).toBeCloseTo(18 / W_LED_BULB, 6);
    expect(r.led_bulb_hours).toBeCloseTo(2, 6);
  });

  it("computes shower seconds from ml", () => {
    const r = computeEquivalents({ energy_wh: 0, water_ml: 1000, co2_g: 0 });
    expect(r.shower_seconds).toBeCloseTo(1000 / ML_PER_SHOWER_SECOND, 6);
  });

  it("clamps negative inputs to 0", () => {
    const r = computeEquivalents({ energy_wh: -5, water_ml: -10, co2_g: -1 });
    expect(r.google_searches).toBe(0);
    expect(r.smartphone_charges).toBe(0);
    expect(r.km_driven).toBe(0);
    expect(r.led_bulb_hours).toBe(0);
    expect(r.shower_seconds).toBe(0);
  });
});
