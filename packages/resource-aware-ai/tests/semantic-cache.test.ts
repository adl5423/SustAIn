import { describe, it, expect } from "vitest";
import {
  SemanticCache,
  cosineSimilarity,
  canonicalizeMessages,
} from "../src/core/semantic-cache.js";
import { SustainAI } from "../src/index.js";
import type { ProviderAdapter, ChatResponse } from "../src/index.js";
import { vi } from "vitest";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
  });

  it("is invariant to vector magnitude", () => {
    const a = cosineSimilarity([1, 2, 3], [2, 4, 6]);
    expect(a).toBeCloseTo(1, 10);
  });

  it("returns 0 for length mismatch", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 when either side is all zeros", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });
});

describe("canonicalizeMessages", () => {
  it("includes the role in the canonical form", () => {
    const text = canonicalizeMessages([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ]);
    expect(text).toContain("user: hello");
    expect(text).toContain("assistant: hi");
  });
});

describe("SemanticCache", () => {
  function fakeResponse(text: string): ChatResponse {
    return {
      output: text,
      footnote: "",
      metrics: {
        energy_kwh: 0.001,
        energy_wh: 1,
        water_ml: 2,
        baseline_water_ml: 4.5,
        water_saved_ml: 2.5,
        water_saved_percent: 55.5,
        water_display: 2,
        baseline_display: 4.5,
        water_saved_display: 2.5,
        unit: "ml",
        bottles_saved: 0.005,
        bottles_saved_session: 0.005,
        bottle_size_display: 500,
        co2_g: 0.481,
        baseline_co2_g: 0.9,
        co2_saved_g: 0.419,
        co2_saved_percent: 46.5,
        co2_saved_session_g: 0.419,
        region: "global",
        grid_intensity_g_per_kwh: 481,
        baseline_grid_intensity_g_per_kwh: 900,
        equivalents: {
          google_searches: 0,
          smartphone_charges: 0,
          km_driven: 0,
          led_bulb_hours: 0,
          shower_seconds: 0,
        },
        tokens_estimated: 100,
        cache_hit: false,
        cache_hit_type: null,
        cache_similarity: null,
        session: {
          requests: 1,
          cache_hits: 0,
          cache_hit_rate: 0,
          energy_kwh: 0.001,
          water_ml: 2,
          co2_g: 0.481,
          water_saved_ml: 2.5,
          co2_saved_g: 0.419,
          bottles_saved: 0.005,
          cache_savings: { requests: 0, exact_hits: 0, semantic_hits: 0, energy_wh: 0, water_ml: 0, co2_g: 0 },
          equivalents_used: { google_searches: 0, smartphone_charges: 0, km_driven: 0, led_bulb_hours: 0, shower_seconds: 0 },
          equivalents_saved: { google_searches: 0, smartphone_charges: 0, km_driven: 0, led_bulb_hours: 0, shower_seconds: 0 },
        },
      },
    };
  }

  it("returns the most similar entry above threshold", () => {
    const cache = new SemanticCache();
    cache.add([1, 0, 0], fakeResponse("a"));
    cache.add([0.95, 0.05, 0], fakeResponse("b")); // most similar to query
    cache.add([0, 1, 0], fakeResponse("c"));

    const hit = cache.findSimilar([1, 0, 0], 0.9);
    expect(hit).not.toBeNull();
    expect(hit!.response.output).toBe("a");
  });

  it("returns null below threshold", () => {
    const cache = new SemanticCache();
    cache.add([1, 0, 0], fakeResponse("only"));
    expect(cache.findSimilar([0, 1, 0], 0.5)).toBeNull();
  });

  it("evicts FIFO once maxSize exceeded", () => {
    const cache = new SemanticCache(2);
    cache.add([1, 0, 0], fakeResponse("first"));
    cache.add([0, 1, 0], fakeResponse("second"));
    cache.add([0, 0, 1], fakeResponse("third"));
    expect(cache.size()).toBe(2);
    expect(cache.findSimilar([1, 0, 0], 0.99)).toBeNull(); // first was evicted
    expect(cache.findSimilar([0, 1, 0], 0.99)).not.toBeNull();
  });

  it("clear removes all entries", () => {
    const cache = new SemanticCache();
    cache.add([1, 0], fakeResponse("a"));
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it("rejects empty embeddings on add", () => {
    const cache = new SemanticCache();
    cache.add([], fakeResponse("x"));
    expect(cache.size()).toBe(0);
  });
});

describe("SustainAI — semantic cache integration", () => {
  function makeMock(text = "hello"): ProviderAdapter {
    return {
      async generate() {
        return { text, usage: { total_tokens: 50 } };
      },
    };
  }

  // Tiny deterministic embedder: maps a couple of phrases to known vectors.
  function topicEmbedder(text: string): number[] {
    const t = text.toLowerCase();
    if (t.includes("weather")) return [1, 0, 0];
    if (t.includes("forecast")) return [0.96, 0.28, 0]; // ~0.96 cosine to "weather"
    if (t.includes("recipe")) return [0, 1, 0];
    return [0, 0, 1];
  }

  it("serves a similar prompt from the semantic cache (above threshold)", async () => {
    const generateFn = vi.fn().mockResolvedValue({ text: "It is sunny.", usage: { total_tokens: 50 } });
    const ai = new SustainAI({
      enableCache: true,
      enableSemanticCache: true,
      embedder: topicEmbedder,
      semanticCacheThreshold: 0.9,
    });
    ai.registerProvider("mock", { generate: generateFn });

    const r1 = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "What's the weather today?" }],
    });
    expect(r1.metrics.cache_hit).toBe(false);

    const r2 = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "Give me the forecast for today" }],
    });
    expect(r2.metrics.cache_hit).toBe(true);
    expect(r2.metrics.cache_hit_type).toBe("semantic");
    expect(r2.metrics.cache_similarity).toBeGreaterThan(0.9);
    expect(r2.metrics.water_ml).toBe(0);
    expect(generateFn).toHaveBeenCalledTimes(1);
    expect(r2.metrics.session.cache_savings.semantic_hits).toBe(1);
  });

  it("does NOT serve from semantic cache when below threshold", async () => {
    const generateFn = vi.fn().mockResolvedValue({ text: "Hi", usage: { total_tokens: 30 } });
    const ai = new SustainAI({
      enableCache: true,
      enableSemanticCache: true,
      embedder: topicEmbedder,
      semanticCacheThreshold: 0.99, // very strict
    });
    ai.registerProvider("mock", { generate: generateFn });

    await ai.chat({ model: "gpt-4o", provider: "mock", messages: [{ role: "user", content: "weather" }] });
    const r2 = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "forecast" }],
    });
    expect(r2.metrics.cache_hit).toBe(false);
    expect(generateFn).toHaveBeenCalledTimes(2);
  });

  it("counts exact hits and semantic hits separately", async () => {
    const ai = new SustainAI({
      enableCache: true,
      enableSemanticCache: true,
      embedder: topicEmbedder,
      semanticCacheThreshold: 0.9,
    });
    ai.registerProvider("mock", makeMock());

    const a = { model: "gpt-4o", provider: "mock", messages: [{ role: "user" as const, content: "weather please" }] };
    const b = { model: "gpt-4o", provider: "mock", messages: [{ role: "user" as const, content: "forecast please" }] };

    await ai.chat(a);            // miss
    await ai.chat(a);            // exact hit
    const r3 = await ai.chat(b); // semantic hit

    expect(r3.metrics.session.cache_savings.exact_hits).toBe(1);
    expect(r3.metrics.session.cache_savings.semantic_hits).toBe(1);
    expect(r3.metrics.session.cache_savings.requests).toBe(2);
  });

  it("survives an embedder that throws", async () => {
    const generateFn = vi.fn().mockResolvedValue({ text: "ok", usage: { total_tokens: 10 } });
    const ai = new SustainAI({
      enableCache: false,
      enableSemanticCache: true,
      embedder: () => {
        throw new Error("embedder broke");
      },
    });
    ai.registerProvider("mock", { generate: generateFn });

    const res = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.output).toBe("ok");
    expect(res.metrics.cache_hit).toBe(false);
    expect(generateFn).toHaveBeenCalledTimes(1);
  });

  it("does nothing semantic when no embedder is configured", async () => {
    const ai = new SustainAI({ enableCache: true, enableSemanticCache: true });
    ai.registerProvider("mock", makeMock());
    const res = await ai.chat({
      model: "gpt-4o",
      provider: "mock",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.metrics.cache_hit).toBe(false);
    expect(ai.getSemanticCacheSize()).toBe(0);
  });

  it("clearCache also clears the semantic cache", async () => {
    const ai = new SustainAI({
      enableCache: true,
      enableSemanticCache: true,
      embedder: topicEmbedder,
      semanticCacheThreshold: 0.9,
    });
    ai.registerProvider("mock", makeMock());
    await ai.chat({ model: "gpt-4o", provider: "mock", messages: [{ role: "user", content: "weather" }] });
    expect(ai.getSemanticCacheSize()).toBe(1);
    ai.clearCache();
    expect(ai.getSemanticCacheSize()).toBe(0);
  });
});
