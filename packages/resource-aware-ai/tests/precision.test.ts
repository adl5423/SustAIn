import { describe, it, expect } from "vitest";
import {
  calculateSavings,
  calculateWater,
  calculateBaseline,
  computeWaterMetrics,
} from "../src/core/calculator.js";
import { computeCarbonMetrics } from "../src/core/carbon.js";
import { SustainAI } from "../src/index.js";
import type { ProviderAdapter } from "../src/index.js";

function mock(text = "ok"): ProviderAdapter {
  return {
    async generate() {
      return { text, usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } };
    },
  };
}

describe("calculateSavings — exact arithmetic", () => {
  it("matches the documented formula exactly: (baseline-actual)/baseline*100", () => {
    const baseline = 100;
    const actual = 37.5;
    const expected = ((baseline - actual) / baseline) * 100;
    expect(calculateSavings(actual, baseline)).toBe(expected);
    expect(calculateSavings(actual, baseline)).toBe(62.5);
  });

  it("returns 100 when actual is 0", () => {
    expect(calculateSavings(0, 12.34)).toBe(100);
  });

  it("returns 0 when baseline is 0 (avoids divide-by-zero)", () => {
    expect(calculateSavings(5, 0)).toBe(0);
    expect(calculateSavings(0, 0)).toBe(0);
  });

  it("clamps to 0 when actual > baseline (never negative)", () => {
    expect(calculateSavings(150, 100)).toBe(0);
  });

  it("is invariant under proportional scaling of actual and baseline", () => {
    const a = calculateSavings(7, 20);
    const b = calculateSavings(70, 200);
    const c = calculateSavings(0.07, 0.2);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe("computeWaterMetrics — precision", () => {
  it("derives water_saved exactly from baseline - actual", () => {
    const r = computeWaterMetrics(0.0037, 2000, 4500);
    expect(r.water_ml).toBe(calculateWater(0.0037, 2000));
    expect(r.baseline_water_ml).toBe(calculateBaseline(0.0037, 4500));
    expect(r.water_saved_percent).toBe(((4500 - 2000) / 4500) * 100);
  });
});

describe("computeCarbonMetrics — precision", () => {
  it("derives co2_saved_percent exactly from grid intensities", () => {
    const r = computeCarbonMetrics(0.0037, 481, 900);
    expect(r.co2_saved_percent).toBe(((900 - 481) / 900) * 100);
  });
});

describe("Session totals — precision and additivity", () => {
  it("session.water_ml equals the sum of per-request water_ml across calls", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("mock", mock());
    const opts = { model: "gpt-4o", provider: "mock", messages: [{ role: "user" as const, content: "" }] };

    const r1 = await ai.chat({ ...opts, messages: [{ role: "user", content: "first" }] });
    const r2 = await ai.chat({ ...opts, messages: [{ role: "user", content: "second" }] });
    const r3 = await ai.chat({ ...opts, messages: [{ role: "user", content: "third" }] });

    const sum = r1.metrics.water_ml + r2.metrics.water_ml + r3.metrics.water_ml;
    expect(r3.metrics.session.water_ml).toBeCloseTo(sum, 10);
  });

  it("session.co2_g equals the sum of per-request co2_g across calls", async () => {
    const ai = new SustainAI({ enableCache: false, region: "fr" });
    ai.registerProvider("mock", mock());
    const opts = { model: "gpt-4o", provider: "mock", messages: [{ role: "user" as const, content: "" }] };

    const r1 = await ai.chat({ ...opts, messages: [{ role: "user", content: "a" }] });
    const r2 = await ai.chat({ ...opts, messages: [{ role: "user", content: "b" }] });

    expect(r2.metrics.session.co2_g).toBeCloseTo(r1.metrics.co2_g + r2.metrics.co2_g, 10);
  });

  it("session.water_saved_ml equals sum of saved across calls", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("mock", mock());
    const opts = { model: "gpt-4o", provider: "mock", messages: [{ role: "user" as const, content: "x" }] };

    const r1 = await ai.chat(opts);
    const r2 = await ai.chat({ ...opts, messages: [{ role: "user", content: "y" }] });

    expect(r2.metrics.session.water_saved_ml).toBeCloseTo(
      r1.metrics.water_saved_ml + r2.metrics.water_saved_ml,
      10,
    );
  });
});

describe("Cache safety", () => {
  it("cache hit bypasses constraint enforcement (actual usage is zero)", async () => {
    const ai = new SustainAI({ enableCache: true });
    ai.registerProvider("mock", mock("ok"));
    const opts = { model: "gpt-4o", provider: "mock", messages: [{ role: "user" as const, content: "Hi" }] };

    await ai.chat(opts);
    // Now apply an impossible constraint — a cache hit should still succeed.
    const hit = await ai.chat({ ...opts, constraints: { max_water_ml: 0.0000001, max_co2_g: 0.0000001 } });
    expect(hit.metrics.cache_hit).toBe(true);
    expect(hit.metrics.water_ml).toBe(0);
    expect(hit.metrics.co2_g).toBe(0);
  });

  it("cache key includes provider — same model+messages on different providers do not collide", async () => {
    const ai = new SustainAI({ enableCache: true });
    ai.registerProvider("p1", mock("from-p1"));
    ai.registerProvider("p2", mock("from-p2"));
    const messages = [{ role: "user" as const, content: "Same question" }];

    const r1 = await ai.chat({ model: "gpt-4o", provider: "p1", messages });
    const r2 = await ai.chat({ model: "gpt-4o", provider: "p2", messages });

    expect(r1.output).toBe("from-p1");
    expect(r2.output).toBe("from-p2");
    expect(r2.metrics.cache_hit).toBe(false);
  });
});

describe("Cache savings — precision", () => {
  it("cache hit reports 0 actual and accumulates avoided cost in cache_savings", async () => {
    const ai = new SustainAI({ enableCache: true });
    ai.registerProvider("mock", mock("cached"));
    const opts = { model: "gpt-4o", provider: "mock", messages: [{ role: "user" as const, content: "Q" }] };

    const r1 = await ai.chat(opts);
    expect(r1.metrics.cache_hit).toBe(false);
    const original_water = r1.metrics.water_ml;
    const original_energy_wh = r1.metrics.energy_wh;
    const original_co2 = r1.metrics.co2_g;

    const r2 = await ai.chat(opts);
    expect(r2.metrics.cache_hit).toBe(true);
    expect(r2.metrics.water_ml).toBe(0);
    expect(r2.metrics.energy_wh).toBe(0);
    expect(r2.metrics.co2_g).toBe(0);

    expect(r2.metrics.session.cache_savings.requests).toBe(1);
    expect(r2.metrics.session.cache_savings.water_ml).toBeCloseTo(original_water, 10);
    expect(r2.metrics.session.cache_savings.energy_wh).toBeCloseTo(original_energy_wh, 10);
    expect(r2.metrics.session.cache_savings.co2_g).toBeCloseTo(original_co2, 10);
  });

  it("cache hit credits full baseline as saved (savings_percent = 100)", async () => {
    const ai = new SustainAI({ enableCache: true });
    ai.registerProvider("mock", mock());
    const opts = { model: "gpt-4o", provider: "mock", messages: [{ role: "user" as const, content: "Z" }] };
    await ai.chat(opts);
    const hit = await ai.chat(opts);
    expect(hit.metrics.water_saved_percent).toBe(100);
    expect(hit.metrics.co2_saved_percent).toBe(100);
  });
});
