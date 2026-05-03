import { describe, it, expect } from "vitest";
import { generateFootnote, generateInlineFootnote } from "../src/core/footnote.js";
import { ZERO_EQUIVALENTS } from "../src/core/equivalents.js";
import type { ResourceMetrics, SessionSummary } from "../src/index.js";

const session: SessionSummary = {
  requests: 1,
  cache_hits: 0,
  cache_hit_rate: 0,
  energy_kwh: 0.005,
  water_ml: 10,
  co2_g: 2.405,
  water_saved_ml: 12.5,
  co2_saved_g: 2.095,
  bottles_saved: 0.025,
  cache_savings: { requests: 0, exact_hits: 0, semantic_hits: 0, energy_wh: 0, water_ml: 0, co2_g: 0 },
  equivalents_used: { ...ZERO_EQUIVALENTS, google_searches: 16.67 },
  equivalents_saved: { ...ZERO_EQUIVALENTS },
};

const baseMetrics: ResourceMetrics = {
  energy_kwh: 0.005,
  energy_wh: 5,
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
  cache_hit_type: null,
  cache_similarity: null,
  bottles_saved: 0.025,
  bottles_saved_session: 0.1,
  bottle_size_display: 500,
  co2_g: 2.405,
  baseline_co2_g: 4.5,
  co2_saved_g: 2.095,
  co2_saved_percent: 46.6,
  co2_saved_session_g: 2.095,
  region: "global",
  grid_intensity_g_per_kwh: 481,
  baseline_grid_intensity_g_per_kwh: 900,
  equivalents: {
    google_searches: 16.67,
    smartphone_charges: 0.26,
    km_driven: 0.02,
    led_bulb_hours: 0.55,
    shower_seconds: 0.063,
  },
  session,
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

  it("includes Carbon line with region and gCO₂e", () => {
    const fn = generateFootnote(baseMetrics);
    expect(fn).toContain("Carbon");
    expect(fn).toContain("global");
    expect(fn).toContain("CO₂e");
  });

  it("includes human-scale equivalents line", () => {
    const fn = generateFootnote(baseMetrics);
    expect(fn).toContain("In human terms");
    expect(fn).toContain("Google searches");
    expect(fn).toContain("phone charges");
    expect(fn).toContain("km driven");
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

  it("shows session sentence in cache hit footnote", () => {
    const fn = generateFootnote({ ...baseMetrics, cache_hit: true, bottles_saved_session: 0.5 });
    expect(fn).toContain("You've saved");
  });

  it("shows cache savings line when cache savings have accumulated", () => {
    const withCacheSavings: ResourceMetrics = {
      ...baseMetrics,
      session: {
        ...session,
        cache_savings: { requests: 3, exact_hits: 3, semantic_hits: 0, energy_wh: 15, water_ml: 30, co2_g: 7.2 },
      },
    };
    const fn = generateFootnote(withCacheSavings);
    expect(fn).toContain("Cache savings");
    expect(fn).toContain("3 hits");
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

  it("includes CO₂ savings inline", () => {
    const fn = generateInlineFootnote(baseMetrics);
    expect(fn).toContain("CO₂");
  });
});
