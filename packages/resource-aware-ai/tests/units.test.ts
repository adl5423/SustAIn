import { describe, it, expect } from "vitest";
import {
  mlToDisplay,
  getUnit,
  mlToBottles,
  makeUnitContext,
  DEFAULT_BOTTLE_ML,
  DEFAULT_BOTTLE_FL_OZ,
} from "../src/core/units.js";

const FL_OZ_PER_ML = 1 / 29.5735;

describe("mlToDisplay", () => {
  it("returns ml unchanged for metric", () => {
    expect(mlToDisplay(100, "metric")).toBe(100);
    expect(mlToDisplay(0, "metric")).toBe(0);
  });

  it("converts ml to fl oz for imperial", () => {
    expect(mlToDisplay(100, "imperial")).toBeCloseTo(100 * FL_OZ_PER_ML, 4);
    expect(mlToDisplay(500, "imperial")).toBeCloseTo(500 * FL_OZ_PER_ML, 4);
  });
});

describe("getUnit", () => {
  it("returns ml for metric", () => {
    expect(getUnit("metric")).toBe("ml");
  });

  it("returns fl oz for imperial", () => {
    expect(getUnit("imperial")).toBe("fl oz");
  });
});

describe("mlToBottles", () => {
  it("calculates bottles correctly", () => {
    expect(mlToBottles(500, 500)).toBeCloseTo(1, 5);
    expect(mlToBottles(250, 500)).toBeCloseTo(0.5, 5);
    expect(mlToBottles(1000, 500)).toBeCloseTo(2, 5);
  });

  it("returns 0 for zero bottle size", () => {
    expect(mlToBottles(500, 0)).toBe(0);
  });

  it("returns 0 for zero water", () => {
    expect(mlToBottles(0, 500)).toBe(0);
  });
});

describe("DEFAULT_BOTTLE_FL_OZ", () => {
  it("is approximately 16.9 fl oz (standard US bottle)", () => {
    expect(DEFAULT_BOTTLE_FL_OZ).toBeCloseTo(16.9, 0);
  });
});

describe("makeUnitContext", () => {
  it("creates metric context with 500ml default bottle", () => {
    const ctx = makeUnitContext("metric");
    expect(ctx.unit).toBe("ml");
    expect(ctx.bottleSizeMl).toBe(DEFAULT_BOTTLE_ML);
    expect(ctx.bottleSizeDisplay).toBe(DEFAULT_BOTTLE_ML);
    expect(ctx.system).toBe("metric");
  });

  it("creates imperial context with fl oz bottle", () => {
    const ctx = makeUnitContext("imperial");
    expect(ctx.unit).toBe("fl oz");
    expect(ctx.bottleSizeMl).toBe(DEFAULT_BOTTLE_ML);
    expect(ctx.bottleSizeDisplay).toBeCloseTo(DEFAULT_BOTTLE_FL_OZ, 4);
  });

  it("respects custom bottle size", () => {
    const ctx = makeUnitContext("metric", 250);
    expect(ctx.bottleSizeMl).toBe(250);
    expect(ctx.bottleSizeDisplay).toBe(250);
  });

  it("rejects invalid unit and bottle configuration", () => {
    expect(() => makeUnitContext("unknown" as never)).toThrow(/unitSystem/);
    expect(() => makeUnitContext("metric", 0)).toThrow(/bottleSizeMl/);
    expect(() => makeUnitContext("metric", Number.NaN)).toThrow(/bottleSizeMl/);
  });
});
