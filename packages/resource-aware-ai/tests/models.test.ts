import { describe, it, expect } from "vitest";
import { getModelProfile, listModels } from "../src/core/models.js";

describe("getModelProfile", () => {
  it("returns large for gpt-4o", () => {
    const p = getModelProfile("gpt-4o");
    expect(p?.class).toBe("large");
    expect(p?.provider).toBe("openai");
  });

  it("returns medium for gpt-4o-mini", () => {
    const p = getModelProfile("gpt-4o-mini");
    expect(p?.class).toBe("medium");
  });

  it("returns large for claude-3-5-sonnet-20241022", () => {
    const p = getModelProfile("claude-3-5-sonnet-20241022");
    expect(p?.class).toBe("large");
    expect(p?.provider).toBe("anthropic");
  });

  it("returns medium for gemini-2.0-flash", () => {
    const p = getModelProfile("gemini-2.0-flash");
    expect(p?.class).toBe("medium");
    expect(p?.provider).toBe("gemini");
  });

  it("returns large for mistral-large-latest", () => {
    const p = getModelProfile("mistral-large-latest");
    expect(p?.class).toBe("large");
    expect(p?.provider).toBe("mistral");
  });

  it("returns large for command-r-plus", () => {
    const p = getModelProfile("command-r-plus");
    expect(p?.class).toBe("large");
    expect(p?.provider).toBe("cohere");
  });

  it("returns large for llama3.1:70b", () => {
    const p = getModelProfile("llama3.1:70b");
    expect(p?.class).toBe("large");
    expect(p?.provider).toBe("ollama");
  });

  it("infers class for unknown model names", () => {
    const large = getModelProfile("custom-70b-instruct");
    expect(large?.class).toBe("large");

    const small = getModelProfile("my-mini-model");
    expect(small?.class).toBe("small");
  });
});

describe("listModels", () => {
  it("returns all models when no provider specified", () => {
    const all = listModels();
    expect(all.length).toBeGreaterThan(20);
  });

  it("filters by provider", () => {
    const openai = listModels("openai");
    expect(openai.every((m) => m.provider === "openai")).toBe(true);
    expect(openai.length).toBeGreaterThan(3);

    const anthropic = listModels("anthropic");
    expect(anthropic.every((m) => m.provider === "anthropic")).toBe(true);

    const gemini = listModels("gemini");
    expect(gemini.every((m) => m.provider === "gemini")).toBe(true);

    const mistral = listModels("mistral");
    expect(mistral.every((m) => m.provider === "mistral")).toBe(true);

    const cohere = listModels("cohere");
    expect(cohere.every((m) => m.provider === "cohere")).toBe(true);

    const ollama = listModels("ollama");
    expect(ollama.every((m) => m.provider === "ollama")).toBe(true);
  });

  it("covers at least 6 unique providers", () => {
    const providers = new Set(listModels().map((m) => m.provider));
    expect(providers.size).toBeGreaterThanOrEqual(6);
  });
});
