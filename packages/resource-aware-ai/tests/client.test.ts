import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResourceAwareAI, ResourceAwareAIError } from "../src/index.js";
import type { ProviderAdapter, Message } from "../src/index.js";

function makeMockProvider(text = "Mock response"): ProviderAdapter {
  return {
    async generate() {
      return { text, usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 } };
    },
  };
}

describe("ResourceAwareAI.chat", () => {
  it("returns output, metrics, and footnote", async () => {
    const ai = new ResourceAwareAI({ enableCache: false });
    ai.registerProvider("mock", makeMockProvider());

    const res = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(res.output).toBe("Mock response");
    expect(res.metrics.energy_kwh).toBeGreaterThan(0);
    expect(res.metrics.water_ml).toBeGreaterThan(0);
    expect(res.metrics.baseline_water_ml).toBeGreaterThan(0);
    expect(res.metrics.water_saved_percent).toBeGreaterThanOrEqual(0);
    expect(res.footnote).toBeTruthy();
    expect(res.footnote.toLowerCase()).toContain("ml");
  });

  it("footnote is always present", async () => {
    const ai = new ResourceAwareAI({ enableCache: false });
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
    const ai = new ResourceAwareAI();
    ai.registerProvider("mock", makeMockProvider());
    const res = await ai.chat({ model: "gpt-4o", provider: "mock", messages: [{ role: "user", content: "Hi" }] });
    expect(res.output).toBeTruthy();
  });

  it("caches repeated identical requests", async () => {
    const generateFn = vi.fn().mockResolvedValue({ text: "Cached", usage: { total_tokens: 50 } });
    const mockProvider: ProviderAdapter = { generate: generateFn };

    const ai = new ResourceAwareAI({ enableCache: true });
    ai.registerProvider("mock", mockProvider);

    const messages: Message[] = [{ role: "user", content: "Same question" }];
    const opts = { model: "gpt-4o", provider: "mock", messages };

    await ai.chat(opts);
    await ai.chat(opts);

    expect(generateFn).toHaveBeenCalledTimes(1);
  });

  it("cache hit sets cache_hit=true in metrics", async () => {
    const ai = new ResourceAwareAI({ enableCache: true });
    ai.registerProvider("mock", makeMockProvider("Cached response"));

    const messages: Message[] = [{ role: "user", content: "Repeated" }];
    const opts = { model: "gpt-4o", provider: "mock", messages };

    await ai.chat(opts);
    const second = await ai.chat(opts);

    expect(second.metrics.cache_hit).toBe(true);
    expect(second.footnote.toLowerCase()).toContain("cache");
  });

  it("throws ResourceAwareAIError for unknown provider", async () => {
    const ai = new ResourceAwareAI({ enableCache: false });

    await expect(
      ai.chat({ model: "gpt-4o", provider: "nonexistent", messages: [{ role: "user", content: "Hi" }] })
    ).rejects.toBeInstanceOf(ResourceAwareAIError);
  });

  it("throws RESOURCE_LIMIT_EXCEEDED when water limit exceeded", async () => {
    const ai = new ResourceAwareAI({ enableCache: false });
    ai.registerProvider("mock", makeMockProvider());

    await expect(
      ai.chat({
        model: "gpt-4o",
        provider: "mock",
        messages: [{ role: "user", content: "A".repeat(10000) }],
        constraints: { max_water_ml: 0.0001 },
      })
    ).rejects.toMatchObject({ sdkError: { code: "RESOURCE_LIMIT_EXCEEDED" } });
  });

  it("uses custom estimator when set", async () => {
    const ai = new ResourceAwareAI({ enableCache: false });
    ai.setEstimator(() => 999);
    ai.registerProvider("mock", makeMockProvider());

    const res = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(res.metrics.energy_kwh).toBe(999);
  });

  it("supports registerProvider chaining", () => {
    const ai = new ResourceAwareAI();
    const chain = ai.registerProvider("a", makeMockProvider()).registerProvider("b", makeMockProvider());
    expect(chain).toBe(ai);
  });
});

describe("ResourceAwareAI.getStats", () => {
  it("tracks total_requests and total_water_ml", async () => {
    const ai = new ResourceAwareAI({ enableCache: false });
    ai.registerProvider("mock", makeMockProvider());

    await ai.chat({ model: "gpt-4o", provider: "mock", messages: [{ role: "user", content: "Hello" }] });
    await ai.chat({ model: "gpt-4o", provider: "mock", messages: [{ role: "user", content: "World" }] });

    const stats = ai.getStats();
    expect(stats.total_requests).toBe(2);
    expect(stats.total_water_ml).toBeGreaterThan(0);
  });

  it("tracks cache hits in stats", async () => {
    const ai = new ResourceAwareAI({ enableCache: true });
    ai.registerProvider("mock", makeMockProvider());

    const messages: Message[] = [{ role: "user", content: "Cached question" }];
    const opts = { model: "gpt-4o", provider: "mock", messages };

    await ai.chat(opts);
    await ai.chat(opts);

    const stats = ai.getStats();
    expect(stats.cache_hits).toBe(1);
    expect(stats.cache_hit_rate).toBeCloseTo(50, 0);
  });
});

describe("ResourceAwareAI — provider metrics accuracy", () => {
  it("returns baseline_water_ml > water_ml when using efficient settings", async () => {
    const ai = new ResourceAwareAI({ regionFactor: 1800, baselineFactor: 4500, enableCache: false });
    ai.registerProvider("mock", makeMockProvider());

    const res = await ai.chat({
      model: "gpt-4o-mini",
      provider: "mock",
      messages: [{ role: "user", content: "Short" }],
    });

    expect(res.metrics.baseline_water_ml).toBeGreaterThan(res.metrics.water_ml);
  });
});
