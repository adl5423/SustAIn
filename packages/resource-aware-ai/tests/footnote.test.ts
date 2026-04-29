import { describe, it, expect } from "vitest";
import { generateFootnote } from "../src/core/footnote.js";

const baseMetrics = {
  energy_kwh: 0.005,
  water_ml: 10,
  baseline_water_ml: 22.5,
  water_saved_percent: 55.5,
  tokens_estimated: 2000,
  cache_hit: false,
};

describe("generateFootnote", () => {
  it("includes water_ml in footnote", () => {
    const fn = generateFootnote(baseMetrics);
    expect(fn).toContain("10.00 ml");
  });

  it("includes energy in footnote", () => {
    const fn = generateFootnote(baseMetrics);
    expect(fn).toContain("Wh");
  });

  it("includes savings percentage", () => {
    const fn = generateFootnote(baseMetrics);
    expect(fn).toContain("55.5%");
  });

  it("shows cache hit message when cache_hit is true", () => {
    const fn = generateFootnote({ ...baseMetrics, cache_hit: true });
    expect(fn.toLowerCase()).toContain("cache");
    expect(fn).toContain("0 ml");
  });
});
