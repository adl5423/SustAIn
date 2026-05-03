import { describe, it, expect, vi } from "vitest";
import {
  defaultConfidenceFn,
  LOW_CONFIDENCE_PATTERNS,
  DEFAULT_CONFIDENCE_THRESHOLD,
} from "../src/core/router.js";
import { ResourceAwareAI, ResourceAwareAIError } from "../src/index.js";
import type { ProviderAdapter } from "../src/index.js";

describe("defaultConfidenceFn", () => {
  it("returns 1.0 for a normal confident answer", () => {
    expect(
      defaultConfidenceFn({ text: "Photosynthesis is the process by which plants convert sunlight into energy." }),
    ).toBeCloseTo(1, 5);
  });

  it("returns 0 for empty / whitespace text", () => {
    expect(defaultConfidenceFn({ text: "" })).toBe(0);
    expect(defaultConfidenceFn({ text: "    " })).toBe(0);
  });

  it("penalises very short responses", () => {
    expect(defaultConfidenceFn({ text: "Sure!" })).toBeLessThan(1);
    expect(defaultConfidenceFn({ text: "Sure!" })).toBeCloseTo(0.7, 5);
  });

  it("penalises 'I don't know' style answers below threshold", () => {
    const c = defaultConfidenceFn({ text: "I don't know the answer to that — could you clarify?" });
    expect(c).toBeLessThan(DEFAULT_CONFIDENCE_THRESHOLD);
  });

  it("penalises refusals heavily", () => {
    const c = defaultConfidenceFn({ text: "I'm sorry, but I cannot help with that request." });
    expect(c).toBeLessThan(0.5);
  });

  it("penalises questions back to the user", () => {
    const c = defaultConfidenceFn({ text: "Could you clarify what you mean?" });
    expect(c).toBeLessThan(DEFAULT_CONFIDENCE_THRESHOLD);
  });

  it("clamps to [0, 1]", () => {
    // Stack penalties on top of each other
    const reallyBad = defaultConfidenceFn({
      text: "I don't know. I'm not sure. I cannot help. Could you clarify?",
    });
    expect(reallyBad).toBeGreaterThanOrEqual(0);
    expect(reallyBad).toBeLessThanOrEqual(1);
  });

  it("LOW_CONFIDENCE_PATTERNS match expected phrases", () => {
    expect(LOW_CONFIDENCE_PATTERNS.some((re) => re.test("I don't know"))).toBe(true);
    expect(LOW_CONFIDENCE_PATTERNS.some((re) => re.test("I am not sure"))).toBe(true);
  });
});

describe("ResourceAwareAI.chatWithRouting", () => {
  function provider(text: string, totalTokens = 50): ProviderAdapter {
    return {
      async generate() {
        return { text, usage: { total_tokens: totalTokens } };
      },
    };
  }

  it("uses tier 0 when its confidence is high enough", async () => {
    const ai = new ResourceAwareAI({ enableCache: false });
    ai.registerProvider("small", provider("Photosynthesis converts sunlight into energy via chlorophyll."));
    ai.registerProvider("large", provider("This should not be called"));

    const res = await ai.chatWithRouting({
      messages: [{ role: "user", content: "What is photosynthesis?" }],
      router: {
        tiers: [
          { model: "small-model", provider: "small" },
          { model: "large-model", provider: "large" },
        ],
      },
    });

    expect(res.metrics.router?.tier_used).toBe(0);
    expect(res.metrics.router?.escalated).toBe(false);
    expect(res.metrics.router?.tiers_attempted).toBe(1);
    expect(res.metrics.router?.model_chosen).toBe("small-model");
  });

  it("escalates to a larger tier when small tier is uncertain", async () => {
    const ai = new ResourceAwareAI({ enableCache: false });
    ai.registerProvider("small", provider("I don't know, could you clarify?"));
    ai.registerProvider("large", provider("The capital of France is Paris."));

    const res = await ai.chatWithRouting({
      messages: [{ role: "user", content: "What's the capital of France?" }],
      router: {
        tiers: [
          { model: "small-model", provider: "small" },
          { model: "large-model", provider: "large" },
        ],
      },
    });

    expect(res.output).toContain("Paris");
    expect(res.metrics.router?.tier_used).toBe(1);
    expect(res.metrics.router?.escalated).toBe(true);
    expect(res.metrics.router?.tiers_attempted).toBe(2);
    expect(res.metrics.router?.model_chosen).toBe("large-model");
  });

  it("respects a custom confidenceFn", async () => {
    const ai = new ResourceAwareAI({ enableCache: false });
    ai.registerProvider("small", provider("anything"));
    ai.registerProvider("large", provider("anything"));

    const customFn = vi.fn().mockResolvedValue(0.99); // always confident
    const res = await ai.chatWithRouting({
      messages: [{ role: "user", content: "x" }],
      router: {
        tiers: [
          { model: "s", provider: "small" },
          { model: "l", provider: "large" },
        ],
        confidenceFn: customFn,
      },
    });

    expect(res.metrics.router?.tier_used).toBe(0);
    expect(customFn).toHaveBeenCalledTimes(1);
  });

  it("falls back to the largest tier when nothing crosses the threshold", async () => {
    const ai = new ResourceAwareAI({ enableCache: false });
    ai.registerProvider("small", provider("I don't know"));
    ai.registerProvider("large", provider("I don't know either"));

    const res = await ai.chatWithRouting({
      messages: [{ role: "user", content: "?" }],
      router: {
        tiers: [
          { model: "s", provider: "small" },
          { model: "l", provider: "large" },
        ],
      },
    });

    expect(res.metrics.router?.tier_used).toBe(1);
    expect(res.metrics.router?.tiers_attempted).toBe(2);
  });

  it("throws CONFIG_ERROR when tiers is empty", async () => {
    const ai = new ResourceAwareAI({ enableCache: false });
    await expect(
      ai.chatWithRouting({
        messages: [{ role: "user", content: "x" }],
        router: { tiers: [] },
      }),
    ).rejects.toBeInstanceOf(ResourceAwareAIError);
  });

  it("computes positive savings vs largest tier when it stops at tier 0", async () => {
    const ai = new ResourceAwareAI({ enableCache: false });
    ai.registerProvider("small", provider("Confident detailed answer about topic.", 100));
    ai.registerProvider("large", provider("unused"));

    const res = await ai.chatWithRouting({
      messages: [{ role: "user", content: "Q" }],
      router: {
        tiers: [
          { model: "gpt-4o-mini", provider: "small" },   // small class
          { model: "gpt-4o", provider: "large" },        // large class
        ],
      },
    });

    expect(res.metrics.router?.energy_saved_vs_largest_kwh).toBeGreaterThan(0);
    expect(res.metrics.router?.water_saved_vs_largest_ml).toBeGreaterThan(0);
    expect(res.metrics.router?.co2_saved_vs_largest_g).toBeGreaterThan(0);
  });

  it("accumulates router totals in session.router", async () => {
    const ai = new ResourceAwareAI({ enableCache: false });
    ai.registerProvider("small", provider("Confident answer here."));
    ai.registerProvider("large", provider("Larger model answer."));

    const tiers = [
      { model: "gpt-4o-mini", provider: "small" },
      { model: "gpt-4o", provider: "large" },
    ];

    await ai.chatWithRouting({ messages: [{ role: "user", content: "a" }], router: { tiers } });
    await ai.chatWithRouting({ messages: [{ role: "user", content: "b" }], router: { tiers } });

    const stats = ai.getStats();
    expect(stats.router?.routed_requests).toBe(2);
    expect(stats.router?.tier_usage[0]).toBe(2);
    expect(stats.router?.escalations).toBe(0);
  });
});
