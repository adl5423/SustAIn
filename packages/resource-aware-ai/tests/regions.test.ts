import { describe, it, expect } from "vitest";
import {
  GRID_INTENSITIES,
  BASELINE_GRID_G_PER_KWH,
  DEFAULT_REGION,
  getGridIntensity,
  getRegionData,
  listRegions,
} from "../src/core/regions.js";

describe("regions", () => {
  it("has a U.S. default aligned with the water-accounting scenario", () => {
    expect(DEFAULT_REGION).toBe("us");
    expect(GRID_INTENSITIES[DEFAULT_REGION]).toBeDefined();
  });

  it("returns the configured intensity for a known region", () => {
    expect(getGridIntensity("fr")).toBe(56);
    expect(getGridIntensity("us")).toBe(349.7);
    expect(getGridIntensity("in")).toBe(713);
  });

  it("falls back to the configured default for unknown regions", () => {
    expect(getGridIntensity("atlantis")).toBe(
      GRID_INTENSITIES.us!.grid_g_per_kwh,
    );
  });

  it("getRegionData returns an entry with id, label, source", () => {
    const data = getRegionData("fr");
    expect(data.id).toBe("fr");
    expect(data.label).toContain("France");
    expect(data.source).toBeTruthy();
  });

  it("listRegions returns all entries", () => {
    const all = listRegions();
    expect(all.length).toBeGreaterThan(15);
    expect(all.find((r) => r.id === "global")).toBeDefined();
  });

  it("uses the U.S. eGRID average for the exported baseline default", () => {
    expect(BASELINE_GRID_G_PER_KWH).toBe(GRID_INTENSITIES.us!.grid_g_per_kwh);
  });
});
