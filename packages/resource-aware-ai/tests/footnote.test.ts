import { describe, it, expect } from "vitest";
import { generateFootnote, generateInlineFootnote } from "../src/core/footnote.js";
import type { ResourceMetrics } from "../src/index.js";

const baseMetrics: ResourceMetrics = {
  energy_kwh: 0.005,
  water_ml: 10,
  baseline_water_ml: 22.5,
  water_saved_ml: 12.5,
  water_saved_percent: 55.5,
  water_display: 10,
  baseline_display: 22.5,
  water_saved_display: 12.5,
  unit: "ml",
  tokens_estimated: 2000,
  cache_hit: false,
  bottles_saved: 0.025,
  bottles_saved_session: 0.1,
  bottle_size_display: 500,
};

const imperialMetrics: ResourceMetrics = {
  ...baseMetrics,
  water_display: 10 / 29.5735,
  baseline_display: 22.5 / 29.5735,
  water_saved_display: 12.5 / 29.5735,
  unit: "fl oz",
  bottle_size_display: 500 / 29.5735,
};

describe("generateFootnote", () => {
  it("includes Water used line", () => {
    expect(generateFootnote(baseMetrics)).toContain("Water used");
  });

  it("includes Without system (baseline) line", () => {
    expect(generateFootnote(baseMetrics)).toContain("Without system");
  });

  it("includes Water saved line with percent", () => {
    const fn = generateFootnote(baseMetrics);
    expect(fn).toContain("Water saved");
    expect(fn).toContain("55.5%");
  });

  it("includes Energy line", () => {
    expect(generateFootnote(baseMetrics)).toContain("Energy");
    expect(generateFootnote(baseMetrics)).toContain("Wh");
  });

  it("includes Bottles saved line", () => {
    const fn = generateFootnote(baseMetrics);
    expect(fn).toContain("Bottles saved");
    expect(fn).toContain("session total");
  });

  it("shows cache message on cache hit", () => {
    const fn = generateFootnote({ ...baseMetrics, cache_hit: true });
    expect(fn.toLowerCase()).toContain("cache");
    expect(fn).toContain("0 ml");
  });

  it("includes fl oz for imperial metrics", () => {
    const fn = generateFootnote(imperialMetrics);
    expect(fn).toContain("fl oz");
  });

  it("shows session total bottles in cache hit footnote when > 0", () => {
    const fn = generateFootnote({ ...baseMetrics, cache_hit: true, bottles_saved_session: 0.5 });
    expect(fn).toContain("Session bottles saved");
  });
});

describe("generateInlineFootnote", () => {
  it("is a single line", () => {
    const fn = generateInlineFootnote(baseMetrics);
    expect(fn).not.toContain("\n");
  });

  it("contains used, baseline, saved and session data", () => {
    const fn = generateInlineFootnote(baseMetrics);
    expect(fn).toContain("Used");
    expect(fn).toContain("Baseline");
    expect(fn).toContain("Saved");
    expect(fn).toContain("Session");
  });

  it("shows cache text on cache hit", () => {
    const fn = generateInlineFootnote({ ...baseMetrics, cache_hit: true });
    expect(fn.toLowerCase()).toContain("cache hit");
  });
});
