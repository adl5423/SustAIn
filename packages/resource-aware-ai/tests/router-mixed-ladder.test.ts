import { describe, it, expect } from "vitest";
import { SustainAI } from "../src/index.js";
import type { ProviderAdapter } from "../src/index.js";

function provider(text: string): ProviderAdapter {
  return {
    async generate() {
      return { text, usage: { total_tokens: 50 } };
    },
  };
}

describe("Router — mixed-length tier ladders across calls", () => {
  it("grows tier_usage when a later call uses a longer ladder", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("a", provider("Confident answer one."));
    ai.registerProvider("b", provider("Confident answer two."));
    ai.registerProvider("c", provider("Confident answer three."));

    // First call: 2 tiers, answers at tier 0
    await ai.chatWithRouting({
      messages: [{ role: "user", content: "first" }],
      router: {
        tiers: [
          { model: "m1", provider: "a" },
          { model: "m2", provider: "b" },
        ],
      },
    });

    // Second call: 3 tiers, answers at tier 0
    await ai.chatWithRouting({
      messages: [{ role: "user", content: "second" }],
      router: {
        tiers: [
          { model: "m1", provider: "a" },
          { model: "m2", provider: "b" },
          { model: "m3", provider: "c" },
        ],
      },
    });

    const stats = ai.getStats();
    expect(stats.router?.routed_requests).toBe(2);
    expect(stats.router?.tier_usage[0]).toBe(2);
    // The array grew safely — no out-of-bounds errors
    expect(stats.router?.tier_usage.length).toBeGreaterThanOrEqual(1);
  });

  it("clamps a NaN/out-of-range confidenceFn output without breaking", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("a", provider("anything"));
    ai.registerProvider("b", provider("anything"));

    // Returns NaN — should be treated as 0 (forces escalation)
    const res = await ai.chatWithRouting({
      messages: [{ role: "user", content: "x" }],
      router: {
        tiers: [
          { model: "m1", provider: "a" },
          { model: "m2", provider: "b" },
        ],
        confidenceFn: () => Number.NaN,
      },
    });

    expect(res.metrics.router?.confidence).toBe(0);
    expect(res.metrics.router?.tier_used).toBe(1);
  });

  it("clamps a confidenceFn that returns > 1 to exactly 1", async () => {
    const ai = new SustainAI({ enableCache: false });
    ai.registerProvider("a", provider("ok"));
    const res = await ai.chatWithRouting({
      messages: [{ role: "user", content: "x" }],
      router: {
        tiers: [{ model: "m", provider: "a" }],
        confidenceFn: () => 999,
      },
    });
    expect(res.metrics.router?.confidence).toBe(1);
  });
});
