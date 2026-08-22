import { describe, expect, it } from "vitest";
import { compareModels } from "../src/core/comparison.js";

describe("compareModels", () => {
  it("normalizes every model to the same token workload and baseline", () => {
    const rows = compareModels([
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-oss-20b",
    ]);
    const sol = rows[0]!;
    const terra = rows[1]!;
    const luna = rows[2]!;

    expect(sol.energy_wh).toBeCloseTo(0.5425, 6);
    expect(sol.water_saved_vs_baseline_percent).toBeCloseTo(0, 8);
    expect(terra.energy_wh).toBeCloseTo(0.31, 8);
    expect(terra.water_saved_vs_baseline_percent).toBeCloseTo(42.8571, 3);
    expect(luna.water_saved_vs_baseline_percent).toBeCloseTo(62.8571, 3);
    expect(
      rows.every((row) => row.methodology === "normalized-model-estimate"),
    ).toBe(true);
  });

  it("returns a negative percentage when a model uses more than the baseline", () => {
    const [row] = compareModels(["deepseek-r1"], {
      baselineModel: "gpt-5.6-sol",
    });
    expect(row!.water_saved_vs_baseline_percent).toBeLessThan(0);
  });
});
