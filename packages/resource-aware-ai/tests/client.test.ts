import { describe, it, expect, vi } from "vitest";
import { SustainAI, SustainAIError } from "../src/index.js";
import type { ProviderAdapter } from "../src/index.js";

function makeMockProvider(text = "Mock response"): ProviderAdapter {
  return {
    async generate() {
      return {
        text,
        usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
      };
    },
  };
}

describe("SustainAI.chat: core response shape", () => {
  it("returns output, metrics, and footnote", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("mock", makeMockProvider());

    const res = await ai.chat({
      model: "gpt-5.6-terra",
      provider: "mock",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(res.output).toBe("Mock response");
    expect(res.metrics.energy_kwh).toBeGreaterThan(0);
    expect(res.metrics.energy_wh).toBeCloseTo(
      res.metrics.energy_kwh * 1000,
      10,
    );
    expect(res.metrics.water_ml).toBeGreaterThan(0);
    expect(res.metrics.baseline_water_ml).toBeGreaterThan(0);
    expect(res.metrics.water_saved_ml).toBeGreaterThanOrEqual(0);
    expect(res.metrics.water_saved_percent).toBeGreaterThanOrEqual(0);
    expect(res.metrics.co2_g).toBeGreaterThan(0);
    expect(res.metrics.baseline_co2_g).toBeGreaterThan(0);
    expect(res.metrics.equivalents.google_searches).toBeGreaterThan(0);
    expect(res.metrics.session.requests).toBe(1);
    expect(res.footnote).toBeTruthy();
  });

  it("footnote is always present and non-empty", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("mock", makeMockProvider("Test"));
    const res = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "What is 2+2?" }],
    });
    expect(typeof res.footnote).toBe("string");
    expect(res.footnote.length).toBeGreaterThan(10);
  });

  it("usable in fewer than 5 lines of user code", async () => {
    const ai = new SustainAI();
    ai.registerProvider("mock", makeMockProvider());
    const res = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(res.output).toBeTruthy();
  });
});

describe("SustainAI.chat: comparison metrics", () => {
  it("provides water comparison fields", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("mock", makeMockProvider());
    const res = await ai.chat({
      model: "gpt-5.6-terra",
      provider: "mock",
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(res.metrics.water_saved_ml).toBeGreaterThanOrEqual(0);
    expect(res.metrics.baseline_water_ml).toBeGreaterThan(res.metrics.water_ml);
    expect(res.metrics.water_saved_ml).toBeCloseTo(
      res.metrics.baseline_water_ml - res.metrics.water_ml,
      5,
    );
    expect(res.metrics.water_saved_percent).toBeGreaterThan(0);
    expect(res.metrics.water_delta_percent).toBeGreaterThan(0);
    expect(res.metrics.direct_water_ml).toBeGreaterThan(0);
    expect(res.metrics.electricity_water_ml).toBeGreaterThan(0);
    expect(res.metrics.token_source).toBe("provider");
  });

  it("provides carbon comparison fields", async () => {
    const ai = new SustainAI({ enableCache: false, region: "fr" });
    ai.registerProvider("mock", makeMockProvider());
    const res = await ai.chat({
      model: "gpt-5.6-terra",
      provider: "mock",
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(res.metrics.region).toBe("fr");
    expect(res.metrics.grid_intensity_g_per_kwh).toBe(56);
    expect(res.metrics.baseline_grid_intensity_g_per_kwh).toBe(56);
    expect(res.metrics.baseline_co2_g).toBeGreaterThan(res.metrics.co2_g);
    expect(res.metrics.co2_saved_g).toBeCloseTo(
      res.metrics.baseline_co2_g - res.metrics.co2_g,
      6,
    );
    expect(res.metrics.co2_saved_percent).toBeGreaterThan(0);
  });

  it("footnote identifies scope, baseline, and estimate status", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("mock", makeMockProvider());
    const res = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(res.footnote).toContain(
      "direct cooling plus electricity generation",
    );
    expect(res.footnote).toContain("Reference gpt-5.6-sol");
    expect(res.footnote).toContain("Estimate status");
    expect(res.footnote).toContain("Carbon");
  });
});

describe("SustainAI.chat: region overrides", () => {
  it("respects custom gridIntensityG override", async () => {
    const ai = new SustainAI({ enableCache: false, gridIntensityG: 100 });
    ai.registerProvider("mock", makeMockProvider());
    const res = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(res.metrics.grid_intensity_g_per_kwh).toBe(100);
    expect(res.metrics.co2_g).toBeCloseTo(res.metrics.energy_kwh * 100, 6);
  });

  it("respects custom baselineGridIntensityG override", async () => {
    const ai = new SustainAI({
      enableCache: false,
      baselineGridIntensityG: 1500,
    });
    ai.registerProvider("mock", makeMockProvider());
    const res = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(res.metrics.baseline_grid_intensity_g_per_kwh).toBe(1500);
    expect(res.metrics.baseline_co2_g).toBeCloseTo(
      res.metrics.energy_kwh * 1500,
      6,
    );
  });
});

describe("SustainAI.chat: unit systems", () => {
  it("defaults to metric with ml unit", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("mock", makeMockProvider());
    const res = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(res.metrics.unit).toBe("ml");
    expect(res.metrics.water_display).toBeCloseTo(res.metrics.water_ml, 5);
    expect(res.metrics.baseline_display).toBeCloseTo(
      res.metrics.baseline_water_ml,
      5,
    );
  });

  it("converts to fl oz in imperial mode", async () => {
    const ai = new SustainAI({ enableCache: false, unitSystem: "imperial" });
    ai.registerProvider("mock", makeMockProvider());
    const res = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(res.metrics.unit).toBe("fl oz");
    const expectedFlOz = res.metrics.water_ml / 29.5735;
    expect(res.metrics.water_display).toBeCloseTo(expectedFlOz, 4);
    expect(res.metrics.baseline_display).toBeCloseTo(
      res.metrics.baseline_water_ml / 29.5735,
      4,
    );
  });

  it("imperial footnote uses fl oz", async () => {
    const ai = new SustainAI({ enableCache: false, unitSystem: "imperial" });
    ai.registerProvider("mock", makeMockProvider());
    const res = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(res.footnote).toContain("fl oz");
  });
});

describe("SustainAI.chat: bottles metric", () => {
  it("includes bottles_saved per call", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("mock", makeMockProvider());
    const res = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(res.metrics.bottles_saved).toBeGreaterThanOrEqual(0);
  });

  it("accumulates bottles_saved_session across calls", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("mock", makeMockProvider());
    const opts = {
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user" as const, content: "A" }],
    };
    const r1 = await ai.chat(opts);
    const r2 = await ai.chat({
      ...opts,
      messages: [{ role: "user", content: "B" }],
    });
    expect(r2.metrics.bottles_saved_session).toBeGreaterThanOrEqual(
      r1.metrics.bottles_saved_session,
    );
  });

  it("respects custom bottle size", async () => {
    const bottleSizeMl = 250;
    const ai500 = new SustainAI({ enableCache: false, bottleSizeMl: 500 });
    const ai250 = new SustainAI({ enableCache: false, bottleSizeMl });
    ai500.registerProvider("mock", makeMockProvider());
    ai250.registerProvider("mock", makeMockProvider());

    const opts = {
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user" as const, content: "Same" }],
    };
    const r500 = await ai500.chat(opts);
    const r250 = await ai250.chat(opts);

    expect(r250.metrics.bottles_saved).toBeCloseTo(
      r500.metrics.bottles_saved * 2,
      4,
    );
  });
});

describe("SustainAI.chat: caching", () => {
  it("caches repeated identical requests", async () => {
    const generateFn = vi
      .fn()
      .mockResolvedValue({ text: "Cached", usage: { total_tokens: 50 } });
    const ai = new SustainAI({ enableCache: true });
    ai.registerProvider("mock", { generate: generateFn });

    const opts = {
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user" as const, content: "Same" }],
    };
    await ai.chat(opts);
    await ai.chat(opts);

    expect(generateFn).toHaveBeenCalledTimes(1);
  });

  it("keeps a defensive copy of an exact-cache response", async () => {
    const ai = new SustainAI({ enableCache: true });
    ai.registerProvider("mock", makeMockProvider("Original response"));
    const options = {
      model: "gpt-5.6-terra",
      provider: "mock",
      messages: [{ role: "user" as const, content: "Same" }],
    };

    const first = await ai.chat(options);
    first.output = "Mutated response";
    const second = await ai.chat(options);

    expect(second.output).toBe("Original response");
  });

  it("cache hit sets cache_hit=true and shows in footnote", async () => {
    const ai = new SustainAI({ enableCache: true });
    ai.registerProvider("mock", makeMockProvider("Cached response"));

    const opts = {
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user" as const, content: "Repeated" }],
    };
    await ai.chat(opts);
    const second = await ai.chat(opts);

    expect(second.metrics.cache_hit).toBe(true);
    expect(second.footnote.toLowerCase()).toContain("cache");
  });

  it("cache hit still increments session bottles", async () => {
    const ai = new SustainAI({ enableCache: true });
    ai.registerProvider("mock", makeMockProvider());

    const opts = {
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user" as const, content: "X" }],
    };
    const r1 = await ai.chat(opts);
    const r2 = await ai.chat(opts);
    expect(r2.metrics.bottles_saved_session).toBeGreaterThanOrEqual(
      r1.metrics.bottles_saved_session,
    );
  });
});

describe("SustainAI.chat: errors", () => {
  it("throws SustainAIError for unknown provider", async () => {
    const ai = new SustainAI({ enableCache: false });
    await expect(
      ai.chat({
        model: "gpt-4o",
        provider: "nonexistent",
        messages: [{ role: "user", content: "Hi" }],
      }),
    ).rejects.toBeInstanceOf(SustainAIError);
  });

  it("throws RESOURCE_LIMIT_EXCEEDED when water limit exceeded", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("mock", makeMockProvider());
    await expect(
      ai.chat({
        model: "gpt-4o",
        provider: "mock",
        messages: [{ role: "user", content: "A".repeat(10000) }],
        constraints: { max_water_ml: 0.0001 },
      }),
    ).rejects.toMatchObject({ sdkError: { code: "RESOURCE_LIMIT_EXCEEDED" } });
  });

  it("throws RESOURCE_LIMIT_EXCEEDED when CO₂ limit exceeded", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("mock", makeMockProvider());
    await expect(
      ai.chat({
        model: "gpt-4o",
        provider: "mock",
        messages: [{ role: "user", content: "A".repeat(10000) }],
        constraints: { max_co2_g: 0.000001 },
      }),
    ).rejects.toMatchObject({ sdkError: { code: "RESOURCE_LIMIT_EXCEEDED" } });
  });

  it("rejects non-finite resource constraints before a provider call", async () => {
    const generate = vi.fn().mockResolvedValue({ text: "unused" });
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("mock", { generate });

    await expect(
      ai.chat({
        model: "gpt-5.6-terra",
        provider: "mock",
        messages: [{ role: "user", content: "Hi" }],
        constraints: { max_water_ml: Number.NaN },
      }),
    ).rejects.toThrow(/finite/);
    expect(generate).not.toHaveBeenCalled();
  });

  it("rejects an invalid cache namespace before a provider call", async () => {
    const generate = vi.fn().mockResolvedValue({ text: "unused" });
    const ai = new SustainAI({ enableCache: true });
    ai.registerProvider("mock", { generate });

    await expect(
      ai.chat({
        model: "gpt-5.6-terra",
        provider: "mock",
        messages: [{ role: "user", content: "Hi" }],
        cacheNamespace: "x".repeat(257),
      }),
    ).rejects.toMatchObject({ sdkError: { code: "CONFIG_ERROR" } });
    expect(generate).not.toHaveBeenCalled();
  });

  it("rejects provider names that could alter object prototypes", () => {
    const ai = new SustainAI();
    expect(() => ai.registerProvider("__proto__", makeMockProvider())).toThrow(
      /Provider name/,
    );
  });
});

describe("SustainAI.chat: custom estimator", () => {
  it("uses custom estimator when set", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.setEstimator(() => 999);
    ai.registerProvider("mock", makeMockProvider());
    const res = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(res.metrics.energy_kwh).toBe(999);
  });
});

describe("SustainAI.getStats", () => {
  it("tracks requests, water, energy, and CO₂ totals", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("mock", makeMockProvider());

    await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "Hello" }],
    });
    await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "World" }],
    });

    const stats = ai.getStats();
    expect(stats.total_requests).toBe(2);
    expect(stats.total_water_ml).toBeGreaterThan(0);
    expect(stats.total_energy_kwh).toBeGreaterThan(0);
    expect(stats.total_co2_g).toBeGreaterThan(0);
    expect(stats.bottles_saved_session).toBeGreaterThanOrEqual(0);
    expect(stats.unit).toBe("ml");
    expect(stats.region).toBe("us");
    expect(stats.equivalents_used.google_searches).toBeGreaterThan(0);
  });

  it("reports imperial units in stats when configured", async () => {
    const ai = new SustainAI({ enableCache: false, unitSystem: "imperial" });
    ai.registerProvider("mock", makeMockProvider());
    await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "Hi" }],
    });
    const stats = ai.getStats();
    expect(stats.unit).toBe("fl oz");
    expect(stats.total_water_display).toBeCloseTo(
      stats.total_water_ml / 29.5735,
      4,
    );
  });

  it("resetSession zeroes session counters", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("mock", makeMockProvider());
    await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "A" }],
    });
    ai.resetSession();
    const stats = ai.getStats();
    expect(stats.total_requests).toBe(0);
    expect(stats.bottles_saved_session).toBe(0);
    expect(stats.total_co2_g).toBe(0);
    expect(stats.cache_savings.requests).toBe(0);
  });
});
